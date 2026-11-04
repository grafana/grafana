package setting

import (
	"context"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
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
		wantNamePath  bool   // a request must target testName (the PUT or per-name DELETE)
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
			name:          "delete lists by (section,key) labels, then deletes each match by name",
			op:            del,
			wantErr:       assert.NoError,
			wantURISubstr: "key%3Dclient_id%2Csection%3Dauth.generic_oauth%2Csource%3Dus",
			wantNamePath:  true,
			handler: func(reqs *[]string) http.HandlerFunc {
				return func(w http.ResponseWriter, r *http.Request) {
					*reqs = append(*reqs, r.Method+" "+r.URL.RequestURI())
					if r.Method == http.MethodGet {
						w.Header().Set("Content-Type", "application/json")
						_, _ = w.Write([]byte(`{"items":[{"metadata":{"name":"` + testName + `"},"spec":{"section":"auth.generic_oauth","key":"client_id"}}]}`))
						return
					}
					w.WriteHeader(http.StatusOK)
				}
			},
			wantMethods: []string{http.MethodGet, http.MethodDelete},
		},
		{
			name:    "delete is a no-op when nothing matches",
			op:      del,
			wantErr: assert.NoError,
			handler: func(reqs *[]string) http.HandlerFunc {
				return func(w http.ResponseWriter, r *http.Request) {
					*reqs = append(*reqs, r.Method+" "+r.URL.RequestURI())
					w.Header().Set("Content-Type", "application/json")
					_, _ = w.Write([]byte(`{"items":[]}`))
				}
			},
			wantMethods: []string{http.MethodGet},
		},
		{
			name:    "delete ignores a not-found on the per-name delete",
			op:      del,
			wantErr: assert.NoError,
			handler: func(reqs *[]string) http.HandlerFunc {
				return func(w http.ResponseWriter, r *http.Request) {
					*reqs = append(*reqs, r.Method+" "+r.URL.RequestURI())
					w.Header().Set("Content-Type", "application/json")
					if r.Method == http.MethodGet {
						_, _ = w.Write([]byte(`{"items":[{"metadata":{"name":"` + testName + `"},"spec":{"section":"auth.generic_oauth","key":"client_id"}}]}`))
						return
					}
					w.WriteHeader(http.StatusNotFound)
					_, _ = w.Write([]byte(`{"kind":"Status","apiVersion":"v1","status":"Failure","reason":"NotFound","code":404}`))
				}
			},
			wantMethods: []string{http.MethodGet, http.MethodDelete},
		},
		{
			name: "delete surfaces a list error",
			op:   del,
			wantErr: func(t assert.TestingT, err error, _ ...any) bool {
				return assert.ErrorContains(t, err, "list:") && assert.True(t, apierrors.IsInternalError(err), "got %v", err)
			},
			handler: func(reqs *[]string) http.HandlerFunc {
				return func(w http.ResponseWriter, r *http.Request) {
					*reqs = append(*reqs, r.Method+" "+r.URL.RequestURI())
					w.WriteHeader(http.StatusInternalServerError)
				}
			},
			wantMethods: []string{http.MethodGet},
		},
		{
			name: "delete surfaces a per-name delete error",
			op:   del,
			wantErr: func(t assert.TestingT, err error, _ ...any) bool {
				return assert.ErrorContains(t, err, "delete setting auth.generic_oauth/client_id: ") &&
					assert.NotContains(t, err.Error(), "list:") &&
					assert.True(t, apierrors.IsInternalError(err), "got %v", err)
			},
			handler: func(reqs *[]string) http.HandlerFunc {
				return func(w http.ResponseWriter, r *http.Request) {
					*reqs = append(*reqs, r.Method+" "+r.URL.RequestURI())
					if r.Method == http.MethodGet {
						w.Header().Set("Content-Type", "application/json")
						_, _ = w.Write([]byte(`{"items":[{"metadata":{"name":"` + testName + `"},"spec":{"section":"auth.generic_oauth","key":"client_id"}}]}`))
						return
					}
					w.WriteHeader(http.StatusInternalServerError)
				}
			},
			wantMethods: []string{http.MethodGet, http.MethodDelete},
		},
		{
			name: "upsert errors when the context carries no namespace",
			op:   func(w Writer) error { return w.Upsert(context.Background(), setting) },
			wantErr: func(t assert.TestingT, err error, _ ...any) bool {
				return assert.ErrorContains(t, err, "missing namespace in context")
			},
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

// The apiserver stores a sanitized section/key label when the value isn't a
// valid label value, so Delete can't select on it and must match the spec.
func TestRemoteSettingService_DeleteInvalidLabelValues(t *testing.T) {
	ctx := request.WithNamespace(t.Context(), "stacks-11")

	tests := []struct {
		name         string
		section, key string
		// a sibling the list also returns, which must not be deleted
		siblingSection, siblingKey string
		wantSelector               string
	}{
		{
			name:    "key with a space",
			section: "auth.saml", key: "role_values editor",
			siblingSection: "auth.saml", siblingKey: "role_values_editor",
			wantSelector: "labelSelector=section%3Dauth.saml%2Csource%3Dus",
		},
		{
			name:    "section with brackets",
			section: "[auth.saml]", key: "enabled",
			siblingSection: "auth.saml", siblingKey: "enabled",
			wantSelector: "labelSelector=key%3Denabled%2Csource%3Dus",
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			var reqs []string
			srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				reqs = append(reqs, r.Method+" "+r.URL.RequestURI())
				if r.Method == http.MethodGet {
					w.Header().Set("Content-Type", "application/json")
					_, _ = w.Write([]byte(`{"items":[` +
						`{"metadata":{"name":"match-a1b2c3"},"spec":{"section":"` + tc.section + `","key":"` + tc.key + `"}},` +
						`{"metadata":{"name":"sibling"},"spec":{"section":"` + tc.siblingSection + `","key":"` + tc.siblingKey + `"}}]}`))
					return
				}
				w.WriteHeader(http.StatusOK)
			}))
			defer srv.Close()

			err := newTestClient(t, srv.URL, 500).(Writer).Delete(ctx, tc.section, tc.key)
			assert.NoError(t, err)

			assert.Truef(t, anyContains(reqs, tc.wantSelector), "expected a list with %q; got %v", tc.wantSelector, reqs)
			assert.Truef(t, anyContains(reqs, "DELETE "), "expected a delete; got %v", reqs)
			assert.Truef(t, anyContains(reqs, "/match-a1b2c3"), "expected the matching setting to be deleted; got %v", reqs)
			assert.Falsef(t, anyContains(reqs, "/sibling"), "the sibling must not be deleted; got %v", reqs)
		})
	}
}
