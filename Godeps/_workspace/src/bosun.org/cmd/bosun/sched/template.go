package sched

import (
	"bytes"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"html/template"
	"io/ioutil"
	"math"
	"net/http"
	"net/url"
	"strings"
	"time"

	"bosun.org/cmd/bosun/conf"
	"bosun.org/cmd/bosun/expr"
	"bosun.org/cmd/bosun/expr/parse"
	"bosun.org/opentsdb"
)

type Context struct {
	*State
	Alert   *conf.Alert
	IsEmail bool

	schedule    *Schedule
	runHistory  *RunHistory
	Attachments []*conf.Attachment
}

func (s *Schedule) Data(rh *RunHistory, st *State, a *conf.Alert, isEmail bool) *Context {
	c := Context{
		State:      st,
		Alert:      a,
		IsEmail:    isEmail,
		schedule:   s,
		runHistory: rh,
	}
	return &c
}

type unknownContext struct {
	Time  time.Time
	Name  string
	Group expr.AlertKeys

	schedule *Schedule
}

func (s *Schedule) unknownData(t time.Time, name string, group expr.AlertKeys) *unknownContext {
	return &unknownContext{
		Time:     t,
		Group:    group,
		Name:     name,
		schedule: s,
	}
}

// Ack returns the URL to acknowledge an alert.
func (c *Context) Ack() string {
	return c.makeLink("/action", &url.Values{
		"type": []string{"ack"},
		"key":  []string{c.Alert.Name + c.State.Group.String()},
	})
}

// HostView returns the URL to the host view page.
func (c *Context) HostView(host string) string {
	return c.makeLink("/host", &url.Values{
		"time": []string{"1d-ago"},
		"host": []string{host},
	})
}

func (c *Context) makeLink(path string, v *url.Values) string {
	u := url.URL{
		Scheme:   "http",
		Host:     c.schedule.Conf.Hostname,
		Path:     path,
		RawQuery: v.Encode(),
	}
	return u.String()
}

func (c *Context) Expr(v string) string {
	p := url.Values{}
	p.Add("expr", base64.StdEncoding.EncodeToString([]byte(opentsdb.ReplaceTags(v, c.Group))))
	return c.makeLink("/expr", &p)
}

func (c *Context) Rule() (string, error) {
	p := url.Values{}
	//There might be something better when we tie the notifications to evaluation time issue #395
	time := time.Now().UTC()
	p.Add("alert", c.Alert.Name)
	p.Add("fromDate", time.Format("2006-01-02"))
	p.Add("fromTime", time.Format("15:04"))
	p.Add("template_group", c.Group.Tags())
	return c.makeLink("/config", &p), nil
}

func (s *Schedule) ExecuteBody(rh *RunHistory, a *conf.Alert, st *State, isEmail bool) ([]byte, []*conf.Attachment, error) {
	t := a.Template
	if t == nil || t.Body == nil {
		return nil, nil, nil
	}
	c := s.Data(rh, st, a, isEmail)
	buf := new(bytes.Buffer)
	err := t.Body.Execute(buf, c)
	return buf.Bytes(), c.Attachments, err
}

func (s *Schedule) ExecuteSubject(rh *RunHistory, a *conf.Alert, st *State, isEmail bool) ([]byte, error) {
	t := a.Template
	if t == nil || t.Subject == nil {
		return nil, nil
	}
	buf := new(bytes.Buffer)
	err := t.Subject.Execute(buf, s.Data(rh, st, a, isEmail))
	return bytes.Join(bytes.Fields(buf.Bytes()), []byte(" ")), err
}

var error_body = template.Must(template.New("body_error_template").Parse(`
	<p>There was a runtime error processing alert {{.State.AlertKey}} using the {{.Alert.Template.Name}} template. The following errors occurred:</p>
	{{if .Serr}}
		<p>Subject: {{.Serr}}</p>
	{{end}}
	{{if .Berr}}
		<p>Body: {{.Berr}}</p>
	{{end}}
	<p>Use <a href="{{.Rule}}">this link</a> to the rule page to correct this.</p>
	<h2>Generic Alert Information</h2>
	<p>Status: {{.Last.Status}}</p>
	<p>Alert: {{.State.AlertKey}}</p>
	<h3>Computations</h3>
	<table>
		<tr>
			<th style="text-align:left">Expression</th>
			<th style="text-align:left">Value</th>
		</tr>
	{{range .Computations}}
		<tr>
			<td style="text-align:left">{{.Text}}</td>
			<td style="text-align:left">{{.Value}}</td>
		</tr>
	{{end}}</table>`))

