package angulardetector

import (
	"context"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/plugins"
)

type fakeDetector struct {
	calls   int
	returns bool
}

func (d *fakeDetector) Detect(_ []byte) bool {
	d.calls += 1
	return d.returns
}

func TestPatternsListInspector(t *testing.T) {
	plugin := &plugins.Plugin{
		FS: plugins.NewInMemoryFS(map[string][]byte{"module.js": nil}),
	}

	for _, tc := range []struct {
		name          string
		fakeDetectors []*fakeDetector
		exp           func(t *testing.T, r bool, err error, fakeDetectors []*fakeDetector)
	}{
		{
			name: "calls the detectors in sequence until true is returned",
			fakeDetectors: []*fakeDetector{
				{returns: false},
				{returns: true},
				{returns: false},
			},
			exp: func(t *testing.T, r bool, err error, fakeDetectors []*fakeDetector) {
				require.NoError(t, err)
				require.True(t, r, "inspector should return true")
				require.Equal(t, 1, fakeDetectors[0].calls, "fake 0 should be called")
				require.Equal(t, 1, fakeDetectors[1].calls, "fake 1 should be called")
				require.Equal(t, 0, fakeDetectors[2].calls, "fake 2 should not be called")
			},
		},
		{
			name: "calls the detectors in sequence and returns false as default",
			fakeDetectors: []*fakeDetector{
				{returns: false},
				{returns: false},
			},
			exp: func(t *testing.T, r bool, err error, fakeDetectors []*fakeDetector) {
				require.NoError(t, err)
				require.False(t, r, "inspector should return false")
				require.Equal(t, 1, fakeDetectors[0].calls, "fake 0 should not be called")
				require.Equal(t, 1, fakeDetectors[1].calls, "fake 1 should not be called")
			},
		},
		{
			name:          "empty detectors should return false",
			fakeDetectors: nil,
			exp: func(t *testing.T, r bool, err error, fakeDetectors []*fakeDetector) {
				require.NoError(t, err)
				require.False(t, r, "inspector should return false")
			},
		},
	} {
		t.Run(tc.name, func(t *testing.T) {
			detectors := make([]detector, 0, len(tc.fakeDetectors))
			for _, d := range tc.fakeDetectors {
				detectors = append(detectors, detector(d))
			}
			inspector := &PatternsListInspector{
				detectorsProvider: &staticDetectorsProvider{detectors: detectors},
			}
			r, err := inspector.Inspect(context.Background(), plugin)
			tc.exp(t, r, err, tc.fakeDetectors)
		})
	}

}
