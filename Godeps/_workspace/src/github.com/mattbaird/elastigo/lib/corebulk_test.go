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
	"bytes"
	"crypto/rand"
	"encoding/json"
	"flag"
	"fmt"
	"log"
	"strconv"
	"testing"
	"time"

	"github.com/araddon/gou"
	"github.com/bmizerany/assert"
)

//  go test -bench=".*"
//  go test -bench="Bulk"

func init() {
	flag.Parse()
	if testing.Verbose() {
		gou.SetupLogging("debug")
	}
}

// take two ints, compare, need to be within 5%
func closeInt(a, b int) bool {
	c := float64(a) / float64(b)
	if c >= .95 && c <= 1.05 {
		return true
	}
	return false
}

func TestBulkIndexerBasic(t *testing.T) {
	testIndex := "users"
	var (
		buffers        = make([]*bytes.Buffer, 0)
		totalBytesSent int
		messageSets    int
	)

	InitTests(true)
	c := NewTestConn()

	c.DeleteIndex(testIndex)

	indexer := c.NewBulkIndexer(3)
	indexer.Sender = func(buf *bytes.Buffer) error {
		messageSets += 1
		totalBytesSent += buf.Len()
		buffers = append(buffers, buf)
		// log.Printf("buffer:%s", string(buf.Bytes()))
		return indexer.Send(buf)
	}
	indexer.Start()

	date := time.Unix(1257894000, 0)
	data := map[string]interface{}{
		"name": "smurfs",
		"age":  22,
		"date": "yesterday",
	}

	err := indexer.Index(testIndex, "user", "1", "", &date, data, true)

	waitFor(func() bool {
		return len(buffers) > 0
	}, 5)
	// part of request is url, so lets factor that in
	//totalBytesSent = totalBytesSent - len(*eshost)
	assert.T(t, len(buffers) == 1, fmt.Sprintf("Should have sent one operation but was %d", len(buffers)))
	assert.T(t, indexer.NumErrors() == 0 && err == nil, fmt.Sprintf("Should not have any errors. NumErrors: %v, err: %v", indexer.NumErrors(), err))
	expectedBytes := 144
	assert.T(t, totalBytesSent == expectedBytes, fmt.Sprintf("Should have sent %v bytes but was %v", expectedBytes, totalBytesSent))

	err = indexer.Index(testIndex, "user", "2", "", nil, data, true)
	<-time.After(time.Millisecond * 10) // we need to wait for doc to hit send channel
	// this will test to ensure that Flush actually catches a doc
	indexer.Flush()
	totalBytesSent = totalBytesSent - len(*eshost)
	assert.T(t, err == nil, fmt.Sprintf("Should have nil error  =%v", err))
	assert.T(t, len(buffers) == 2, fmt.Sprintf("Should have another buffer ct=%d", len(buffers)))

	assert.T(t, indexer.NumErrors() == 0, fmt.Sprintf("Should not have any errors %d", indexer.NumErrors()))
	expectedBytes = 250 // with refresh
	assert.T(t, closeInt(totalBytesSent, expectedBytes), fmt.Sprintf("Should have sent %v bytes but was %v", expectedBytes, totalBytesSent))

	indexer.Stop()
}

// currently broken in drone.io
func XXXTestBulkUpdate(t *testing.T) {
	var (
		buffers        = make([]*bytes.Buffer, 0)
		totalBytesSent int
		messageSets    int
	)

	InitTests(true)
	c := NewTestConn()
	c.Port = "9200"
	indexer := c.NewBulkIndexer(3)
	indexer.Sender = func(buf *bytes.Buffer) error {
		messageSets += 1
		totalBytesSent += buf.Len()
		buffers = append(buffers, buf)
		return indexer.Send(buf)
	}
	indexer.Start()

	date := time.Unix(1257894000, 0)
	user := map[string]interface{}{
		"name": "smurfs", "age": 22, "date": date, "count": 1,
	}

	// Lets make sure the data is in the index ...
	_, err := c.Index("users", "user", "5", nil, user)

	// script and params
	data := map[string]interface{}{
		"script": "ctx._source.count += 2",
	}
	err = indexer.Update("users", "user", "5", "", &date, data, true)
	// So here's the deal. Flushing does seem to work, you just have to give the
	// channel a moment to recieve the message ...
	//	<- time.After(time.Millisecond * 20)
	//	indexer.Flush()

	waitFor(func() bool {
		return len(buffers) > 0
	}, 5)

	indexer.Stop()

	assert.T(t, indexer.NumErrors() == 0 && err == nil, fmt.Sprintf("Should not have any errors, bulkErrorCt:%v, err:%v", indexer.NumErrors(), err))

	response, err := c.Get("users", "user", "5", nil)
	assert.T(t, err == nil, fmt.Sprintf("Should not have any errors  %v", err))
	m := make(map[string]interface{})
	json.Unmarshal([]byte(*response.Source), &m)
	newCount := m["count"]
	assert.T(t, newCount.(float64) == 3,
		fmt.Sprintf("Should have update count: %#v ... %#v", m["count"], response))
}

