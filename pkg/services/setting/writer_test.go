package setting

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/stretchr/testify/assert"
	"k8s.io/apiserver/pkg/endpoints/request"
)

func TestRemoteSettingService_writes(t *testing.T) {
	ctx := request.WithNamespace(context.Background(), "stacks-11")
	setting := &Setting{Section: "auth.generic_oauth", Key: "client_id", Value: "abc"}
	upsert := func(w Writer) error { return w.Upsert(ctx, setting) }
	del := func(w Writer) error { return w.Delete(ctx, "auth.generic_oauth", "client_id") }

	tests := []struct {
		name        string
		op          func(w Writer) error
		handler     func(methods *[]string) http.HandlerFunc
		wantErr     assert.ErrorAssertionFunc
		wantMethods []string
	}{
		{
			name:    "upsert creates via POST when the row is absent",
			op:      upsert,
			wantErr: assert.NoError,
			handler: func(methods *[]string) http.HandlerFunc {
				return func(w http.ResponseWriter, r *http.Request) {
					*methods = append(*methods, r.Method)
					w.WriteHeader(http.StatusCreated)
				}
			},
			wantMethods: []string{http.MethodPost},
		},
		{
			name:    "upsert falls back to PUT on 409 conflict",
			op:      upsert,
			wantErr: assert.NoError,
			handler: func(methods *[]string) http.HandlerFunc {
				return func(w http.ResponseWriter, r *http.Request) {
					*methods = append(*methods, r.Method)
					w.Header().Set("Content-Type", "application/json")
					if r.Method == http.MethodPost {
						w.WriteHeader(http.StatusConflict)
						_, _ = w.Write([]byte(`{"kind":"Status","apiVersion":"v1","status":"Failure","reason":"AlreadyExists","code":409}`))
						return
					}
					w.WriteHeader(http.StatusOK) // PUT wins
				}
			},
			wantMethods: []string{http.MethodPost, http.MethodPut},
		},
		{
			name:    "upsert aborts (no PUT) on a non-conflict POST error",
			op:      upsert,
			wantErr: assert.Error,
			handler: func(methods *[]string) http.HandlerFunc {
				return func(w http.ResponseWriter, r *http.Request) {
					*methods = append(*methods, r.Method)
					w.WriteHeader(http.StatusInternalServerError)
				}
			},
			wantMethods: []string{http.MethodPost},
		},
		{
			name:    "delete removes an existing row",
			op:      del,
			wantErr: assert.NoError,
			handler: func(methods *[]string) http.HandlerFunc {
				return func(w http.ResponseWriter, r *http.Request) {
					*methods = append(*methods, r.Method)
					w.WriteHeader(http.StatusOK)
				}
			},
			wantMethods: []string{http.MethodDelete},
		},
		{
			name:    "delete is a no-op when the row is missing (404)",
			op:      del,
			wantErr: assert.NoError,
			handler: func(methods *[]string) http.HandlerFunc {
				return func(w http.ResponseWriter, r *http.Request) {
					*methods = append(*methods, r.Method)
					w.Header().Set("Content-Type", "application/json")
					w.WriteHeader(http.StatusNotFound)
					_, _ = w.Write([]byte(`{"kind":"Status","apiVersion":"v1","status":"Failure","reason":"NotFound","code":404}`))
				}
			},
			wantMethods: []string{http.MethodDelete},
		},
		{
			name:    "delete surfaces non-NotFound errors",
			op:      del,
			wantErr: assert.Error,
			handler: func(methods *[]string) http.HandlerFunc {
				return func(w http.ResponseWriter, r *http.Request) {
					*methods = append(*methods, r.Method)
					w.WriteHeader(http.StatusInternalServerError)
				}
			},
			wantMethods: []string{http.MethodDelete},
		},
		{
			name:    "upsert errors when the context carries no namespace",
			op:      func(w Writer) error { return w.Upsert(context.Background(), setting) },
			wantErr: assert.Error,
			handler: func(methods *[]string) http.HandlerFunc {
				return func(w http.ResponseWriter, r *http.Request) { *methods = append(*methods, r.Method) }
			},
			wantMethods: nil, // guarded before any request
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			var methods []string
			srv := httptest.NewServer(tc.handler(&methods))
			defer srv.Close()

			err := tc.op(newTestClient(t, srv.URL, 500).(Writer))
			tc.wantErr(t, err)
			assert.Equal(t, tc.wantMethods, methods)
		})
	}
}

func TestSettingResourceName(t *testing.T) {
	tests := []struct {
		section, key, want string
	}{
		{"auth.generic_oauth", "client_id", "auth.generic-oauth--client-id"},
		{"auth.saml", "certificate_url", "auth.saml--certificate-url"},
		{"AUTH.LDAP", "Bind_Password", "auth.ldap--bind-password"},
	}
	for _, tc := range tests {
		assert.Equal(t, tc.want, settingResourceName(tc.section, tc.key))
	}
}
