// Package graphite defines structures for interacting with a Graphite server.
package graphite

import (
	"encoding/json"
	"fmt"
	"io/ioutil"
	"net/http"
	"net/url"
	"strings"
	"time"
)

const requestErrFmt = "graphite RequestError (%s): %s"

// Request holds query objects. Currently only absolute times are supported.
type Request struct {
	Start   *time.Time
	End     *time.Time
	Targets []string
	URL     *url.URL
}

type Response []Series

type Series struct {
	Datapoints []DataPoint
	Target     string
}

type DataPoint []json.Number

func (r *Request) CacheKey() string {
	targets, _ := json.Marshal(r.Targets)
	return fmt.Sprintf("graphite-%d-%d-%s", r.Start.Unix(), r.End.Unix(), targets)
}

func (r *Request) Query(host string, header http.Header) (Response, error) {
	v := url.Values{
		"format": []string{"json"},
		"target": r.Targets,
	}
	if r.Start != nil {
		v.Add("from", fmt.Sprint(r.Start.Unix()))
	}
	if r.End != nil {
		v.Add("until", fmt.Sprint(r.End.Unix()))
	}
	r.URL = &url.URL{
		Scheme:   "http",
		Host:     host,
		Path:     "/render/",
		RawQuery: v.Encode(),
	}
	req, err := http.NewRequest("GET", r.URL.String(), nil)
	if err != nil {
		return nil, fmt.Errorf(requestErrFmt, r.URL, "NewRequest failed: "+err.Error())
	}
	if header != nil {
		req.Header = header
	}
	resp, err := DefaultClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf(requestErrFmt, r.URL, "Get failed: "+err.Error())
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		tb, err := readTraceback(resp)
		if err != nil {
			tb = &[]string{"<Could not read traceback: " + err.Error() + ">"}
		}
		return nil, fmt.Errorf(requestErrFmt, r.URL, fmt.Sprintf("Get failed: %s\n%s", resp.Status, strings.Join(*tb, "\n")))
	}
	var series Response
	err = json.NewDecoder(resp.Body).Decode(&series)
	if err != nil {
		e := fmt.Errorf(requestErrFmt, r.URL, "Json decode failed: "+err.Error())
		return series, e
	}
	return series, nil
}

func readTraceback(resp *http.Response) (*[]string, error) {
	bodyBytes, err := ioutil.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}
	bodyLines := strings.Split(strings.TrimSpace(string(bodyBytes)), "\n")
	var tracebackLines []string
	inTraceback := false
	for _, line := range bodyLines {
		if strings.HasPrefix(line, "Traceback") {
			inTraceback = true
		} else if inTraceback && line == "" {
			break
		}
		if inTraceback {
			tracebackLines = append(tracebackLines, line)
		}
	}
	if len(tracebackLines) == 0 {
		tracebackLines = []string{"<no traceback found in response>"}
	}
	return &tracebackLines, nil
}

// DefaultClient is the default HTTP client for requests.
var DefaultClient = &http.Client{
	Timeout: time.Minute,
}

// Context is the interface for querying a Graphite server.
type Context interface {
	Query(*Request) (Response, error)
}

// Host is a simple Graphite Context with no additional features.
type Host string

// Query performs a request to a Graphite server.
func (h Host) Query(r *Request) (Response, error) {
	return r.Query(string(h), nil)
}

type HostHeader struct {
	Host   string
	Header http.Header
}

func (h HostHeader) Query(r *Request) (Response, error) {
	return r.Query(h.Host, h.Header)
}
