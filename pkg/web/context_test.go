package web

import (
	"net/http"
	"testing"

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
				Req:    tt.fields.Req,
				logger: tt.fields.logger,
			}
			if got := ctx.RemoteAddr(); got != tt.want {
				t.Errorf("RemoteAddr() = %v, want %v", got, tt.want)
			}
		})
	}
}
