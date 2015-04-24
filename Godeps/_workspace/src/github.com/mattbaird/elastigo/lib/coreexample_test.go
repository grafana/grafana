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

package elastigo_test

import (
	"bytes"
	"fmt"
	elastigo "github.com/mattbaird/elastigo/lib"
	"strconv"
)

// The simplest usage of background bulk indexing
func ExampleBulkIndexer_simple() {
	c := elastigo.NewConn()

	indexer := c.NewBulkIndexerErrors(10, 60)
	indexer.Start()
	indexer.Index("twitter", "user", "1", "", nil, `{"name":"bob"}`, true)
	indexer.Stop()
}

// The inspecting the response
func ExampleBulkIndexer_responses() {
	c := elastigo.NewConn()

	indexer := c.NewBulkIndexer(10)
	// Create a custom Sender Func, to allow inspection of response/error
	indexer.Sender = func(buf *bytes.Buffer) error {
		// @buf is the buffer of docs about to be written
		respJson, err := c.DoCommand("POST", "/_bulk", nil, buf)
		if err != nil {
			// handle it better than this
			fmt.Println(string(respJson))
		}
		return err
	}
	indexer.Start()
	for i := 0; i < 20; i++ {
		indexer.Index("twitter", "user", strconv.Itoa(i), "", nil, `{"name":"bob"}`, true)
	}
	indexer.Stop()
}
