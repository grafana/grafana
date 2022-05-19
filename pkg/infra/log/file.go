// Copyright 2014 The Gogs Authors. All rights reserved.
// Use of this source code is governed by a MIT-style
// license that can be found in the LICENSE file.

package log

import (
	"bytes"
	"errors"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"

	"github.com/go-kit/log"
)

// FileLogWriter implements LoggerInterface.
// It writes messages by lines limit, file size limit, or time frequency.
type FileLogWriter struct {
	Format           Formatedlogger
	Filename         string
	Maxlines         int
	maxlinesCurlines int

	// Rotate at size
	Maxsize        int
	maxsizeCursize int

	// Rotate daily
	Daily         bool
	Maxdays       int64
	dailyOpendate int

	Rotate    bool
	startLock sync.Mutex
	logger    log.Logger
	sync.Mutex
	fd *os.File
}

// write to os.File.
func (w *FileLogWriter) Write(b []byte) (int, error) {
	w.docheck(len(b))
	w.Lock()
	defer w.Unlock()
	return w.fd.Write(b)
}

// set os.File in writer.
func (w *FileLogWriter) setFD(fd *os.File) error {
	if w.fd != nil {
		if err := w.fd.Close(); err != nil && !errors.Is(err, os.ErrClosed) {
			return fmt.Errorf("closing old file in MuxWriter failed: %w", err)
		}
	}

	w.fd = fd
	return nil
}

// create a FileLogWriter returning as LoggerInterface.
func NewFileWriter() *FileLogWriter {
	w := &FileLogWriter{
		Filename: "",
		Format: func(w io.Writer) log.Logger {
			return log.NewLogfmtLogger(w)
		},
		Maxlines: 1000000,
		Maxsize:  1 << 28, // 256 MB
		Daily:    true,
		Maxdays:  7,
		Rotate:   true,
	}
	return w
}

func (w *FileLogWriter) Log(keyvals ...interface{}) error {
	return w.logger.Log(keyvals...)
}

func (w *FileLogWriter) Init() error {
	if len(w.Filename) == 0 {
		return errors.New("config must have filename")
	}
	if err := w.StartLogger(); err != nil {
		return err
	}
	w.logger = w.Format(log.NewSyncWriter(w))
	return nil
}

// start file logger. create log file and set to locker-inside file writer.
func (w *FileLogWriter) StartLogger() error {
	fd, err := w.createLogFile()
	if err != nil {
		return err
	}
	if err := w.setFD(fd); err != nil {
		return err
	}

	return w.initFd()
}

func (w *FileLogWriter) docheck(size int) {
	w.startLock.Lock()
	defer w.startLock.Unlock()

	if w.Rotate && ((w.Maxlines > 0 && w.maxlinesCurlines >= w.Maxlines) ||
		(w.Maxsize > 0 && w.maxsizeCursize >= w.Maxsize) ||
		(w.Daily && time.Now().Day() != w.dailyOpendate)) {
		if err := w.DoRotate(); err != nil {
			fmt.Fprintf(os.Stderr, "FileLogWriter(%q): %s\n", w.Filename, err)
			return
		}
	}
	w.maxlinesCurlines++
	w.maxsizeCursize += size
}

func (w *FileLogWriter) createLogFile() (*os.File, error) {
	// Open the log file
	// We can ignore G304 here since we can't unconditionally lock these log files down to be readable only
	// by the owner
	// nolint:gosec
	return os.OpenFile(w.Filename, os.O_WRONLY|os.O_APPEND|os.O_CREATE, 0644)
}

func (w *FileLogWriter) lineCounter() (int, error) {
	r, err := os.Open(w.Filename)
	if err != nil {
		return 0, fmt.Errorf("failed to open file %q: %w", w.Filename, err)
	}

	buf := make([]byte, 32*1024)
	count := 0
	for {
		c, err := r.Read(buf)
		if err != nil {
			if errors.Is(err, io.EOF) {
				if err := r.Close(); err != nil && !errors.Is(err, os.ErrClosed) {
					return 0, fmt.Errorf("closing %q failed: %w", w.Filename, err)
				}
				return count, nil
			}

			return 0, err
		}

		count += bytes.Count(buf[:c], []byte{'\n'})
	}
}

func (w *FileLogWriter) initFd() error {
	fd := w.fd
	finfo, err := fd.Stat()
	if err != nil {
		return fmt.Errorf("get stat: %s", err)
	}
	w.maxsizeCursize = int(finfo.Size())
	w.dailyOpendate = time.Now().Day()
	if finfo.Size() > 0 {
		count, err := w.lineCounter()
		if err != nil {
			return err
		}
		w.maxlinesCurlines = count
	} else {
		w.maxlinesCurlines = 0
	}
	return nil
}

// DoRotate means it need to write file in new file.
// new file name like xx.log.2013-01-01.2
func (w *FileLogWriter) DoRotate() error {
	_, err := os.Lstat(w.Filename)
	if err == nil { // file exists
		// Find the next available number
		num := 1
		fname := ""
		for ; err == nil && num <= 999; num++ {
			fname = w.Filename + fmt.Sprintf(".%s.%03d", time.Now().Format("2006-01-02"), num)
			_, err = os.Lstat(fname)
		}
		// return error if the last file checked still existed
		if err == nil {
			return fmt.Errorf("rotate: cannot find free log number to rename %s", w.Filename)
		}

		// block Logger's io.Writer
		w.Lock()
		defer w.Unlock()

		fd := w.fd
		if err := fd.Close(); err != nil {
			return err
		}

		// close fd before rename
		// Rename the file to its newfound home
		if err = os.Rename(w.Filename, fname); err != nil {
			return fmt.Errorf("rotate: %s", err)
		}

		// re-start logger
		if err = w.StartLogger(); err != nil {
			return fmt.Errorf("rotate StartLogger: %s", err)
		}

		go w.deleteOldLog()
	}

	return nil
}

func (w *FileLogWriter) deleteOldLog() {
	dir := filepath.Dir(w.Filename)
	err := filepath.Walk(dir, func(path string, info os.FileInfo, err error) (returnErr error) {
		defer func() {
			if r := recover(); r != nil {
				returnErr = fmt.Errorf("unable to delete old log '%s', error: %+v", path, r)
			}
		}()

		if !info.IsDir() && info.ModTime().Unix() < (time.Now().Unix()-60*60*24*w.Maxdays) &&
			strings.HasPrefix(filepath.Base(path), filepath.Base(w.Filename)) {
			returnErr = os.Remove(path)
			return
		}
		return
	})
	if err != nil {
		fmt.Fprintf(os.Stderr, "FileLogWriter(%q): %s\n", w.Filename, err)
	}
}

// destroy file logger, close file writer.
func (w *FileLogWriter) Close() error {
	return w.fd.Close()
}

// flush file logger.
// there are no buffering messages in file logger in memory.
// flush file means sync file from disk.
func (w *FileLogWriter) Flush() {
	if err := w.fd.Sync(); err != nil {
		fmt.Fprintf(os.Stderr, "FileLogWriter(%q): %s\n", w.Filename, err)
	}
}

// Reload file logger
func (w *FileLogWriter) Reload() error {
	// block Logger's io.Writer
	w.Lock()
	defer w.Unlock()

	// Close
	fd := w.fd
	if err := fd.Close(); err != nil {
		return err
	}

	// Open again
	err := w.StartLogger()
	if err != nil {
		return err
	}

	return nil
}
