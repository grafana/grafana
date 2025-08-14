package pq

import (
	"context"
	"database/sql/driver"
	"encoding/binary"
	"errors"
	"fmt"
	"sync"
)

var (
	errCopyInClosed               = errors.New("pq: copyin statement has already been closed")
	errBinaryCopyNotSupported     = errors.New("pq: only text format supported for COPY")
	errCopyToNotSupported         = errors.New("pq: COPY TO is not supported")
	errCopyNotSupportedOutsideTxn = errors.New("pq: COPY is only allowed inside a transaction")
	errCopyInProgress             = errors.New("pq: COPY in progress")
)

// CopyIn creates a COPY FROM statement which can be prepared with
// Tx.Prepare().  The target table should be visible in search_path.
func CopyIn(table string, columns ...string) string {
	stmt := "COPY " + QuoteIdentifier(table) + " ("
	for i, col := range columns {
		if i != 0 {
			stmt += ", "
		}
		stmt += QuoteIdentifier(col)
	}
	stmt += ") FROM STDIN"
	return stmt
}

// CopyInSchema creates a COPY FROM statement which can be prepared with
// Tx.Prepare().
func CopyInSchema(schema, table string, columns ...string) string {
	stmt := "COPY " + QuoteIdentifier(schema) + "." + QuoteIdentifier(table) + " ("
	for i, col := range columns {
		if i != 0 {
			stmt += ", "
		}
		stmt += QuoteIdentifier(col)
	}
	stmt += ") FROM STDIN"
	return stmt
}

type copyin struct {
	cn           *conn
	buffer       []byte
	cpBufferSize int64

	rowData chan []byte
	done    chan bool

	closed bool

	mu struct {
		sync.Mutex
		err error
		driver.Result
	}

	paramTyps []int
	rowFormat byte
}

const ciBufferSize = 64 * 1024

// flush buffer before the buffer is filled up and needs reallocation
const ciBufferFlushSize = 63 * 1024

func (cn *conn) prepareCopyIn(q string) (_ driver.Stmt, err error) {
	if !cn.isInTransaction() {
		return nil, errCopyNotSupportedOutsideTxn
	}
	cpBufferSize := cn.config.cpBufferSize
	if cpBufferSize == 0 {
		cpBufferSize = ciBufferSize
	}
	ci := &copyin{
		cn:           cn,
		buffer:       make([]byte, 0, cpBufferSize),
		cpBufferSize: cpBufferSize,
		rowData:      make(chan []byte),
		done:         make(chan bool, 1),
	}
	// add CopyData identifier + 4 bytes for message length
	ci.buffer = append(ci.buffer, 'd', 0, 0, 0, 0)
	cn.log(nil, LogLevelDebug, "FE=> Query(CopyStart)", nil)
	b := cn.writeBuf('Q')
	b.string(q)
	cn.send(b)

awaitCopyInResponse:
	for {
		t, r := cn.recv1()
		switch t {
		case 'G':
			cn.log(nil, LogLevelDebug, "<=BE CopyInResponse", nil)
			ci.readStatementDescribeResponse(r)
			if r.byte() != 0 {
				err = errBinaryCopyNotSupported
				break awaitCopyInResponse
			}
			go ci.resploop()
			return ci, nil
		case 'H':
			cn.log(nil, LogLevelDebug, "<=BE CopyOutResponse", nil)
			err = errCopyToNotSupported
			break awaitCopyInResponse
		case 'E':
			err = parseError(r)
		case 'Z':
			if err == nil {
				ci.setBad(driver.ErrBadConn)
				errorf("unexpected ReadyForQuery in response to COPY")
			}
			cn.processReadyForQuery(r)
			return nil, err
		default:
			ci.setBad(driver.ErrBadConn)
			errorf("unknown response for copy query: %q", t)
		}
	}

	// something went wrong, abort COPY before we return
	b = cn.writeBuf('f')
	b.string(err.Error())
	cn.send(b)

	for {
		t, r := cn.recv1()
		switch t {
		case 'c', 'C', 'E':
		case 'Z':
			// correctly aborted, we're done
			cn.processReadyForQuery(r)
			return nil, err
		default:
			ci.setBad(driver.ErrBadConn)
			errorf("unknown response for CopyFail: %q", t)
		}
	}
}

func (ci *copyin) readStatementDescribeResponse(r *readBuf) {
	ci.rowFormat = r.byte()
	nparams := r.int16()
	ci.paramTyps = make([]int, nparams)
	for i := range ci.paramTyps {
		ci.paramTyps[i] = int(r.byte())
	}
}

func (ci *copyin) flush(buf []byte) {
	// set message length (without message identifier)
	binary.BigEndian.PutUint32(buf[1:], uint32(len(buf)-1))
	_, err := ci.cn.c.Write(buf)
	if err != nil {
		panic(err)
	}
}

