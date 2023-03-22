package main

import (
	"testing"
)

func Test_constructURL(t *testing.T) {
	type args struct {
		product string
		pth     string
	}
	tests := []struct {
		name    string
		args    args
		want    string
		wantErr bool
	}{
		{name: "cleans .. sequence", args: args{"..", ".."}, want: "https://grafana.com/api", wantErr: false},
		{name: "doesn't clean anything - non malicious url", args: args{"foo", "bar"}, want: "https://grafana.com/api/foo/bar", wantErr: false},
		{name: "doesn't clean anything - three dots", args: args{"...", "..."}, want: "https://grafana.com/api/.../...", wantErr: false},
		{name: "cleans .", args: args{"..", ".."}, want: "https://grafana.com/api", wantErr: false},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, err := constructURL(tt.args.product, tt.args.pth)
			if (err != nil) != tt.wantErr {
				t.Errorf("constructURL() error = %v, wantErr %v", err, tt.wantErr)
				return
			}
			if got != tt.want {
				t.Errorf("constructURL() got = %v, want %v", got, tt.want)
			}
		})
	}
}
