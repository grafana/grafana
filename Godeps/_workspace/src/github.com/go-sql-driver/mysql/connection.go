// Go MySQL Driver - A MySQL-Driver for Go's database/sql package
//
// Copyright 2012 The Go-MySQL-Driver Authors. All rights reserved.
//
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this file,
// You can obtain one at http://mozilla.org/MPL/2.0/.

package mysql

import (
	"crypto/tls"
	"database/sql/driver"
	"errors"
	"net"
	"strings"
	"time"
)

type mysqlConn struct {
	buf              buffer
	netConn          net.Conn
	affectedRows     uint64
	insertId         uint64
	cfg              *config
	maxPacketAllowed int
	maxWriteSize     int
	flags            clientFlag
	sequence         uint8
	parseTime        bool
	strict           bool
}

type config struct {
	user              string
	passwd            string
	net               string
	addr              string
	dbname            string
	params            map[string]string
	loc               *time.Location
	tls               *tls.Config
	timeout           time.Duration
	collation         uint8
	allowAllFiles     bool
	allowOldPasswords bool
	clientFoundRows   bool
}

// Handles parameters set in DSN after the connection is established
func (mc *mysqlConn) handleParams() (err error) {
	for param, val := range mc.cfg.params {
		switch param {
		// Charset
		case "charset":
			charsets := strings.Split(val, ",")
			for i := range charsets {
				// ignore errors here - a charset may not exist
				err = mc.exec("SET NAMES " + charsets[i])
				if err == nil {
					break
				}
			}
			if err != nil {
				return
			}

		// time.Time parsing
		case "parseTime":
			var isBool bool
			mc.parseTime, isBool = readBool(val)
			if !isBool {
				return errors.New("Invalid Bool value: " + val)
			}

		// Strict mode
		case "strict":
			var isBool bool
			mc.strict, isBool = readBool(val)
			if !isBool {
				return errors.New("Invalid Bool value: " + val)
			}

		// Compression
		case "compress":
			err = errors.New("Compression not implemented yet")
			return

		// System Vars
		default:
			err = mc.exec("SET " + param + "=" + val + "")
			if err != nil {
				return
			}
		}
	}

	return
}

func (mc *mysqlConn) Begin() (driver.Tx, error) {
	if mc.netConn == nil {
		errLog.Print(ErrInvalidConn)
		return nil, driver.ErrBadConn
	}
	err := mc.exec("START TRANSACTION")
	if err == nil {
		return &mysqlTx{mc}, err
	}

	return nil, err
}

func (mc *mysqlConn) Close() (err error) {
	// Makes Close idempotent
	if mc.netConn != nil {
		err = mc.writeCommandPacket(comQuit)
		if err == nil {
			err = mc.netConn.Close()
		} else {
			mc.netConn.Close()
		}
		mc.netConn = nil
	}

	mc.cfg = nil
	mc.buf.rd = nil

	return
}

func (mc *mysqlConn) Prepare(query string) (driver.Stmt, error) {
	if mc.netConn == nil {
		errLog.Print(ErrInvalidConn)
		return nil, driver.ErrBadConn
	}
	// Send command
	err := mc.writeCommandPacketStr(comStmtPrepare, query)
	if err != nil {
		return nil, err
	}

	stmt := &mysqlStmt{
		mc: mc,
	}

	// Read Result
	columnCount, err := stmt.readPrepareResultPacket()
	if err == nil {
		if stmt.paramCount > 0 {
			if err = mc.readUntilEOF(); err != nil {
				return nil, err
			}
		}

		if columnCount > 0 {
			err = mc.readUntilEOF()
		}
	}

	return stmt, err
}

func (mc *mysqlConn) Exec(query string, args []driver.Value) (driver.Result, error) {
	if mc.netConn == nil {
		errLog.Print(ErrInvalidConn)
		return nil, driver.ErrBadConn
	}
	if len(args) == 0 { // no args, fastpath
		mc.affectedRows = 0
		mc.insertId = 0

		err := mc.exec(query)
		if err == nil {
			return &mysqlResult{
				affectedRows: int64(mc.affectedRows),
				insertId:     int64(mc.insertId),
			}, err
		}
		return nil, err
	}

	// with args, must use prepared stmt
	return nil, driver.ErrSkip

}

// Internal function to execute commands
func (mc *mysqlConn) exec(query string) error {
	// Send command
	err := mc.writeCommandPacketStr(comQuery, query)
	if err != nil {
		return err
	}

	// Read Result
	resLen, err := mc.readResultSetHeaderPacket()
	if err == nil && resLen > 0 {
		if err = mc.readUntilEOF(); err != nil {
			return err
		}

		err = mc.readUntilEOF()
	}

	return err
}

func (mc *mysqlConn) Query(query string, args []driver.Value) (driver.Rows, error) {
	if mc.netConn == nil {
		errLog.Print(ErrInvalidConn)
		return nil, driver.ErrBadConn
	}
	if len(args) == 0 { // no args, fastpath
		// Send command
		err := mc.writeCommandPacketStr(comQuery, query)
		if err == nil {
			// Read Result
			var resLen int
			resLen, err = mc.readResultSetHeaderPacket()
			if err == nil {
				rows := new(textRows)
				rows.mc = mc

				if resLen == 0 {
					// no columns, no more data
					return emptyRows{}, nil
				}
				// Columns
				rows.columns, err = mc.readColumns(resLen)
				return rows, err
			}
		}
		return nil, err
	}

	// with args, must use prepared stmt
	return nil, driver.ErrSkip
}

// Gets the value of the given MySQL System Variable
// The returned byte slice is only valid until the next read
func (mc *mysqlConn) getSystemVar(name string) ([]byte, error) {
	// Send command
	if err := mc.writeCommandPacketStr(comQuery, "SELECT @@"+name); err != nil {
		return nil, err
	}

	// Read Result
	resLen, err := mc.readResultSetHeaderPacket()
	if err == nil {
		rows := new(textRows)
		rows.mc = mc

		if resLen > 0 {
			// Columns
			if err := mc.readUntilEOF(); err != nil {
				return nil, err
			}
		}

		dest := make([]driver.Value, resLen)
		if err = rows.readRow(dest); err == nil {
			return dest[0].([]byte), mc.readUntilEOF()
		}
	}
	return nil, err
}
