package middleware

import (
	"testing"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/models"
	"github.com/stretchr/testify/assert"
)

func Test_sanitizeURL(t *testing.T) {
	type args struct {
		ctx *models.ReqContext
		s   string
	}
	tests := []struct {
		name string
		args args
		want string
	}{
		{
			name: "Receiving empty string should return it",
			args: args{
				ctx: &models.ReqContext{
					Logger: log.New("test.logger"),
				},
				s: "",
			},
			want: "",
		},
		{
			name: "Receiving valid URL string should return it parsed",
			args: args{
				ctx: &models.ReqContext{
					Logger: log.New("test.logger"),
				},
				s: "https://grafana.com/",
			},
			want: "https://grafana.com/",
		},
		{
			name: "Receiving invalid URL string should return empty string",
			args: args{
				ctx: &models.ReqContext{
					Logger: log.New("test.logger"),
				},
				s: "this is not a valid URL",
			},
			want: "",
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			assert.Equalf(t, tt.want, sanitizeURL(tt.args.ctx, tt.args.s), "sanitizeURL(%v, %v)", tt.args.ctx, tt.args.s)
		})
	}
}
