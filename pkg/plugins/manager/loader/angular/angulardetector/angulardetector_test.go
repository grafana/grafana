package angulardetector

import (
	"context"
	"regexp"
	"testing"

	"github.com/stretchr/testify/require"
)

var testDetectors = []AngularDetector{
	&ContainsBytesDetector{Pattern: []byte("PanelCtrl")},
	&ContainsBytesDetector{Pattern: []byte("QueryCtrl")},
}

func TestContainsBytesDetector(t *testing.T) {
	detector := &ContainsBytesDetector{Pattern: []byte("needle")}
	t.Run("contains", func(t *testing.T) {
		require.True(t, detector.DetectAngular([]byte("lorem needle ipsum haystack")))
	})
	t.Run("not contains", func(t *testing.T) {
		require.False(t, detector.DetectAngular([]byte("ippif")))
	})
}

func TestRegexDetector(t *testing.T) {
	detector := &RegexDetector{Regex: regexp.MustCompile("hello world(?s)")}
	for _, tc := range []struct {
		name string
		s    string
		exp  bool
	}{
		{name: "match 1", s: "hello world", exp: true},
		{name: "match 2", s: "bla bla hello world bla bla", exp: true},
		{name: "match 3", s: "bla bla hello worlds bla bla", exp: true},
		{name: "no match", s: "bla bla hello you reading this test code", exp: false},
	} {
		t.Run(tc.s, func(t *testing.T) {
			r := detector.DetectAngular([]byte(tc.s))
			require.Equal(t, tc.exp, r, "DetectAngular result should be correct")
		})
	}
}

func TestStaticDetectorsProvider(t *testing.T) {
	p := StaticDetectorsProvider{Detectors: testDetectors}
	detectors := p.ProvideDetectors(context.Background())
	require.NotEmpty(t, detectors)
	require.Equal(t, testDetectors, detectors)
}

type fakeDetectorsProvider struct {
	calls   int
	returns []AngularDetector
}

func (p *fakeDetectorsProvider) ProvideDetectors(_ context.Context) []AngularDetector {
	p.calls += 1
	return p.returns
}

func TestSequenceDetectorsProvider(t *testing.T) {
	for _, tc := range []struct {
		name          string
		fakeProviders []*fakeDetectorsProvider
		exp           func(t *testing.T, fakeProviders []*fakeDetectorsProvider, detectors []AngularDetector)
	}{
		{
			name: "returns first non-empty provided angularDetectors (first)",
			fakeProviders: []*fakeDetectorsProvider{
				{returns: testDetectors},
				{returns: nil},
			},
			exp: func(t *testing.T, fakeProviders []*fakeDetectorsProvider, detectors []AngularDetector) {
				require.NotEmpty(t, detectors)
				require.Len(t, detectors, len(fakeProviders[0].returns))
				require.Equal(t, fakeProviders[0].returns, detectors)
				require.Equal(t, 1, fakeProviders[0].calls, "fake provider 0 should be called")
				require.Zero(t, fakeProviders[1].calls, "fake provider 1 should not be called")
			},
		},
		{
			name: "returns first non-empty provided angularDetectors (second)",
			fakeProviders: []*fakeDetectorsProvider{
				{returns: nil},
				{returns: testDetectors},
			},
			exp: func(t *testing.T, fakeProviders []*fakeDetectorsProvider, detectors []AngularDetector) {
				require.NotEmpty(t, detectors)
				require.Len(t, detectors, len(fakeProviders[1].returns))
				require.Equal(t, fakeProviders[1].returns, detectors)
				for i, p := range fakeProviders {
					require.Equalf(t, 1, p.calls, "fake provider %d should be called", i)
				}
			},
		},
		{
			name: "returns nil if all providers return empty",
			fakeProviders: []*fakeDetectorsProvider{
				{returns: nil},
				{returns: []AngularDetector{}},
			},
			exp: func(t *testing.T, fakeProviders []*fakeDetectorsProvider, detectors []AngularDetector) {
				require.Empty(t, detectors, "should not return any angularDetectors")
				for i, p := range fakeProviders {
					require.Equalf(t, 1, p.calls, "fake provider %d should be called", i)
				}
			},
		},
	} {
		t.Run(tc.name, func(t *testing.T) {
			seq := make(SequenceDetectorsProvider, 0, len(tc.fakeProviders))
			for _, p := range tc.fakeProviders {
				seq = append(seq, DetectorsProvider(p))
			}
			detectors := seq.ProvideDetectors(context.Background())
			tc.exp(t, tc.fakeProviders, detectors)
		})
	}
}
