// Copyright 2013 Unknwon
//
// Licensed under the Apache License, Version 2.0 (the "License"): you may
// not use this file except in compliance with the License. You may obtain
// a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS, WITHOUT
// WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the
// License for the specific language governing permissions and limitations
// under the License.

package goconfig

import (
	"bufio"
	"bytes"
	"fmt"
	"io"
	"io/ioutil"
	"os"
	"path"
	"strings"
	"time"
)

// Read reads an io.Reader and returns a configuration representation.
// This representation can be queried with GetValue.
func (c *ConfigFile) read(reader io.Reader) (err error) {
	buf := bufio.NewReader(reader)

	// Handle BOM-UTF8.
	// http://en.wikipedia.org/wiki/Byte_order_mark#Representations_of_byte_order_marks_by_encoding
	mask, err := buf.Peek(3)
	if err == nil && len(mask) >= 3 &&
		mask[0] == 239 && mask[1] == 187 && mask[2] == 191 {
		buf.Read(mask)
	}

	count := 1 // Counter for auto increment.
	// Current section name.
	section := DEFAULT_SECTION
	var comments string
	// Parse line-by-line
	for {
		line, err := buf.ReadString('\n')
		line = strings.TrimSpace(line)
		lineLengh := len(line) //[SWH|+]
		if err != nil {
			if err != io.EOF {
				return err
			}

			// Reached end of file, if nothing to read then break,
			// otherwise handle the last line.
			if lineLengh == 0 {
				break
			}
		}

		// switch written for readability (not performance)
		switch {
		case lineLengh == 0: // Empty line
			continue
		case line[0] == '#' || line[0] == ';': // Comment
			// Append comments
			if len(comments) == 0 {
				comments = line
			} else {
				comments += LineBreak + line
			}
			continue
		case line[0] == '[' && line[lineLengh-1] == ']': // New sction.
			// Get section name.
			section = strings.TrimSpace(line[1 : lineLengh-1])
			// Set section comments and empty if it has comments.
			if len(comments) > 0 {
				c.SetSectionComments(section, comments)
				comments = ""
			}
			// Make section exist even though it does not have any key.
			c.SetValue(section, " ", " ")
			// Reset counter.
			count = 1
			continue
		case section == "": // No section defined so far
			return readError{ERR_BLANK_SECTION_NAME, line}
		default: // Other alternatives
			var (
				i        int
				keyQuote string
				key      string
				valQuote string
				value    string
			)
			//[SWH|+]:支持引号包围起来的字串
			if line[0] == '"' {
				if lineLengh >= 6 && line[0:3] == `"""` {
					keyQuote = `"""`
				} else {
					keyQuote = `"`
				}
			} else if line[0] == '`' {
				keyQuote = "`"
			}
			if keyQuote != "" {
				qLen := len(keyQuote)
				pos := strings.Index(line[qLen:], keyQuote)
				if pos == -1 {
					return readError{ERR_COULD_NOT_PARSE, line}
				}
				pos = pos + qLen
				i = strings.IndexAny(line[pos:], "=:")
				if i <= 0 {
					return readError{ERR_COULD_NOT_PARSE, line}
				}
				i = i + pos
				key = line[qLen:pos] //保留引号内的两端的空格
			} else {
				i = strings.IndexAny(line, "=:")
				if i <= 0 {
					return readError{ERR_COULD_NOT_PARSE, line}
				}
				key = strings.TrimSpace(line[0:i])
			}
			//[SWH|+];

			// Check if it needs auto increment.
			if key == "-" {
				key = "#" + fmt.Sprint(count)
				count++
			}

			//[SWH|+]:支持引号包围起来的字串
			lineRight := strings.TrimSpace(line[i+1:])
			lineRightLength := len(lineRight)
			firstChar := ""
			if lineRightLength >= 2 {
				firstChar = lineRight[0:1]
			}
			if firstChar == "`" {
				valQuote = "`"
			} else if lineRightLength >= 6 && lineRight[0:3] == `"""` {
				valQuote = `"""`
			}
			if valQuote != "" {
				qLen := len(valQuote)
				pos := strings.LastIndex(lineRight[qLen:], valQuote)
				if pos == -1 {
					return readError{ERR_COULD_NOT_PARSE, line}
				}
				pos = pos + qLen
				value = lineRight[qLen:pos]
			} else {
				value = strings.TrimSpace(lineRight[0:])
			}
			//[SWH|+];

			c.SetValue(section, key, value)
			// Set key comments and empty if it has comments.
			if len(comments) > 0 {
				c.SetKeyComments(section, key, comments)
				comments = ""
			}
		}

		// Reached end of file.
		if err == io.EOF {
			break
		}
	}
	return nil
}

// LoadFromData accepts raw data directly from memory
// and returns a new configuration representation.
func LoadFromData(data []byte) (c *ConfigFile, err error) {
	// Save memory data to temporary file to support further operations.
	tmpName := path.Join(os.TempDir(), "goconfig", fmt.Sprintf("%d", time.Now().Nanosecond()))
	os.MkdirAll(path.Dir(tmpName), os.ModePerm)
	if err = ioutil.WriteFile(tmpName, data, 0655); err != nil {
		return nil, err
	}

	c = newConfigFile([]string{tmpName})
	err = c.read(bytes.NewBuffer(data))
	return c, err
}

func (c *ConfigFile) loadFile(fileName string) (err error) {
	f, err := os.Open(fileName)
	if err != nil {
		return err
	}
	defer f.Close()

	return c.read(f)
}

// LoadConfigFile reads a file and returns a new configuration representation.
// This representation can be queried with GetValue.
func LoadConfigFile(fileName string, moreFiles ...string) (c *ConfigFile, err error) {
	// Append files' name together.
	fileNames := make([]string, 1, len(moreFiles)+1)
	fileNames[0] = fileName
	if len(moreFiles) > 0 {
		fileNames = append(fileNames, moreFiles...)
	}

	c = newConfigFile(fileNames)

	for _, name := range fileNames {
		if err = c.loadFile(name); err != nil {
			return nil, err
		}
	}

	return c, nil
}

// Reload reloads configuration file in case it has changes.
func (c *ConfigFile) Reload() (err error) {
	var cfg *ConfigFile
	if len(c.fileNames) == 1 {
		cfg, err = LoadConfigFile(c.fileNames[0])
	} else {
		cfg, err = LoadConfigFile(c.fileNames[0], c.fileNames[1:]...)
	}

	if err == nil {
		*c = *cfg
	}
	return err
}

// AppendFiles appends more files to ConfigFile and reload automatically.
func (c *ConfigFile) AppendFiles(files ...string) error {
	c.fileNames = append(c.fileNames, files...)
	return c.Reload()
}

// readError occurs when read configuration file with wrong format.
type readError struct {
	Reason  ParseError
	Content string // Line content
}

// Error implement Error interface.
func (err readError) Error() string {
	switch err.Reason {
	case ERR_BLANK_SECTION_NAME:
		return "empty section name not allowed"
	case ERR_COULD_NOT_PARSE:
		return fmt.Sprintf("could not parse line: %s", string(err.Content))
	}
	return "invalid read error"
}