func (s *Schedule) ExecuteBadTemplate(s_err, b_err error, rh *RunHistory, a *conf.Alert, st *State) (subject, body []byte, err error) {
	sub := "error: template rendering error in the "
	if s_err != nil {
		sub += "subject"
	}
	if s_err != nil && b_err != nil {
		sub += " and "
	}
	if b_err != nil {
		sub += "body"
	}
	sub += fmt.Sprintf(" for alert %v", st.AlertKey())
	c := struct {
		Serr, Berr error
		*Context
	}{
		Serr:    s_err,
		Berr:    b_err,
		Context: s.Data(rh, st, a, true),
	}
	buf := new(bytes.Buffer)
	error_body.Execute(buf, c)
	return []byte(sub), buf.Bytes(), nil
}

func (c *Context) evalExpr(e *expr.Expr, filter bool, series bool, autods int) (expr.ResultSlice, string, error) {
	var err error
	if filter {
		e, err = expr.New(opentsdb.ReplaceTags(e.Text, c.State.Group), c.schedule.Conf.Funcs())
		if err != nil {
			return nil, "", err
		}
	}
	if series && e.Root.Return() != parse.TypeSeries {
		return nil, "", fmt.Errorf("need a series, got %T (%v)", e, e)
	}
	res, _, err := e.Execute(c.runHistory.Context, c.runHistory.GraphiteContext, c.runHistory.Logstash, c.runHistory.Cache, nil, c.runHistory.Start, autods, c.Alert.UnjoinedOK, c.schedule.Search, c.schedule.Conf.AlertSquelched(c.Alert), c.runHistory)
	if err != nil {
		return nil, "", fmt.Errorf("%s: %v", e, err)
	}
	return res.Results, e.String(), nil
}

// eval takes an expression or string (which it turns into an expression), executes it and returns the result.
// It can also takes a ResultSlice so callers can transparantly handle different inputs.
// The filter argument constrains the result to matching tags in the current context.
// The series argument asserts that the result is a time series.
func (c *Context) eval(v interface{}, filter bool, series bool, autods int) (res expr.ResultSlice, title string, err error) {
	switch v := v.(type) {
	case string:
		e, err := expr.New(v, c.schedule.Conf.Funcs())
		if err != nil {
			return nil, "", fmt.Errorf("%s: %v", v, err)
		}
		res, title, err = c.evalExpr(e, filter, series, autods)
	case *expr.Expr:
		res, title, err = c.evalExpr(v, filter, series, autods)
	case expr.ResultSlice:
		res = v
	default:
		return nil, "", fmt.Errorf("expected string, expression or resultslice, got %T (%v)", v, v)
	}
	if filter {
		res = res.Filter(c.State.Group)
	}
	if series {
		for _, k := range res {
			if k.Type() != parse.TypeSeries {
				return nil, "", fmt.Errorf("need a series, got %v (%v)", k.Type(), k)
			}
		}
	}
	return
}

// Lookup returns the value for a key in the lookup table for the context's tagset.
func (c *Context) Lookup(table, key string) (string, error) {
	return c.LookupAll(table, key, c.Group)
}

func (c *Context) LookupAll(table, key string, group interface{}) (string, error) {
	var t opentsdb.TagSet
	switch v := group.(type) {
	case string:
		var err error
		t, err = opentsdb.ParseTags(v)
		if err != nil {
			return "", err
		}
	case opentsdb.TagSet:
		t = v
	}
	l, ok := c.schedule.Conf.Lookups[table]
	if !ok {
		return "", fmt.Errorf("unknown lookup table %v", table)
	}
	if v, ok := l.ToExpr().Get(key, t); ok {
		return v, nil
	}
	return "", fmt.Errorf("no entry for key %v in table %v for tagset %v", key, table, c.Group)
}

// Eval takes a result or an expression which it evaluates to a result.
// It returns a value with tags corresponding to the context's tags.
// If no such result is found, the first result with
// nil tags is returned. If no such result is found, nil is returned.
func (c *Context) Eval(v interface{}) (interface{}, error) {
	res, _, err := c.eval(v, true, false, 0)
	if err != nil {
		return nil, err
	}
	if len(res) == 0 {
		return nil, fmt.Errorf("no results returned")
	}
	// TODO: don't choose a random result, make sure there's exactly 1
	return res[0].Value, nil
}

// EvalAll returns the executed expression (or the given result as is).
func (c *Context) EvalAll(v interface{}) (interface{}, error) {
	res, _, err := c.eval(v, false, false, 0)
	return res, err
}

func (c *Context) graph(v interface{}, filter bool) (interface{}, error) {
	res, title, err := c.eval(v, filter, true, 1000)
	if err != nil {
		return nil, err
	}
	var buf bytes.Buffer
	const width = 800
	const height = 600
	if c.IsEmail {
		err := c.schedule.ExprPNG(nil, &buf, width, height, res, title, c.runHistory.Start)
		if err != nil {
			return nil, err
		}
		name := fmt.Sprintf("%d.png", len(c.Attachments)+1)
		c.Attachments = append(c.Attachments, &conf.Attachment{
			Data:        buf.Bytes(),
			Filename:    name,
			ContentType: "image/png",
		})
		return template.HTML(fmt.Sprintf(`<img alt="%s" src="cid:%s" />`,
			template.HTMLEscapeString(fmt.Sprint(v)),
			name,
		)), nil
	}
	if err := c.schedule.ExprSVG(nil, &buf, width, height, res, title, time.Now().UTC()); err != nil {
		return nil, err
	}
	return template.HTML(buf.String()), nil
}

