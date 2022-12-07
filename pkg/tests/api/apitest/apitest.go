package apitest

import (
	"bytes"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"reflect"
	"regexp"
	"testing"
	"text/template"

	"github.com/bhmj/jsonslice"
	"gopkg.in/yaml.v3"
)

// Workflow is an API test scenario that contains a sequence of test steps and
// a shared environment and, optionally, auth information.
type Workflow struct {
	Env      map[string]string `json:"env",yaml:"env"`
	Auth     Auth              `json:"auth",yaml:"auth"`
	RawSteps []json.RawMessage `json:"steps",yaml:"steps"`

	steps []Step
}

// Auth defines credentials for API tests, such as HTTP Basic Auth or Bearer.
type Auth struct {
	Username string `json:"username",yaml:"username"`
	Password string `json:"password",yaml:"password"`
	Bearer   string `json:"bearer",yaml:"bearer"`
}

func New(body string) (w *Workflow, err error) {
	var x any
	b := []byte(body)
	err = yaml.Unmarshal(b, &x)
	if err == nil {
		b, _ = json.Marshal(x)
	}
	err = json.Unmarshal(b, &w)
	w.steps = make([]Step, len(w.RawSteps))
	for i, b := range w.RawSteps {
		if err := json.Unmarshal(b, &w.steps[i]); err != nil {
			return nil, err
		}
		w.steps[i].raw = b
	}
	return w, err
}

func NewWorkflow(filename string) (w *Workflow, err error) {
	b, err := os.ReadFile(filename)
	if err != nil {
		return nil, err
	}
	return New(string(b))
}

func TestAPI(t *testing.T, body string) {
	t.Helper()
	w, err := New(body)
	if err != nil {
		t.Fatal(err)
	}
	if err := w.Run(); err != nil {
		t.Fatal(err)
	}
}

func (w *Workflow) Run() error {
	caps := map[string]any{}
	for _, step := range w.steps {
		step.Compile(w.Env, caps)
		req, err := step.Request(w.Auth)
		if err != nil {
			log.Fatal(err)
		}
		res, err := http.DefaultClient.Do(req)
		if err != nil {
			log.Fatal(err)
		}
		fmt.Println("\n### " + step.Name)
		c, err := step.Checks.Check(res)
		if err != nil {
			log.Fatal(err)
		}
		for k, v := range c {
			caps[k] = v
		}
	}
	return nil
}

type Step struct {
	Name    string            `json:"name"`
	URL     string            `json:"url"`
	Method  string            `json:"method"`
	Auth    Auth              `json:"auth"`
	Body    any               `json:"body"`
	Headers map[string]string `json:"headers"`
	Checks  Checks            `json:"checks"`

	raw []byte
}

func (s *Step) Compile(env map[string]string, captures map[string]any) error {
	b := &bytes.Buffer{}
	t, err := template.New(s.Name).Parse(string(s.raw))
	if err != nil {
		return err
	}
	vars := map[string]any{}
	for k, v := range env {
		vars[k] = v
	}
	for k, v := range captures {
		vars[k] = v
	}
	if err := t.Execute(b, vars); err != nil {
		return err
	}
	return json.Unmarshal(b.Bytes(), s)
}

type Checks struct {
	Schema  string             `json:"schema"`
	Status  int                `json:"status"`
	Body    map[string]Matcher `json:"body"`
	Capture map[string]string  `json:"captures"`
}

type Matcher struct {
	Equals    any
	NotEquals any
	RegExp    *regexp.Regexp
}

func (m *Matcher) UnmarshalJSON(b []byte) error {
	var v any
	err := json.Unmarshal(b, &v)
	if err != nil {
		return err
	}
	if obj, ok := v.(map[string]any); ok {
		m.Equals = obj["eq"]
		m.NotEquals = obj["neq"]
		if re, ok := obj["regexp"]; ok {
			if s, ok := re.(string); !ok {
				return errors.New("regexp must be a string")
				m.RegExp = nil // TODO
			} else if m.RegExp, err = regexp.Compile(s); err != nil {
				return err
			}
		}
	} else {
		m.Equals = v
	}
	return nil
}

func (m *Matcher) Match(v any) error {
	if m.Equals != nil && !reflect.DeepEqual(v, m.Equals) {
		return fmt.Errorf("expected %#v, but got %#v", m.Equals, v)
	}
	if m.NotEquals != nil && reflect.DeepEqual(v, m.NotEquals) {
		return fmt.Errorf("expected not to be %#v", m.NotEquals)
	}
	if s, ok := v.(string); ok && m.RegExp != nil && !m.RegExp.MatchString(s) {
		return fmt.Errorf("expected not match %#v but got %s", m.RegExp, s)
	}
	return nil
}

func (c *Checks) Check(res *http.Response) (map[string]any, error) {
	caps := map[string]any{}
	if c.Status != 0 && res.StatusCode != c.Status {
		return nil, fmt.Errorf("expected status %d, got %d", c.Status, res.StatusCode)
	}
	if res.Body == nil {
		if c.Body != nil {
			return nil, fmt.Errorf("expected body")
		}
		return nil, nil
	}
	defer res.Body.Close()
	b, err := io.ReadAll(res.Body)
	if err != nil {
		return nil, err
	}
	fmt.Println(">", string(b))
	for path, expect := range c.Body {
		b, err := jsonslice.Get(b, path)
		if err != nil {
			return nil, err
		}
		var v any
		if err := json.Unmarshal(b, &v); err != nil {
			return nil, err
		}
		if err := expect.Match(v); err != nil {
			return nil, err
		}
	}

	for name, path := range c.Capture {
		b, err := jsonslice.Get(b, path)
		if err != nil {
			return nil, err
		}
		var v any
		if err := json.Unmarshal(b, &v); err != nil {
			return nil, err
		}
		caps[name] = v
	}

	return caps, nil
}

func (step *Step) Request(globalAuth Auth) (*http.Request, error) {
	body := &bytes.Buffer{}
	if step.Body != nil {
		if err := json.NewEncoder(body).Encode(step.Body); err != nil {
			return nil, err
		}
	}
	req, err := http.NewRequest(step.Method, step.URL, body)
	if err != nil {
		return nil, err
	}

	if step.Body != nil {
		req.Header.Set("Content-type", "application/json")
	}
	for k, v := range step.Headers {
		req.Header.Set(k, v)
	}

	auth := step.Auth
	if auth.Username == "" && auth.Password == "" && auth.Bearer == "" {
		auth = globalAuth
	}
	if auth.Username != "" || auth.Password != "" {
		req.SetBasicAuth(auth.Username, auth.Password)
	} else if auth.Bearer != "" {
		req.Header.Add("Bearer", auth.Bearer)
	}
	return req, nil
}
