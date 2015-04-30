package util

import (
	"bufio"
	"bytes"
	"errors"
	"io"
	"os"
	"os/exec"
	"time"

	"bosun.org/slog"
)

var (
	// ErrPath is returned by Command if the program is not in the PATH.
	ErrPath = errors.New("program not in PATH")
	// ErrTimeout is returned by Command if the program timed out.
	ErrTimeout = errors.New("program killed after timeout")

	// Debug enables debug logging.
	Debug = false
)

// Command executes the named program with the given arguments. If it does not
// exit within timeout, it is sent SIGINT (if supported by Go). After
// another timeout, it is killed.
func Command(timeout time.Duration, stdin io.Reader, name string, arg ...string) (io.Reader, error) {
	if _, err := exec.LookPath(name); err != nil {
		return nil, ErrPath
	}
	if Debug {
		slog.Infof("executing command: %v %v", name, arg)
	}
	c := exec.Command(name, arg...)
	var b bytes.Buffer
	c.Stdout = &b
	c.Stdin = stdin
	done := make(chan error, 1)
	go func() {
		done <- c.Run()
	}()
	interrupt := time.After(timeout)
	kill := time.After(timeout * 2)
	for {
		select {
		case err := <-done:
			return &b, err
		case <-interrupt:
			c.Process.Signal(os.Interrupt)
		case <-kill:
			// todo: figure out if this can leave the done chan hanging open
			c.Process.Kill()
			return nil, ErrTimeout
		}
	}
}

// ReadCommand runs command name with args and calls line for each line from its
// stdout. Command is interrupted (if supported by Go) after 10 seconds and
// killed after 20 seconds.
func ReadCommand(line func(string) error, name string, arg ...string) error {
	return ReadCommandTimeout(time.Second*10, line, nil, name, arg...)
}

// ReadCommandTimeout is the same as ReadCommand with a specifiable timeout.
// It can also take a []byte as input (useful for chaining commands).
func ReadCommandTimeout(timeout time.Duration, line func(string) error, stdin io.Reader, name string, arg ...string) error {
	b, err := Command(timeout, stdin, name, arg...)
	if err != nil {
		return err
	}
	scanner := bufio.NewScanner(b)
	for scanner.Scan() {
		if err := line(scanner.Text()); err != nil {
			return err
		}
	}
	if err := scanner.Err(); err != nil {
		slog.Infof("%v: %v\n", name, err)
	}
	return nil
}