// Graph returns an SVG for the given result (or expression, for which it gets the result)
// with same tags as the context's tags.
func (c *Context) Graph(v interface{}) (interface{}, error) {
	return c.graph(v, true)
}

// GraphAll returns an SVG for the given result (or expression, for which it gets the result).
func (c *Context) GraphAll(v interface{}) (interface{}, error) {
	return c.graph(v, false)
}

func (c *Context) GetMeta(metric, name string, v interface{}) (interface{}, error) {
	var t opentsdb.TagSet
	switch v := v.(type) {
	case string:
		var err error
		t, err = opentsdb.ParseTags(v)
		if err != nil {
			return t, err
		}
	case opentsdb.TagSet:
		t = v
	}
	meta := c.schedule.GetMetadata(metric, t)
	if name == "" {
		return meta, nil
	}
	for _, m := range meta {
		if m.Name == name {
			return m.Value, nil
		}
	}
	return nil, nil
}

// LeftJoin takes slices of results and expressions for which it gets the slices of results.
// Then it joins the 2nd and higher slice of results onto the first slice of results.
// Joining is performed by group: a group that includes all tags (with same values) of the first group is a match.
func (c *Context) LeftJoin(v ...interface{}) (interface{}, error) {
	if len(v) < 2 {
		return nil, fmt.Errorf("need at least two values (each can be an expression or result slice), got %v", len(v))
	}
	// temporarily store the results in a results[M][Ni] Result matrix:
	// for M queries, tracks Ni results per each i'th query
	results := make([][]*expr.Result, len(v))
	for col, val := range v {
		queryResults, _, err := c.eval(val, false, false, 0)
		if err != nil {
			return nil, err
		}
		results[col] = queryResults
	}

	// perform the joining by storing all results in a joined[N0][M] Result matrix:
	// for N tagsets (based on first query results), tracks all M Results (results with matching group, from all other queries)
	joined := make([][]*expr.Result, 0)
	for row, firstQueryResult := range results[0] {
		joined = append(joined, make([]*expr.Result, len(v)))
		joined[row][0] = firstQueryResult
		// join results of 2nd to M queries
		for col, queryResults := range results[1:] {
			for _, laterQueryResult := range queryResults {
				if firstQueryResult.Group.Subset(laterQueryResult.Group) {
					joined[row][col+1] = laterQueryResult
					break
				}
				// Fill emtpy cells with NaN Value, so calling .Value is not a nil pointer dereference
				joined[row][col+1] = &expr.Result{Value: expr.Number(math.NaN())}
			}
		}
	}
	return joined, nil
}

func (c *Context) HTTPGet(url string) string {
	resp, err := http.Get(url)
	if err != nil {
		return err.Error()
	}
	defer resp.Body.Close()
	if resp.StatusCode >= 300 {
		return fmt.Sprintf("%v: returned %v", url, resp.Status)
	}
	body, err := ioutil.ReadAll(resp.Body)
	if err != nil {
		return err.Error()
	}
	return string(body)
}

func (c *Context) HTTPPost(url, bodyType, data string) string {
	resp, err := http.Post(url, bodyType, bytes.NewBufferString(data))
	if err != nil {
		return err.Error()
	}
	defer resp.Body.Close()
	if resp.StatusCode >= 300 {
		return fmt.Sprintf("%v: returned %v", url, resp.Status)
	}
	body, err := ioutil.ReadAll(resp.Body)
	if err != nil {
		return err.Error()
	}
	return string(body)
}

func (c *Context) LSQuery(index_root, filter, sduration, eduration string, size int) (interface{}, error) {
	var ks []string
	for k, v := range c.Group {
		ks = append(ks, k+":"+v)
	}
	return c.LSQueryAll(index_root, strings.Join(ks, ","), filter, sduration, eduration, size)
}

func (c *Context) LSQueryAll(index_root, keystring, filter, sduration, eduration string, size int) (interface{}, error) {
	req, err := expr.LSBaseQuery(time.Now(), index_root, c.runHistory.Logstash, keystring, filter, sduration, eduration, size)
	if err != nil {
		return nil, err
	}
	results, err := c.runHistory.Logstash.Query(req)
	if err != nil {
		return nil, err
	}
	r := make([]interface{}, len(results.Hits.Hits))
	for i, h := range results.Hits.Hits {
		var err error
		err = json.Unmarshal(*h.Source, &r[i])
		if err != nil {
			return nil, err
		}
	}
	return r, nil
}
