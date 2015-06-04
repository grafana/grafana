// Copyright 2012-2015 Oliver Eilhard. All rights reserved.
// Use of this source code is governed by a MIT-license.
// See http://olivere.mit-license.org/license.txt for details.

package elastic

import (
	"bytes"
	"encoding/json"
	"io"
	"io/ioutil"
	"net/http"
	"runtime"
	"strings"
)

// Elasticsearch-specific HTTP request
type Request http.Request

func NewRequest(method, url string) (*Request, error) {
	req, err := http.NewRequest(method, url, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Add("User-Agent", "elastic/"+Version+" ("+runtime.GOOS+"-"+runtime.GOARCH+")")
	req.Header.Add("Accept", "application/json")
	return (*Request)(req), nil
}

func (r *Request) SetBodyJson(data interface{}) error {
	body, err := json.Marshal(data)
	if err != nil {
		return err
	}
	r.SetBody(bytes.NewReader(body))
	r.Header.Set("Content-Type", "application/json")
	return nil
}

func (r *Request) SetBodyString(body string) error {
	return r.SetBody(strings.NewReader(body))
}

func (r *Request) SetBody(body io.Reader) error {
	rc, ok := body.(io.ReadCloser)
	if !ok && body != nil {
		rc = ioutil.NopCloser(body)
	}
	r.Body = rc
	if body != nil {
		switch v := body.(type) {
		case *strings.Reader:
			r.ContentLength = int64(v.Len())
		case *bytes.Buffer:
			r.ContentLength = int64(v.Len())
		}
	}
	return nil
}
