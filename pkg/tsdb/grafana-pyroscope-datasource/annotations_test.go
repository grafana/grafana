package pyroscope

import (
	"testing"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/data"
	typesv1 "github.com/grafana/pyroscope/api/gen/proto/go/types/v1"
	"github.com/stretchr/testify/require"
)

func TestConvertAnnotation(t *testing.T) {
	rawAnnotation := `{"body":{"periodType":"day","periodLimitMb":1024,"limitResetTime":1609459200}}`

	t.Run("processes valid annotation", func(t *testing.T) {
		timedAnnotation := &TimedAnnotation{
			Timestamp: 1609455600000,
			Annotation: &typesv1.ProfileAnnotation{
				Key:   string(profileAnnotationKeyThrottled),
				Value: rawAnnotation,
			},
		}

		processed, err := convertAnnotation(timedAnnotation, 0)
		require.NoError(t, err)
		require.NotNil(t, processed)
		require.Contains(t, processed.text, "Ingestion limit (1.0 GiB/day) reached")
		require.Contains(t, processed.text, "day")
		require.Equal(t, int64(1609455600000), processed.time)
		require.Equal(t, int64(1609459200000), processed.timeEnd) // LimitResetTime * 1000
		require.Equal(t, int64(1609459200), processed.duplicateTracker)
	})

	t.Run("ignores non-throttling annotations", func(t *testing.T) {
		timedAnnotation := &TimedAnnotation{
			Timestamp: 1000,
			Annotation: &typesv1.ProfileAnnotation{
				Key:   "some.other.key",
				Value: `{"test":"value"}`,
			},
		}

		processed, err := convertAnnotation(timedAnnotation, 0)
		require.NoError(t, err)
		require.Nil(t, processed)
	})

	t.Run("handles invalid annotation data", func(t *testing.T) {
		timedAnnotation := &TimedAnnotation{
			Timestamp: 1000,
			Annotation: &typesv1.ProfileAnnotation{
				Key:   string(profileAnnotationKeyThrottled),
				Value: `invalid json`,
			},
		}

		processed, err := convertAnnotation(timedAnnotation, 0)
		require.Error(t, err)
		require.Nil(t, processed)
		require.Contains(t, err.Error(), "error parsing annotation data")
	})

	t.Run("skips duplicate annotations", func(t *testing.T) {
		timedAnnotation := &TimedAnnotation{
			Timestamp: 1000,
			Annotation: &typesv1.ProfileAnnotation{
				Key:   string(profileAnnotationKeyThrottled),
				Value: rawAnnotation,
			},
		}

		// First call should process the annotation
		processed1, err := convertAnnotation(timedAnnotation, 0)
		require.NoError(t, err)
		require.NotNil(t, processed1)

		// Second call with the same duplicateTracker should skip
		processed2, err := convertAnnotation(timedAnnotation, processed1.duplicateTracker)
		require.NoError(t, err)
		require.Nil(t, processed2)
	})
}

func TestProcessAnnotations(t *testing.T) {
	rawAnnotation := `{"body":{"periodType":"day","periodLimitMb":1024,"limitResetTime":1609459200}}`

	t.Run("processes multiple annotations", func(t *testing.T) {
		annotations := []*TimedAnnotation{
			{
				Timestamp: 1609455600000,
				Annotation: &typesv1.ProfileAnnotation{
					Key:   string(profileAnnotationKeyThrottled),
					Value: rawAnnotation,
				},
			},
			{
				Timestamp: 1609459200000,
				Annotation: &typesv1.ProfileAnnotation{
					Key:   string(profileAnnotationKeyThrottled),
					Value: rawAnnotation,
				},
			},
		}

		result, err := processAnnotations(annotations)
		require.NoError(t, err)
		require.Equal(t, 1, len(result.times))
		require.Equal(t, 1, len(result.timeEnds))
		require.Equal(t, 1, len(result.texts))
		require.Equal(t, 1, len(result.isRegions))
	})

	t.Run("handles empty annotations list", func(t *testing.T) {
		result, err := processAnnotations([]*TimedAnnotation{})
		require.NoError(t, err)
		require.Equal(t, 0, len(result.times))
		require.Equal(t, 0, len(result.timeEnds))
		require.Equal(t, 0, len(result.texts))
		require.Equal(t, 0, len(result.isRegions))
	})

	t.Run("handles nil annotations", func(t *testing.T) {
		annotations := []*TimedAnnotation{nil}
		result, err := processAnnotations(annotations)
		require.NoError(t, err)
		require.Equal(t, 0, len(result.times))
	})

	t.Run("handles invalid annotation data", func(t *testing.T) {
		annotations := []*TimedAnnotation{
			{
				Timestamp: 1000,
				Annotation: &typesv1.ProfileAnnotation{
					Key:   string(profileAnnotationKeyThrottled),
					Value: `invalid json`,
				},
			},
		}

		result, err := processAnnotations(annotations)
		require.Error(t, err)
		require.Nil(t, result)
		require.Contains(t, err.Error(), "error parsing annotation data")
	})
}

func TestCreateAnnotationFrame(t *testing.T) {
	rawAnnotation := `{"body":{"periodType":"day","periodLimitMb":1024,"limitResetTime":1609459200}}`

	t.Run("creates frame with correct fields", func(t *testing.T) {
		annotations := []*TimedAnnotation{
			{
				Timestamp: 1609455600000,
				Annotation: &typesv1.ProfileAnnotation{
					Key:   string(profileAnnotationKeyThrottled),
					Value: rawAnnotation,
				},
			},
		}

		frame, err := createAnnotationFrame(annotations)
		require.NoError(t, err)
		require.NotNil(t, frame)

		require.Equal(t, "annotations", frame.Name)
		require.Equal(t, data.DataTopicAnnotations, frame.Meta.DataTopic)

		require.Equal(t, 5, len(frame.Fields))
		require.Equal(t, "time", frame.Fields[0].Name)
		require.Equal(t, "timeEnd", frame.Fields[1].Name)
		require.Equal(t, "text", frame.Fields[2].Name)
		require.Equal(t, "isRegion", frame.Fields[3].Name)
		require.Equal(t, "color", frame.Fields[4].Name)

		require.Equal(t, 1, frame.Fields[0].Len())
		require.Equal(t, time.UnixMilli(1609455600000), frame.Fields[0].At(0))
		require.Equal(t, time.UnixMilli(1609459200000), frame.Fields[1].At(0))
		require.Contains(t, frame.Fields[2].At(0).(string), "Ingestion limit")
	})

	t.Run("handles empty annotations list", func(t *testing.T) {
		frame, err := createAnnotationFrame([]*TimedAnnotation{})
		require.NoError(t, err)
		require.NotNil(t, frame)
		require.Equal(t, 5, len(frame.Fields))
		require.Equal(t, 0, frame.Fields[0].Len())
	})
}