func (ci *copyin) resploop() {
	for {
		var r readBuf
		t, err := ci.cn.recvMessage(&r)
		if err != nil {
			ci.setBad(driver.ErrBadConn)
			ci.setError(err)
			ci.done <- true
			return
		}
		switch t {
		case 'C':
			// complete
			res, _ := ci.cn.parseComplete(r.string())
			ci.setResult(res)
		case 'N':
			if n := ci.cn.noticeHandler; n != nil {
				n(parseError(&r))
			}
		case 'Z':
			ci.cn.processReadyForQuery(&r)
			ci.done <- true
			return
		case 'E':
			err := parseError(&r)
			ci.setError(err)
		default:
			ci.setBad(driver.ErrBadConn)
			ci.setError(fmt.Errorf("unknown response during CopyIn: %q", t))
			ci.done <- true
			return
		}
	}
}

func (ci *copyin) setBad(err error) {
	ci.cn.err.set(err)
}

func (ci *copyin) getBad() error {
	return ci.cn.err.get()
}

func (ci *copyin) err() error {
	ci.mu.Lock()
	err := ci.mu.err
	ci.mu.Unlock()
	return err
}

// setError() sets ci.err if one has not been set already.  Caller must not be
// holding ci.Mutex.
func (ci *copyin) setError(err error) {
	ci.mu.Lock()
	if ci.mu.err == nil {
		ci.mu.err = err
	}
	ci.mu.Unlock()
}

func (ci *copyin) setResult(result driver.Result) {
	ci.mu.Lock()
	ci.mu.Result = result
	ci.mu.Unlock()
}

func (ci *copyin) getResult() driver.Result {
	ci.mu.Lock()
	result := ci.mu.Result
	ci.mu.Unlock()
	if result == nil {
		return driver.RowsAffected(0)
	}
	return result
}

func (ci *copyin) NumInput() int {
	return -1
}

func (ci *copyin) Query(v []driver.Value) (r driver.Rows, err error) {
	return nil, ErrNotSupported
}

// Exec inserts values into the COPY stream. The insert is asynchronous
// and Exec can return errors from previous Exec calls to the same
// COPY stmt.
//
// You need to call Exec(nil) to sync the COPY stream and to get any
// errors from pending data, since Stmt.Close() doesn't return errors
// to the user.
func (ci *copyin) Exec(v []driver.Value) (r driver.Result, err error) {
	if ci.closed {
		return nil, errCopyInClosed
	}

	if err := ci.getBad(); err != nil {
		return nil, err
	}
	defer ci.cn.errRecover(&err)

	if err := ci.err(); err != nil {
		return nil, err
	}

	if len(v) == 0 {
		if err := ci.Close(); err != nil {
			return driver.RowsAffected(0), err
		}

		return ci.getResult(), nil
	}

	numValues := len(v)
	for i, value := range v {
		ci.buffer = appendEncodedText(&ci.cn.parameterStatus, ci.buffer, value)
		if i < numValues-1 {
			ci.buffer = append(ci.buffer, '\t')
		}
	}

	ci.buffer = append(ci.buffer, '\n')

	if len(ci.buffer) > int(ci.cpBufferSize) {
		ci.flush(ci.buffer)
		// reset buffer, keep bytes for message identifier and length
		ci.buffer = ci.buffer[:5]
	}

	return driver.RowsAffected(0), nil
}

// CopyData inserts a raw string into the COPY stream. The insert is
// asynchronous and CopyData can return errors from previous CopyData calls to
// the same COPY stmt.
//
// You need to call Exec(nil) to sync the COPY stream and to get any
// errors from pending data, since Stmt.Close() doesn't return errors
// to the user.
func (ci *copyin) CopyData(ctx context.Context, line string) (r driver.Result, err error) {
	if ci.closed {
		return nil, errCopyInClosed
	}

	if finish := ci.cn.watchCancel(ctx); finish != nil {
		defer finish()
	}

	if err := ci.getBad(); err != nil {
		return nil, err
	}
	defer ci.cn.errRecover(&err)

	if err := ci.err(); err != nil {
		return nil, err
	}

	ci.buffer = append(ci.buffer, []byte(line)...)
	ci.buffer = append(ci.buffer, '\n')

	if len(ci.buffer) > ciBufferFlushSize {
		ci.flush(ci.buffer)
		// reset buffer, keep bytes for message identifier and length
		ci.buffer = ci.buffer[:5]
	}

	return driver.RowsAffected(0), nil
}

func (ci *copyin) Close() (err error) {
	if ci.closed { // Don't do anything, we're already closed
		return nil
	}
	ci.closed = true

	if err := ci.getBad(); err != nil {
		return err
	}
	defer ci.cn.errRecover(&err)

	if len(ci.buffer) > 0 {
		ci.flush(ci.buffer)
	}
	// Avoid touching the scratch buffer as resploop could be using it.
	err = ci.cn.sendSimpleMessage('c')
	if err != nil {
		return err
	}

	<-ci.done
	ci.cn.inCopy = false

	if err := ci.err(); err != nil {
		return err
	}
	return nil
}
