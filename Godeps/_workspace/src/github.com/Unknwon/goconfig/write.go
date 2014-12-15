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
	"bytes"
	"os"
	"strings"
)

// Write spaces around "=" to look better.
var PrettyFormat = true

// SaveConfigFile writes configuration file to local file system
func SaveConfigFile(c *ConfigFile, filename string) (err error) {
	// Write configuration file by filename.
	var f *os.File
	if f, err = os.Create(filename); err != nil {
		return err
	}

	equalSign := "="
	if PrettyFormat {
		equalSign = " = "
	}

	buf := bytes.NewBuffer(nil)
	for _, section := range c.sectionList {
		// Write section comments.
		if len(c.GetSectionComments(section)) > 0 {
			if _, err = buf.WriteString(c.GetSectionComments(section) + LineBreak); err != nil {
				return err
			}
		}

		if section != DEFAULT_SECTION {
			// Write section name.
			if _, err = buf.WriteString("[" + section + "]" + LineBreak); err != nil {
				return err
			}
		}

		for _, key := range c.keyList[section] {
			if key != " " {
				// Write key comments.
				if len(c.GetKeyComments(section, key)) > 0 {
					if _, err = buf.WriteString(c.GetKeyComments(section, key) + LineBreak); err != nil {
						return err
					}
				}

				keyName := key
				// Check if it's auto increment.
				if keyName[0] == '#' {
					keyName = "-"
				}
				//[SWH|+]:支持键名包含等号和冒号
				if strings.Contains(keyName, `=`) || strings.Contains(keyName, `:`) {
					if strings.Contains(keyName, "`") {
						if strings.Contains(keyName, `"`) {
							keyName = `"""` + keyName + `"""`
						} else {
							keyName = `"` + keyName + `"`
						}
					} else {
						keyName = "`" + keyName + "`"
					}
				}
				value := c.data[section][key]
				// In case key value contains "`" or "\"".
				if strings.Contains(value, "`") {
					if strings.Contains(value, `"`) {
						value = `"""` + value + `"""`
					} else {
						value = `"` + value + `"`
					}
				}

				// Write key and value.
				if _, err = buf.WriteString(keyName + equalSign + value + LineBreak); err != nil {
					return err
				}
			}
		}

		// Put a line between sections.
		if _, err = buf.WriteString(LineBreak); err != nil {
			return err
		}
	}

	if _, err = buf.WriteTo(f); err != nil {
		return err
	}
	return f.Close()
}
