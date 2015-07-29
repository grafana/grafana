// Package graphite defines structures for interacting with a Graphite server.
package graphite

import (
	"encoding/json"
	"fmt"
	"io/ioutil"
	"net/http"
	"net/http/httputil"
	"net/url"
	"strings"
	"sync"
	"time"

	"github.com/Unknwon/log"

	bgraphite "bosun.org/graphite"
)

const requestErrFmt = "graphite RequestError (%s): %s"

// Query performs a request to Graphite at the given host. host specifies
// a hostname with optional port, and may optionally begin with a scheme
// (http, https) to specify the protocol (http is the default). header is
// the headers to send.
func Query(r *bgraphite.Request, host string, header http.Header) ([]byte, bgraphite.Response, error) {
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
	if u, _ := url.Parse(host); u.Scheme != "" && u.Host != "" {
		r.URL.Scheme = u.Scheme
		r.URL.Host = u.Host
		if u.Path != "" {
			r.URL.Path = u.Path
		}
	}
	req, err := http.NewRequest("GET", r.URL.String(), nil)
	if err != nil {
		return nil, nil, fmt.Errorf(requestErrFmt, r.URL, "NewRequest failed: "+err.Error())
	}
	if header != nil {
		req.Header = header
	}
	resp, err := DefaultClient.Do(req)
	if err != nil {
		return nil, nil, fmt.Errorf(requestErrFmt, r.URL, "Get failed: "+err.Error())
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		tb, err := readTraceback(resp)
		if err != nil {
			tb = &[]string{"<Could not read traceback: " + err.Error() + ">"}
		}
		return nil, nil, fmt.Errorf(requestErrFmt, r.URL, fmt.Sprintf("Get failed: %s\n%s", resp.Status, strings.Join(*tb, "\n")))
	}
	var series bgraphite.Response
	dump, err := httputil.DumpResponse(resp, true)
	if err != nil {
		e := fmt.Errorf(requestErrFmt, r.URL, "Reading HTTP response failed: "+err.Error())
		return nil, series, e
	}

	err = json.NewDecoder(resp.Body).Decode(&series)

	if err != nil {
		e := fmt.Errorf(requestErrFmt, r.URL, "Json decode failed: "+err.Error())
		return dump, series, e
	}
	return dump, series, nil
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

type GraphiteContext struct {
	Host        string
	Header      http.Header
	lock        sync.Mutex
	Dur         time.Duration
	MissingVals int
	EmptyResp   int
	Response    []byte
}

func (gc *GraphiteContext) Query(r *bgraphite.Request) (bgraphite.Response, error) {
	pre := time.Now()
	resp, res, err := Query(r, gc.Host, gc.Header)
	if err != nil {
		return res, err
	}
	gc.Response = resp
	log.Debug("graphite request for %q from %s to %s yielded response: %q", r.Targets, r.Start, r.End, resp)
	// currently I believe bosun doesn't do concurrent queries, but we should just be safe.
	gc.lock.Lock()
	defer gc.lock.Unlock()
	for _, s := range res {
		for _, p := range s.Datapoints {
			if p[0] == "" {
				gc.MissingVals += 1
			}
		}
	}

	// one Context might run multiple queries, we want to add all times
	gc.Dur += time.Since(pre)
	if gc.MissingVals > 0 {
		return res, fmt.Errorf("GraphiteContext saw %d unknown values returned from server", gc.MissingVals)
	}
	// TODO: find a way to verify the entire response, or at least the number of points.
	if len(res) == 0 {
		gc.EmptyResp += 1
		return res, fmt.Errorf("GraphiteContext got an empty response")
	}
	return res, err
}
