package base

import (
	"strings"
	"testing"
)

func TestDevLockDoctorMessage(t *testing.T) {
	t.Parallel()
	ok, msg := DevLockDoctorMessage(DevLockAbsent, "/e/.devlock")
	if !ok || !strings.Contains(msg, "no enterprise") {
		t.Fatalf("absent: ok=%v msg=%q", ok, msg)
	}
	ok, msg = DevLockDoctorMessage(DevLockStale, "/e/.devlock")
	if ok || !strings.Contains(msg, "stale") {
		t.Fatalf("stale: ok=%v msg=%q", ok, msg)
	}
}

func TestDevLockLinkSummary(t *testing.T) {
	t.Parallel()
	l1, l2 := DevLockLinkSummary(DevLockAbsent, "/e/.devlock")
	if l1 != ".devlock:    absent" || l2 != "" {
		t.Fatalf("absent: %q %q", l1, l2)
	}
	l1, l2 = DevLockLinkSummary(DevLockActive, "/e/.devlock")
	if !strings.Contains(l1, "watcher process detected") || !strings.Contains(l2, "/e/.devlock") {
		t.Fatalf("active: %q %q", l1, l2)
	}
}

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
		if got := EnterpriseDevProcessLine(tc.line, oss, ent, start); got != tc.want {
			t.Fatalf("EnterpriseDevProcessLine(%q) = %v, want %v", tc.line, got, tc.want)
		}
	}
}