func TestBulkSmallBatch(t *testing.T) {
	var (
		messageSets int
	)

	InitTests(true)
	c := NewTestConn()

	date := time.Unix(1257894000, 0)
	data := map[string]interface{}{"name": "smurfs", "age": 22, "date": date}

	// Now tests small batches
	indexer := c.NewBulkIndexer(1)
	indexer.BufferDelayMax = 100 * time.Millisecond
	indexer.BulkMaxDocs = 2
	messageSets = 0
	indexer.Sender = func(buf *bytes.Buffer) error {
		messageSets += 1
		return indexer.Send(buf)
	}
	indexer.Start()
	<-time.After(time.Millisecond * 20)

	indexer.Index("users", "user", "2", "", &date, data, true)
	indexer.Index("users", "user", "3", "", &date, data, true)
	indexer.Index("users", "user", "4", "", &date, data, true)
	<-time.After(time.Millisecond * 200)
	//	indexer.Flush()
	indexer.Stop()
	assert.T(t, messageSets == 2, fmt.Sprintf("Should have sent 2 message sets %d", messageSets))

}

func TestBulkDelete(t *testing.T) {
	InitTests(true)

	c := NewTestConn()
	indexer := c.NewBulkIndexer(1)
	sentBytes := []byte{}

	indexer.Sender = func(buf *bytes.Buffer) error {
		sentBytes = append(sentBytes, buf.Bytes()...)
		return nil
	}

	indexer.Start()

	indexer.Delete("fake", "fake_type", "1", true)

	indexer.Flush()
	indexer.Stop()

	sent := string(sentBytes)

	expected := `{"delete":{"_index":"fake","_type":"fake_type","_id":"1","refresh":true}}
`
	asExpected := sent == expected
	assert.T(t, asExpected, fmt.Sprintf("Should have sent '%s' but actually sent '%s'", expected, sent))
}

func XXXTestBulkErrors(t *testing.T) {
	// lets set a bad port, and hope we get a conn refused error?
	c := NewTestConn()
	c.Port = "27845"
	defer func() {
		c.Port = "9200"
	}()
	indexer := c.NewBulkIndexerErrors(10, 1)
	indexer.Start()
	errorCt := 0
	go func() {
		for i := 0; i < 20; i++ {
			date := time.Unix(1257894000, 0)
			data := map[string]interface{}{"name": "smurfs", "age": 22, "date": date}
			indexer.Index("users", "user", strconv.Itoa(i), "", &date, data, true)
		}
	}()
	var errBuf *ErrorBuffer
	for errBuf = range indexer.ErrorChannel {
		errorCt++
		break
	}
	if errBuf.Buf.Len() > 0 {
		gou.Debug(errBuf.Err)
	}
	assert.T(t, errorCt > 0, fmt.Sprintf("ErrorCt should be > 0 %d", errorCt))
	indexer.Stop()
}

/*
BenchmarkSend	18:33:00 bulk_test.go:131: Sent 1 messages in 0 sets totaling 0 bytes
18:33:00 bulk_test.go:131: Sent 100 messages in 1 sets totaling 145889 bytes
18:33:01 bulk_test.go:131: Sent 10000 messages in 100 sets totaling 14608888 bytes
18:33:05 bulk_test.go:131: Sent 20000 messages in 99 sets totaling 14462790 bytes
   20000	    234526 ns/op

*/
func BenchmarkSend(b *testing.B) {
	InitTests(true)
	c := NewTestConn()
	b.StartTimer()
	totalBytes := 0
	sets := 0
	indexer := c.NewBulkIndexer(1)
	indexer.Sender = func(buf *bytes.Buffer) error {
		totalBytes += buf.Len()
		sets += 1
		//log.Println("got bulk")
		return indexer.Send(buf)
	}
	for i := 0; i < b.N; i++ {
		about := make([]byte, 1000)
		rand.Read(about)
		data := map[string]interface{}{"name": "smurfs", "age": 22, "date": time.Unix(1257894000, 0), "about": about}
		indexer.Index("users", "user", strconv.Itoa(i), "", nil, data, true)
	}
	log.Printf("Sent %d messages in %d sets totaling %d bytes \n", b.N, sets, totalBytes)
	if indexer.NumErrors() != 0 {
		b.Fail()
	}
}

/*
TODO:  this should be faster than above

BenchmarkSendBytes	18:33:05 bulk_test.go:169: Sent 1 messages in 0 sets totaling 0 bytes
18:33:05 bulk_test.go:169: Sent 100 messages in 2 sets totaling 292299 bytes
18:33:09 bulk_test.go:169: Sent 10000 messages in 99 sets totaling 14473800 bytes
   10000	    373529 ns/op

*/
func BenchmarkSendBytes(b *testing.B) {
	InitTests(true)
	c := NewTestConn()
	about := make([]byte, 1000)
	rand.Read(about)
	data := map[string]interface{}{"name": "smurfs", "age": 22, "date": time.Unix(1257894000, 0), "about": about}
	body, _ := json.Marshal(data)
	b.StartTimer()
	totalBytes := 0
	sets := 0
	indexer := c.NewBulkIndexer(1)
	indexer.Sender = func(buf *bytes.Buffer) error {
		totalBytes += buf.Len()
		sets += 1
		return indexer.Send(buf)
	}
	for i := 0; i < b.N; i++ {
		indexer.Index("users", "user", strconv.Itoa(i), "", nil, body, true)
	}
	log.Printf("Sent %d messages in %d sets totaling %d bytes \n", b.N, sets, totalBytes)
	if indexer.NumErrors() != 0 {
		b.Fail()
	}
}
