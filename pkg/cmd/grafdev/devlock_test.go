package main

import "testing"

func TestEnterpriseDevProcessLine(t *testing.T) {
	t.Parallel()
	oss := "/Users/dev/grafana"
	ent := "/Users/dev/grafana-enterprise"
	start := ent + "/start-dev.sh"

	cases := []struct {
		line string
		want bool
	}{
		{
			line: "/opt/homebrew/bin/fswatch -r -0 --event Created /Users/dev/grafana/pkg/extensions /Users/dev/grafana/public/app/extensions",
			want: true,
		},
		{
			line: "inotifywait -m -r -e modify /Users/dev/grafana/pkg/extensions",
			want: true,
		},
		{
			line: "/bin/bash /Users/dev/grafana-enterprise/start-dev.sh",
			want: true,
		},
		{
			line: "/opt/homebrew/bin/fswatch /tmp/other-project",
			want: false,
		},
		{
			line: "bash ./start-dev.sh",
			want: false,
		},
	}
	for _, tc := range cases {
		if got := enterpriseDevProcessLine(tc.line, oss, ent, start); got != tc.want {
			t.Fatalf("enterpriseDevProcessLine(%q) = %v, want %v", tc.line, got, tc.want)
		}
	}
}
