package api

import (
	"io/fs"
	"os"
	"testing"
	"time"
)

func Test_accessForbidden(t *testing.T) {
	type testCase struct {
		fi os.FileInfo
	}
	tests := []struct {
		name            string
		t               testCase
		accessForbidden bool
	}{
		{
			name: ".exe files are forbidden",
			t: testCase{
				fi: testFileInfo{
					name: "test.exe",
				},
			},
			accessForbidden: true,
		},
		{
			name: ".sh files are forbidden",
			t: testCase{
				fi: testFileInfo{
					name: "test.sh",
				},
			},
			accessForbidden: true,
		},
		{
			name: "UNIX executables with non-permitted ext are forbidden",
			t: testCase{
				fi: testFileInfo{
					name:       "bin/malicious.dmg",
					executable: true,
				},
			},
			accessForbidden: true,
		},
		{
			name: "UNIX executables with permitted ext are not forbidden",
			t: testCase{
				fi: testFileInfo{
					name:       "logo.svg",
					executable: true,
				},
			},
			accessForbidden: false,
		},
		{
			name: "js is not forbidden",
			t: testCase{
				fi: testFileInfo{
					name: "module.js",
				},
			},
			accessForbidden: false,
		},
		{
			name: "logos are not forbidden",
			t: testCase{
				fi: testFileInfo{
					name: "logo.svg",
				},
			},
			accessForbidden: false,
		},
		{
			name: "JPGs are not forbidden",
			t: testCase{
				fi: testFileInfo{
					name: "img/test.jpg",
				},
			},
			accessForbidden: false,
		},
		{
			name: "JPEGs are not forbidden",
			t: testCase{
				fi: testFileInfo{
					name: "img/test.jpeg",
				},
			},
			accessForbidden: false,
		},
		{
			name: "no file ext is forbidden",
			t: testCase{
				fi: testFileInfo{
					name: "scripts/runThis",
				},
			},
			accessForbidden: true,
		},
		{
			name: "empty file ext is forbidden",
			t: testCase{
				fi: testFileInfo{
					name: "scripts/runThis.",
				},
			},
			accessForbidden: true,
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := accessForbidden(tt.t.fi); got != tt.accessForbidden {
				t.Errorf("accessForbidden() = %v, accessForbidden %v", got, tt.accessForbidden)
			}
		})
	}
}

type testFileInfo struct {
	name       string
	executable bool
}

func (t testFileInfo) Name() string {
	return t.name
}

func (t testFileInfo) Size() int64 {
	return 0
}

func (t testFileInfo) Mode() fs.FileMode {
	if t.executable {
		return fs.FileMode(0111)
	}
	return fs.FileMode(0)
}

func (t testFileInfo) ModTime() time.Time {
	return time.Time{}
}

func (t testFileInfo) IsDir() bool {
	return false
}

func (t testFileInfo) Sys() interface{} {
	return nil
}
