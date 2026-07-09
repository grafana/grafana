package sender

import (
	"testing"

	"github.com/prometheus/common/model"
	"github.com/prometheus/prometheus/model/labels"
	"github.com/stretchr/testify/require"
)

func TestAlertHash_StableAndMatchesModelFingerprint(t *testing.T) {
	lbls := labels.FromStrings(
		"alertname", "TestAlert",
		"env", "prod",
		"job", "grafana",
		"severity", "critical",
	)

	alert := &Alert{Labels: lbls}

	// Hash must be stable across repeated calls.
	h1 := alert.Hash()
	h2 := alert.Hash()
	require.Equal(t, h1, h2, "Hash() must be deterministic")

	// Hash must equal model.LabelSet.Fingerprint() for the same label set.
	ls := make(model.LabelSet, lbls.Len())
	lbls.Range(func(l labels.Label) {
		ls[model.LabelName(l.Name)] = model.LabelValue(l.Value)
	})
	want := uint64(ls.Fingerprint())
	require.Equal(t, want, h1, "Hash() must match model.LabelSet.Fingerprint()")
}

func TestAlertHash_EmptyLabels(t *testing.T) {
	alert := &Alert{Labels: labels.EmptyLabels()}
	h1 := alert.Hash()
	h2 := alert.Hash()
	require.Equal(t, h1, h2)
}

func TestAlertHash_DifferentLabelSetsProduceDifferentHashes(t *testing.T) {
	a1 := &Alert{Labels: labels.FromStrings("alertname", "A")}
	a2 := &Alert{Labels: labels.FromStrings("alertname", "B")}
	require.NotEqual(t, a1.Hash(), a2.Hash())
}

func BenchmarkAlertHash(b *testing.B) {
	lbls := labels.FromStrings(
		"alertname", "TestAlert",
		"env", "prod",
		"job", "grafana",
		"namespace", "default",
		"severity", "critical",
	)
	alert := &Alert{Labels: lbls}
	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		_ = alert.Hash()
	}
}
