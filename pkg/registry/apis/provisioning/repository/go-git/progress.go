package gogit

import (
	"bufio"
	"bytes"
	"io"
)

func Progress(lines func(line string), final string) io.WriteCloser {
	reader, writer := io.Pipe()
	scanner := bufio.NewScanner(reader)
	scanner.Split(scanLines)
	go func() {
		for scanner.Scan() {
			line := scanner.Text()
			if line != "" {
				lines(line)
			}
		}
		lines(final)
	}()
	return writer
}

// Copied from bufio.ScanLines and modifed to accept standalone \r as input
func scanLines(data []byte, atEOF bool) (advance int, token []byte, err error) {
	if atEOF && len(data) == 0 {
		return 0, nil, nil
	}
	if i := bytes.IndexByte(data, '\r'); i >= 0 {
		// We have a full newline-terminated line.
		return i + 1, data[0:i], nil
	}

	// Support standalone newlines also
	if i := bytes.IndexByte(data, '\n'); i >= 0 {
		// We have a full newline-terminated line.
		return i + 1, data[0:i], nil
	}

	// If we're at EOF, we have a final, non-terminated line. Return it.
	if atEOF {
		return len(data), data, nil
	}
	// Request more data.
	return 0, nil, nil
}
