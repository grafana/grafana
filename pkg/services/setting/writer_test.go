package setting

import (
	"context"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"k8s.io/apiserver/pkg/endpoints/request"
)

const testName = "auth.generic-oauth--client-id" // server-assigned resource name

// conflictStatus writes an AlreadyExists; a non-empty name goes in details.
func conflictStatus(w http.ResponseWriter, name string) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusConflict)
	body := `{"kind":"Status","apiVersion":"v1","status":"Failure","reason":"AlreadyExists","code":409`
	if name != "" {
		body += `,"details":{"name":"` + name + `"}`
	}
	_, _ = w.Write([]byte(body + `}`))
}

func anyContains(ss []string, sub string) bool {
	for _, s := range ss {
		if strings.Contains(s, sub) {
			return true
		}
	}
	return false
}

func TestRemoteSettingService_writes(t *testing.T) {
	ctx := request.WithNamespace(context.Background(), "stacks-11")
	setting := &Setting{Section: "auth.generic_oauth", Key: "client_id", Value: "abc"}
	upsert := func(w Writer) error { return w.Upsert(ctx, setting) }
	del := func(w Writer) error { return w.Delete(ctx, "auth.generic_oauth", "client_id") }

	tests := []struct {
		name          string
		op            func(w Writer) error
		handler       func(reqs *[]string) http.HandlerFunc
		wantErr       assert.ErrorAssertionFunc
		wantMethods   []string
		wantNamePath  bool   // a request must target testName (the PUT)
		wantURISubstr string // a request URI must contain this (delete label selector)
	}{
		{
			name:    "upsert creates via POST when the row is absent",
			op:      upsert,
			wantErr: assert.NoError,
			handler: func(reqs *[]string) http.HandlerFunc {
				return func(w http.ResponseWriter, r *http.Request) {
					*reqs = append(*reqs, r.Method+" "+r.URL.RequestURI())
					w.WriteHeader(http.StatusCreated)
				}
			},
			wantMethods: []string{http.MethodPost},
		},
		{
			name:         "upsert reads the name from the conflict error, then PUTs to it",
			op:           upsert,
			wantErr:      assert.NoError,
			wantNamePath: true,
			handler: func(reqs *[]string) http.HandlerFunc {
				return func(w http.ResponseWriter, r *http.Request) {
					*reqs = append(*reqs, r.Method+" "+r.URL.RequestURI())
					if r.Method == http.MethodPost {
						conflictStatus(w, testName)
						return
					}
					w.WriteHeader(http.StatusOK) // PUT wins
				}
			},
			wantMethods: []string{http.MethodPost, http.MethodPut},
		},
		{
			name:    "upsert errors when the conflict carries no resource name",
			op:      upsert,
			wantErr: assert.Error,
			handler: func(reqs *[]string) http.HandlerFunc {
				return func(w http.ResponseWriter, r *http.Request) {
					*reqs = append(*reqs, r.Method+" "+r.URL.RequestURI())
					conflictStatus(w, "")
				}
			},
			wantMethods: []string{http.MethodPost},
		},
		{
			name:    "upsert aborts (no PUT) on a non-conflict POST error",
			op:      upsert,
			wantErr: assert.Error,
			handler: func(reqs *[]string) http.HandlerFunc {
				return func(w http.ResponseWriter, r *http.Request) {
					*reqs = append(*reqs, r.Method+" "+r.URL.RequestURI())
					w.WriteHeader(http.StatusInternalServerError)
				}
			},
			wantMethods: []string{http.MethodPost},
		},
		{
			name:          "delete issues a collection delete by (section,key) labels",
			op:            del,
			wantErr:       assert.NoError,
			wantURISubstr: "auth.generic_oauth",
			handler: func(reqs *[]string) http.HandlerFunc {
				return func(w http.ResponseWriter, r *http.Request) {
					*reqs = append(*reqs, r.Method+" "+r.URL.RequestURI())
					w.WriteHeader(http.StatusOK)
				}
			},
			wantMethods: []string{http.MethodDelete},
		},
		{
			name:    "delete surfaces an error",
			op:      del,
			wantErr: assert.Error,
			handler: func(reqs *[]string) http.HandlerFunc {
				return func(w http.ResponseWriter, r *http.Request) {
					*reqs = append(*reqs, r.Method+" "+r.URL.RequestURI())
					w.WriteHeader(http.StatusInternalServerError)
				}
			},
			wantMethods: []string{http.MethodDelete},
		},
		{
			name:    "upsert errors when the context carries no namespace",
			op:      func(w Writer) error { return w.Upsert(context.Background(), setting) },
			wantErr: assert.Error,
			handler: func(reqs *[]string) http.HandlerFunc {
				return func(w http.ResponseWriter, r *http.Request) { *reqs = append(*reqs, r.Method) }
			},
			wantMethods: []string{}, // guarded before any request
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			var reqs []string
			srv := httptest.NewServer(tc.handler(&reqs))
			defer srv.Close()

			err := tc.op(newTestClient(t, srv.URL, 500).(Writer))
			tc.wantErr(t, err)

			methods := make([]string, 0, len(reqs))
			for _, r := range reqs {
				methods = append(methods, strings.SplitN(r, " ", 2)[0])
			}
			assert.Equal(t, tc.wantMethods, methods)

			if tc.wantNamePath {
				assert.Truef(t, anyContains(reqs, "/"+testName), "expected a request targeting %q; got %v", testName, reqs)
			}
			if tc.wantURISubstr != "" {
				assert.Truef(t, anyContains(reqs, tc.wantURISubstr), "expected a request URI containing %q; got %v", tc.wantURISubstr, reqs)
			}
		})
	}
}
