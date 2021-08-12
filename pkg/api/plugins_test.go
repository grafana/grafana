package api

import (
	"testing"
)

func Test_accessForbidden(t *testing.T) {
	type testCase struct {
		filename string
	}
	tests := []struct {
		name            string
		t               testCase
		accessForbidden bool
	}{
		{
			name: ".exe files are forbidden",
			t: testCase{
				filename: "test.exe",
			},
			accessForbidden: true,
		},
		{
			name: ".sh files are forbidden",
			t: testCase{
				filename: "test.sh",
			},
			accessForbidden: true,
		},
		{
			name: "js is not forbidden",
			t: testCase{

				filename: "module.js",
			},
			accessForbidden: false,
		},
		{
			name: "logos are not forbidden",
			t: testCase{

				filename: "logo.svg",
			},
			accessForbidden: false,
		},
		{
			name: "JPGs are not forbidden",
			t: testCase{
				filename: "img/test.jpg",
			},
			accessForbidden: false,
		},
		{
			name: "JPEGs are not forbidden",
			t: testCase{
				filename: "img/test.jpeg",
			},
			accessForbidden: false,
		},
		{
			name: "ext case is ignored",
			t: testCase{
				filename: "scripts/runThis.SH",
			},
			accessForbidden: true,
		},
		{
			name: "no file ext is forbidden",
			t: testCase{
				filename: "scripts/runThis",
			},
			accessForbidden: true,
		},
		{
			name: "empty file ext is forbidden",
			t: testCase{
				filename: "scripts/runThis.",
			},
			accessForbidden: true,
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := accessForbidden(tt.t.filename); got != tt.accessForbidden {
				t.Errorf("accessForbidden() = %v, accessForbidden %v", got, tt.accessForbidden)
			}
		})
	}
}
