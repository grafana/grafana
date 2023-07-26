package eval

import (
	"testing"

	"github.com/grafana/grafana-plugin-sdk-go/data"
	"github.com/stretchr/testify/require"
)

func TestLabelsFingerprint(t *testing.T) {
	testCases := []struct {
		name        string
		labels      data.Labels
		fingerprint fingerprint
	}{
		{
			name:        "should work if nil",
			labels:      nil,
			fingerprint: fingerprint(0xcbf29ce484222325),
		},
		{
			name:        "should work if empty",
			labels:      make(data.Labels),
			fingerprint: fingerprint(0xcbf29ce484222325),
		},
		{
			name:        "should calculate hash",
			labels:      data.Labels{"a": "AAA", "b": "BBB", "c": "CCC", "d": "DDD"},
			fingerprint: fingerprint(0xfb4532f90d896635),
		},
	}
	for _, testCase := range testCases {
		t.Run(testCase.name, func(t *testing.T) {
			require.Equal(t, testCase.fingerprint, fingerprintLabels(testCase.labels))
		})
	}
}

func TestLabelsFingerprintString(t *testing.T) {
	testCases := []struct {
		name        string
		fingerprint fingerprint
		expected    string
	}{
		{"simple", fingerprint(0x1234567890abcdef), "1234567890abcdef"},
		{"zero", fingerprint(0), "0000000000000000"},
		{"max", fingerprint(0xffffffffffffffff), "ffffffffffffffff"},
	}
	for _, testCase := range testCases {
		t.Run(testCase.name, func(t *testing.T) {
			require.Equal(t, testCase.expected, testCase.fingerprint.String())
		})
	}
}
