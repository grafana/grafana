package angulardetector

import (
	"context"
	"regexp"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestContainsBytesDetector(t *testing.T) {
	detector := &containsBytesDetector{pattern: []byte("needle")}
	t.Run("contains", func(t *testing.T) {
		require.True(t, detector.Detect([]byte("lorem needle ipsum haystack")))
	})
	t.Run("not contains", func(t *testing.T) {
		require.False(t, detector.Detect([]byte("ippif")))
	})
}

func TestRegexDetector(t *testing.T) {
	detector := &regexDetector{regex: regexp.MustCompile("hello world(?s)")}
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
			r := detector.Detect([]byte(tc.s))
			require.Equal(t, tc.exp, r, "detector result should be correct")
		})
	}
}

func TestStaticDetectorsProvider(t *testing.T) {
	p := staticDetectorsProvider{detectors: defaultDetectors}
	detectors := p.provideDetectors(context.Background())
	require.NotEmpty(t, detectors)
	require.Equal(t, defaultDetectors, detectors)
}

type fakeDetectorsProvider struct {
	calls   int
	returns []detector
}

func (p *fakeDetectorsProvider) provideDetectors(_ context.Context) []detector {
	p.calls += 1
	return p.returns
}

func TestSequenceDetectorsProvider(t *testing.T) {
	for _, tc := range []struct {
		name          string
		fakeProviders []*fakeDetectorsProvider
		exp           func(t *testing.T, fakeProviders []*fakeDetectorsProvider, detectors []detector)
	}{
		{
			name: "returns first non-empty provided detectors (first)",
			fakeProviders: []*fakeDetectorsProvider{
				{returns: defaultDetectors},
				{returns: nil},
			},
			exp: func(t *testing.T, fakeProviders []*fakeDetectorsProvider, detectors []detector) {
				require.NotEmpty(t, detectors)
				require.Len(t, detectors, len(fakeProviders[0].returns))
				require.Equal(t, fakeProviders[0].returns, detectors)
				require.Equal(t, 1, fakeProviders[0].calls, "fake provider 0 should be called")
				require.Zero(t, fakeProviders[1].calls, "fake provider 1 should not be called")
			},
		},
		{
			name: "returns first non-empty provided detectors (second)",
			fakeProviders: []*fakeDetectorsProvider{
				{returns: nil},
				{returns: defaultDetectors},
			},
			exp: func(t *testing.T, fakeProviders []*fakeDetectorsProvider, detectors []detector) {
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
				{returns: []detector{}},
			},
			exp: func(t *testing.T, fakeProviders []*fakeDetectorsProvider, detectors []detector) {
				require.Empty(t, detectors, "should not return any detectors")
				for i, p := range fakeProviders {
					require.Equalf(t, 1, p.calls, "fake provider %d should be called", i)
				}
			},
		},
	} {
		t.Run(tc.name, func(t *testing.T) {
			seq := make(sequenceDetectorsProvider, 0, len(tc.fakeProviders))
			for _, p := range tc.fakeProviders {
				seq = append(seq, detectorsProvider(p))
			}
			detectors := seq.provideDetectors(context.Background())
			tc.exp(t, tc.fakeProviders, detectors)
		})
	}
}
