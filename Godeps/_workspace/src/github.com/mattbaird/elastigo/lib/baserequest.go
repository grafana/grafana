// Copyright 2013 Matthew Baird
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//     http://www.apache.org/licenses/LICENSE-2.0
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

package elastigo

import (
	"encoding/json"
	"fmt"
	"io"
	"log"
	"time"
)

func (c *Conn) DoCommand(method string, url string, args map[string]interface{}, data interface{}) ([]byte, error) {
	var response map[string]interface{}
	var body []byte
	var httpStatusCode int

	query, err := Escape(args)
	if err != nil {
		return nil, err
	}
	req, err := c.NewRequest(method, url, query)
	if err != nil {
		return body, err
	}

	if data != nil {
		switch v := data.(type) {
		case string:
			req.SetBodyString(v)
		case io.Reader:
			req.SetBody(v)
		case []byte:
			req.SetBodyBytes(v)
		default:
			err = req.SetBodyJson(v)
			if err != nil {
				return body, err
			}
		}

	}
	httpStatusCode, body, err = req.Do(&response)

	if err != nil {
		return body, err
	}
	if httpStatusCode > 304 {

		jsonErr := json.Unmarshal(body, &response)
		if jsonErr == nil {
			if res_err, ok := response["error"]; ok {
				status, _ := response["status"]
				return body, ESError{time.Now(), fmt.Sprintf("Error [%s] Status [%v]", res_err, status), httpStatusCode}
			}
		}
		return body, jsonErr
	}
	return body, nil
}

// ESError is an error implementation that includes a time, message, and code.
type ESError struct {
	When time.Time
	What string
	Code int
}

func (e ESError) Error() string {
	return fmt.Sprintf("%v: %v [%v]", e.When, e.What, e.Code)
}

// Exists allows the caller to check for the existance of a document using HEAD
// This appears to be broken in the current version of elasticsearch 0.19.10, currently
// returning nothing
func (c *Conn) Exists(index string, _type string, id string, args map[string]interface{}) (BaseResponse, error) {
	var response map[string]interface{}
	var body []byte
	var url string
	var retval BaseResponse
	var httpStatusCode int

	query, err := Escape(args)
	if err != nil {
		return retval, err
	}

	if len(_type) > 0 {
		url = fmt.Sprintf("/%s/%s/%s", index, _type, id)
	} else {
		url = fmt.Sprintf("/%s/%s", index, id)
	}
	req, err := c.NewRequest("HEAD", url, query)
	if err != nil {
		// some sort of generic error handler
	}
	httpStatusCode, body, err = req.Do(&response)
	if httpStatusCode > 304 {
		if error, ok := response["error"]; ok {
			status, _ := response["status"]
			log.Printf("Error: %v (%v)\n", error, status)
		}
	} else {
		// marshall into json
		jsonErr := json.Unmarshal(body, &retval)
		if jsonErr != nil {
			log.Println(jsonErr)
		}
	}
	return retval, err
}
