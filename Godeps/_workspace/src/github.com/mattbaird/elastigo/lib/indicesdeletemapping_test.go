package elastigo

import (
	"testing"
	"net/http/httptest"
	"net/http"
	"net/url"
	"strings"
)

func TestDeleteMapping(t *testing.T) {
	ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != "DELETE" {
			t.Errorf("Expected HTTP Verb, DELETE")
		}

		if r.URL.Path == "/this/exists" {
			w.Write([]byte(`{"acknowledged": true}`))
		} else if r.URL.Path == "/this/not_exists" {
			w.WriteHeader(http.StatusNotFound)
			w.Write([]byte(`{"error": "TypeMissingException[[_all] type[[not_exists]] missing: No index has the type.]","status": 404}`))
		} else {
			t.Errorf("Unexpected request path, %s", r.URL.Path)
		}
	}))
	defer ts.Close()

	serverURL, _ := url.Parse(ts.URL)

	c := NewTestConn()

	c.Domain = strings.Split(serverURL.Host, ":")[0]
	c.Port = strings.Split(serverURL.Host, ":")[1]

	_, err := c.DeleteMapping("this","exists")
	if err != nil {
		t.Errorf("Expected no error and got, %s", err)
	}

	_, err = c.DeleteMapping("this", "not_exists")
	if err == nil {
		t.Errorf("Expected error and got none deleting /this/not_exists")
	}

	_, err = c.DeleteMapping("", "two")
	if err == nil {
		t.Errorf("Expected error for no index and got none")
	}

	_, err = c.DeleteMapping("one", "")
	if err == nil {
		t.Errorf("Expected error for no mapping and got none")
	}
}
