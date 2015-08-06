// Package graphite defines structures for interacting with a Graphite server.
package graphite

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io/ioutil"
	"net/http"
	"net/http/httputil"
	"net/url"
	"strings"
	"sync"
	"time"

	bgraphite "bosun.org/graphite"
)

const requestErrFmt = "graphite RequestError (%s): %s"
const parseErrFmt = "graphite ParseErrors %s:\nTrace: %s"

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
	Host            string
	Header          http.Header
	lock            sync.Mutex
	Dur             time.Duration
	MissingVals     int
	EmptyResp       int
	IncompleteResp  int
	BadStart        int
	BadStep         int
	BadSteps        int
	AssertMinSeries int
	AssertStart     time.Time
	AssertStep      int
	AssertSteps     int
	Traces          []Trace
}

type Trace struct {
	Request  *bgraphite.Request
	Response []byte
}

func (t Trace) String() string {
	// mangle the response here as well to keep logstash from crashing on
	// the bare json array
	resp := bytes.Replace(t.Response, []byte("\n"), []byte("\n> "), -1)
	return fmt.Sprintf("{Request start:%s end:%s targets:%s url:%s Response:%s}", t.Request.Start, t.Request.End, t.Request.Targets, t.Request.URL, t.Response)
}

func (gc *GraphiteContext) Query(r *bgraphite.Request) (bgraphite.Response, error) {
	pre := time.Now()
	resp, res, err := Query(r, gc.Host, gc.Header)
	if err != nil {
		return res, err
	}
	errors := make([]string, 0)
	// currently I believe bosun doesn't do concurrent queries, but we should just be safe.
	gc.lock.Lock()
	defer gc.lock.Unlock()
	trace := Trace{r, resp}
	gc.Traces = append(gc.Traces, trace)

	start := gc.AssertStart.Unix()

	for _, s := range res {
		if len(s.Datapoints) != gc.AssertSteps {
			gc.BadSteps += 1
		}
		for i, p := range s.Datapoints {
			if p[0] == "" {
				gc.MissingVals += 1
			}
			unix, _ := p[1].Int64()
			if i == 0 {
				if unix != start {
					gc.BadStart += 1
				}
			} else {
				if unix != start+int64(i*gc.AssertStep) {
					gc.BadStep += 1
				}
			}
		}
	}

	// one Context might run multiple queries, we want to add all times
	gc.Dur += time.Since(pre)

	if gc.MissingVals > 0 {
		errors = append(errors, fmt.Sprintf("%d unknown values", gc.MissingVals))
	}
	if gc.BadStart > 0 {
		errors = append(errors, fmt.Sprintf("%d bad start ts", gc.BadStart))
	}
	if gc.BadStep > 0 {
		errors = append(errors, fmt.Sprintf("%d bad step", gc.BadStep))
	}
	if gc.BadSteps > 0 {
		errors = append(errors, fmt.Sprintf("%d bad num steps", gc.BadSteps))
	}

	if len(res) == 0 {
		gc.EmptyResp += 1
		errors = append(errors, "empty response")
	} else if len(res) < gc.AssertMinSeries {
		gc.IncompleteResp += 1
		errors = append(errors, fmt.Sprintf("expected >= %d series. got %d", gc.AssertMinSeries, len(res)))
	}
	if len(errors) > 0 {
		err = fmt.Errorf(parseErrFmt, errors, trace)
	}
	return res, err
}
