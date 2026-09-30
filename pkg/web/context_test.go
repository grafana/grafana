package web

import (
	"fmt"
	"html/template"
	"net/http"
	"net/http/httptest"
	"syscall"
	"testing"

	"github.com/stretchr/testify/assert"

	"github.com/grafana/grafana/pkg/infra/log"
)

func TestContext_RemoteAddr(t *testing.T) {
	type fields struct {
		Req    *http.Request
		logger log.Logger
	}
	tests := []struct {
		name   string
		fields fields
		want   string
	}{
		{
			name: "Receive invalid ip address in headers should return RemoteAddr",
			fields: fields{
				logger: log.New("test.logger"),
				Req: &http.Request{
					RemoteAddr: "255.255.255.255",
					Header: http.Header{
						"X-Real-Ip":       []string{"this is not a valid IP"},
						"X-Forwarded-For": []string{"192.168.1.1"},
					},
				},
			},
			want: "255.255.255.255",
		},
		{
			name: "Receive valid ip address in X-Real-Ip should return it",
			fields: fields{
				logger: log.New("test.logger"),
				Req: &http.Request{
					RemoteAddr: "255.255.255.255",
					Header: http.Header{
						"X-Real-Ip":       []string{"192.168.1.1"},
						"X-Forwarded-For": []string{"this is not a valid IP"},
					},
				},
			},
			want: "192.168.1.1",
		},
		{
			name: "Receive valid ip addresses in X-Forwarded-For should return the first one",
			fields: fields{
				logger: log.New("test.logger"),
				Req: &http.Request{
					RemoteAddr: "255.255.255.255",
					Header: http.Header{
						"X-Forwarded-For": []string{"192.168.1.1,255.255.255.255"},
					},
				},
			},
			want: "192.168.1.1",
		},
		{
			name: "Receive valid ip addresses IPV6 in X-Forwarded-For should return it",
			fields: fields{
				logger: log.New("test.logger"),
				Req: &http.Request{
					RemoteAddr: "255.255.255.255",
					Header: http.Header{
						"X-Forwarded-For": []string{"2001:db8:85a3:8d3:1319:8a2e:370:7348"},
					},
				},
			},
			want: "2001:db8:85a3:8d3:1319:8a2e:370:7348",
		},
		{
			name: "When no header is informed, should return remote_addr without port",
			fields: fields{
				logger: log.New("test.logger"),
				Req: &http.Request{
					RemoteAddr: "[::1]:51299",
					Header:     http.Header{},
				},
			},
			want: "[::1]",
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			ctx := &Context{
				Req: tt.fields.Req,
			}
			if got := ctx.RemoteAddr(); got != tt.want {
				t.Errorf("RemoteAddr() = %v, want %v", got, tt.want)
			}
		})
	}
}

func TestContext_noHandler(t *testing.T) {
	recorder := httptest.NewRecorder()

	method := http.MethodGet
	c := &Context{
		Req:  httptest.NewRequest(method, "/", nil),
		Resp: NewResponseWriter(method, recorder),
	}

	c.run()

	assert.Equal(t, http.StatusInternalServerError, recorder.Code)
}

type disconnectResponseWriter struct {
	http.ResponseWriter
	err error
}

func (w *disconnectResponseWriter) Write([]byte) (int, error) {
	return 0, w.err
}

func TestContext_HTML_disconnectHandling(t *testing.T) {
	t.Run("gracefully ignores client disconnect errors", func(t *testing.T) {
		disconnectErrors := []error{
			syscall.EPIPE,
			syscall.ECONNRESET,
			http.ErrAbortHandler,
		}

		for _, disconnErr := range disconnectErrors {
			t.Run(fmt.Sprintf("handles %v", disconnErr), func(t *testing.T) {
				tmpl := template.Must(template.New("test").Parse("hello {{ . }}"))
				c := &Context{
					Resp:     NewResponseWriter(http.MethodGet, &disconnectResponseWriter{ResponseWriter: httptest.NewRecorder(), err: disconnErr}),
					template: tmpl,
				}

				assert.NotPanics(t, func() {
					c.HTML(http.StatusOK, "test", "world")
				})
			})
		}
	})

	t.Run("panics on standard template execution errors", func(t *testing.T) {
		tmpl := template.Must(template.New("test").Parse("hello {{ .NonExistentField }}"))
		c := &Context{
			Resp:     NewResponseWriter(http.MethodGet, httptest.NewRecorder()),
			template: tmpl,
		}

		assert.Panics(t, func() {
			c.HTML(http.StatusOK, "test", struct{}{})
		})
	})
}
