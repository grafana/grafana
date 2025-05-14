package models

import (
	"fmt"
	"testing"

	"github.com/grafana/grafana-plugin-sdk-go/data"
	"github.com/stretchr/testify/require"
)

func TestTupleLabelsToLabels(t *testing.T) {
	t.Run("converts tupleLabels to InstanceLabels", func(t *testing.T) {
		in := tupleLabels{
			{"foo", "bar"},
			{"baz", "qux"},
		}

		labels, err := tupleLablesToLabels(in)
		require.NoError(t, err)
		require.Equal(t, InstanceLabels{
			"foo": "bar",
			"baz": "qux",
		}, labels)
	})

	t.Run("nil input gives empty output", func(t *testing.T) {
		labels, err := tupleLablesToLabels(nil)
		require.NoError(t, err)
		require.Empty(t, labels)
	})

	t.Run("duplicate keys are not allowed", func(t *testing.T) {
		in := tupleLabels{
			{"foo", "bar"},
			{"foo", "qux"},
		}

		_, err := tupleLablesToLabels(in)
		require.Error(t, err)
	})
}

func TestInstanceLabelsFingerprint(t *testing.T) {
	t.Run("returns labels fingerprint", func(t *testing.T) {
		labels := InstanceLabels{
			"foo": "bar",
			"baz": "qux",
		}

		fingerprint := labels.Fingerprint()
		expectedFingerprint := data.Labels(labels).Fingerprint()
		require.Equal(t, expectedFingerprint, fingerprint)
	})
}

func BenchmarkTupleLabelsToLabels(b *testing.B) {
	b.Run("10 labels", func(b *testing.B) {
		in := make(tupleLabels, 0, 10)
		for i := 0; i < 10; i++ {
			key := fmt.Sprintf("key%d", i)
			value := fmt.Sprintf("value%d", i)
			in = append(in, tupleLabel{key, value})
		}

		b.ResetTimer()

		for i := 0; i < b.N; i++ {
			_, err := tupleLablesToLabels(in)
			if err != nil {
				b.Fatal(err)
			}
		}
	})

	b.Run("100 labels", func(b *testing.B) {
		in := make(tupleLabels, 0, 100)
		for i := 0; i < 100; i++ {
			key := fmt.Sprintf("key%d", i)
			value := fmt.Sprintf("value%d", i)
			in = append(in, tupleLabel{key, value})
		}

		b.ResetTimer()

		for i := 0; i < b.N; i++ {
			_, err := tupleLablesToLabels(in)
			if err != nil {
				b.Fatal(err)
			}
		}
	})

	b.Run("10_000 labels", func(b *testing.B) {
		in := make(tupleLabels, 0, 10_000)
		for i := 0; i < 10_000; i++ {
			key := fmt.Sprintf("key%d", i)
			value := fmt.Sprintf("value%d", i)
			in = append(in, tupleLabel{key, value})
		}

		b.ResetTimer()

		for i := 0; i < b.N; i++ {
			_, err := tupleLablesToLabels(in)
			if err != nil {
				b.Fatal(err)
			}
		}
	})

	b.Run("1_000_000 labels", func(b *testing.B) {
		in := make(tupleLabels, 0, 1_000_000)
		for i := 0; i < 1_000_000; i++ {
			key := fmt.Sprintf("key%d", i)
			value := fmt.Sprintf("value%d", i)
			in = append(in, tupleLabel{key, value})
		}

		b.ResetTimer()

		for i := 0; i < b.N; i++ {
			_, err := tupleLablesToLabels(in)
			if err != nil {
				b.Fatal(err)
			}
		}
	})
}
