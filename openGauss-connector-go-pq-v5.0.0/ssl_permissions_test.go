//go:build !windows
// +build !windows

package pq

import (
	"os"
	"syscall"
	"testing"
	"time"
)

type stat_t_wrapper struct {
	stat syscall.Stat_t
}

func (stat_t *stat_t_wrapper) Name() string {
	return "pem.key"
}

func (stat_t *stat_t_wrapper) Size() int64 {
	return int64(100)
}

func (stat_t *stat_t_wrapper) Mode() os.FileMode {
	return os.FileMode(stat_t.stat.Mode)
}

func (stat_t *stat_t_wrapper) ModTime() time.Time {
	return time.Now()
}

func (stat_t *stat_t_wrapper) IsDir() bool {
	return true
}

func (stat_t *stat_t_wrapper) Sys() interface{} {
	return &stat_t.stat
}

func TestHasCorrectRootGroupPermissions(t *testing.T) {
	currentUID := uint32(os.Getuid())
	currentGID := uint32(os.Getgid())

	testData := []struct {
		expectedError error
		stat          syscall.Stat_t
	}{
		{
			expectedError: nil,
			stat: syscall.Stat_t{
				Mode: 0600,
				Uid:  currentUID,
				Gid:  currentGID,
			},
		},
		{
			expectedError: nil,
			stat: syscall.Stat_t{
				Mode: 0640,
				Uid:  0,
				Gid:  currentGID,
			},
		},
		{
			expectedError: errSSLKeyHasUnacceptableUserPermissions,
			stat: syscall.Stat_t{
				Mode: 0666,
				Uid:  currentUID,
				Gid:  currentGID,
			},
		},
		{
			expectedError: errSSLKeyHasUnacceptableRootPermissions,
			stat: syscall.Stat_t{
				Mode: 0666,
				Uid:  0,
				Gid:  currentGID,
			},
		},
	}

	for _, test := range testData {
		wrapper := &stat_t_wrapper{
			stat: test.stat,
		}

		if test.expectedError != hasCorrectPermissions(wrapper) {
			if test.expectedError == nil {
				t.Errorf(
					"file owned by %d:%d with %s should not have failed check with error \"%s\"",
					test.stat.Uid,
					test.stat.Gid,
					wrapper.Mode(),
					hasCorrectPermissions(wrapper),
				)
				continue
			}
			t.Errorf(
				"file owned by %d:%d with %s, expected \"%s\", got \"%s\"",
				test.stat.Uid,
				test.stat.Gid,
				wrapper.Mode(),
				test.expectedError,
				hasCorrectPermissions(wrapper),
			)
		}
	}
}
