package annotation

import (
	"testing"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/data"
	typesv1 "github.com/grafana/pyroscope/api/gen/proto/go/types/v1"
	"github.com/stretchr/testify/require"
)

func TestConvertAnnotation(t *testing.T) {
	t.Run("converts a valid throttling annotation", func(t *testing.T) {
		rawAnnotation := `{"body":{"periodType":"day","periodLimitMb":1024,"limitResetTime":1609459200}}`
		timedAnnotation := &TimedAnnotation{
			Timestamp: 1609455600000,
			Annotation: &typesv1.ProfileAnnotation{
				Key:   string(ProfileAnnotationKeyThrottled),
				Value: rawAnnotation,
			},
		}

		processed, err := convertAnnotation(timedAnnotation)
		require.NoError(t, err)
		require.NotNil(t, processed)
		require.Contains(t, processed.text, "Ingestion limit (1.0 GiB/day) reached")
		require.Contains(t, processed.text, "day")
		require.Equal(t, int64(1609455600000), processed.time)
		require.Equal(t, int64(1609459200000), processed.timeEnd) // LimitResetTime * 1000
	})

	t.Run("converts a valid sampling annotation", func(t *testing.T) {
		rawAnnotation := `{"body":{"source": {"usageGroup":"group-1","probability":0.1}}}`
		timedAnnotation := &TimedAnnotation{
			Timestamp: 1609455600000,
			Annotation: &typesv1.ProfileAnnotation{
				Key:   string(ProfileAnnotationKeySampled),
				Value: rawAnnotation,
			},
		}

		processed, err := convertAnnotation(timedAnnotation)
		require.NoError(t, err)
		require.NotNil(t, processed)
		require.Contains(t, processed.text, "90.00% of profiles for this service have been dropped by sampling rules")
		require.Equal(t, int64(1609455600000), processed.time)
		require.Equal(t, int64(1609455600000), processed.timeEnd)
	})

	t.Run("ignores non-throttling annotations", func(t *testing.T) {
		timedAnnotation := &TimedAnnotation{
			Timestamp: 1000,
			Annotation: &typesv1.ProfileAnnotation{
				Key:   "some.other.key",
				Value: `{"test":"value"}`,
			},
		}

		processed, err := convertAnnotation(timedAnnotation)
		require.NoError(t, err)
		require.Nil(t, processed)
	})

	t.Run("handles invalid annotation data", func(t *testing.T) {
		timedAnnotation := &TimedAnnotation{
			Timestamp: 1000,
			Annotation: &typesv1.ProfileAnnotation{
				Key:   string(ProfileAnnotationKeyThrottled),
				Value: `invalid json`,
			},
		}

		processed, err := convertAnnotation(timedAnnotation)
		require.Error(t, err)
		require.Nil(t, processed)
		require.Contains(t, err.Error(), "error parsing annotation data")
	})
}

func TestProcessAnnotations(t *testing.T) {
	rawAnnotation := `{"body":{"periodType":"day","periodLimitMb":1024,"limitResetTime":1609459200}}`

	t.Run("processes multiple annotations", func(t *testing.T) {
		annotations := []*TimedAnnotation{
			{
				Timestamp: 1609455600000,
				Annotation: &typesv1.ProfileAnnotation{
					Key:   string(ProfileAnnotationKeyThrottled),
					Value: rawAnnotation,
				},
			},
			{
				Timestamp: 1609459200000,
				Annotation: &typesv1.ProfileAnnotation{
					Key:   string(ProfileAnnotationKeyThrottled),
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
					Key:   string(ProfileAnnotationKeyThrottled),
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

func TestGrafanaAnnotationDataAdd(t *testing.T) {
	t.Run("adds first annotation", func(t *testing.T) {
		ga := &grafanaAnnotationData{
			ids:       []string{},
			times:     []time.Time{},
			timeEnds:  []time.Time{},
			texts:     []string{},
			isRegions: []bool{},
		}

		annotation := &processedProfileAnnotation{
			id:       "test-id-1",
			text:     "Test annotation 1",
			time:     1609455600000,
			timeEnd:  1609459200000,
			isRegion: true,
		}

		ga.add(annotation)

		require.Equal(t, 1, len(ga.ids))
		require.Equal(t, "test-id-1", ga.ids[0])
		require.Equal(t, time.UnixMilli(1609455600000), ga.times[0])
		require.Equal(t, time.UnixMilli(1609459200000), ga.timeEnds[0])
		require.Equal(t, "Test annotation 1", ga.texts[0])
		require.Equal(t, true, ga.isRegions[0])
	})

	t.Run("adds different annotations", func(t *testing.T) {
		ga := &grafanaAnnotationData{
			ids:       []string{},
			times:     []time.Time{},
			timeEnds:  []time.Time{},
			texts:     []string{},
			isRegions: []bool{},
		}

		annotation1 := &processedProfileAnnotation{
			id:       "test-id-1",
			text:     "Test annotation 1",
			time:     1609455600000,
			timeEnd:  1609459200000,
			isRegion: true,
		}

		annotation2 := &processedProfileAnnotation{
			id:       "test-id-2",
			text:     "Test annotation 2",
			time:     1609463800000,
			timeEnd:  1609467400000,
			isRegion: false,
		}

		ga.add(annotation1)
		ga.add(annotation2)

		require.Equal(t, 2, len(ga.ids))
		require.Equal(t, "test-id-1", ga.ids[0])
		require.Equal(t, "test-id-2", ga.ids[1])
		require.Equal(t, time.UnixMilli(1609455600000), ga.times[0])
		require.Equal(t, time.UnixMilli(1609463800000), ga.times[1])
	})

	t.Run("removes duplicates and extends timeEnd", func(t *testing.T) {
		ga := &grafanaAnnotationData{
			ids:       []string{},
			times:     []time.Time{},
			timeEnds:  []time.Time{},
			texts:     []string{},
			isRegions: []bool{},
		}

		annotation1 := &processedProfileAnnotation{
			id:       "duplicate-id",
			text:     "First occurrence",
			time:     1609455600000,
			timeEnd:  1609459200000,
			isRegion: true,
		}

		annotation2 := &processedProfileAnnotation{
			id:       "duplicate-id",
			text:     "Second occurrence (should be ignored)",
			time:     1609460000000,
			timeEnd:  1609463600000,
			isRegion: false,
		}

		ga.add(annotation1)
		ga.add(annotation2)

		require.Equal(t, 1, len(ga.ids))
		require.Equal(t, 1, len(ga.times))
		require.Equal(t, 1, len(ga.timeEnds))
		require.Equal(t, 1, len(ga.texts))
		require.Equal(t, 1, len(ga.isRegions))

		require.Equal(t, "duplicate-id", ga.ids[0])
		require.Equal(t, time.UnixMilli(1609455600000), ga.times[0])    // Original time
		require.Equal(t, time.UnixMilli(1609463600000), ga.timeEnds[0]) // Extended timeEnd
		require.Equal(t, "First occurrence", ga.texts[0])               // Original text
		require.Equal(t, true, ga.isRegions[0])                         // Original isRegion
	})

	t.Run("handles multiple duplicates correctly", func(t *testing.T) {
		ga := &grafanaAnnotationData{
			ids:       []string{},
			times:     []time.Time{},
			timeEnds:  []time.Time{},
			texts:     []string{},
			isRegions: []bool{},
		}

		annotation1 := &processedProfileAnnotation{
			id:       "id-1",
			text:     "Annotation 1",
			time:     1609455600000,
			timeEnd:  1609459200000,
			isRegion: true,
		}

		// Add duplicate of first
		annotation1Duplicate := &processedProfileAnnotation{
			id:       "id-1",
			text:     "Annotation 1 duplicate",
			time:     1609460000000,
			timeEnd:  1609470000000,
			isRegion: false,
		}

		// Add a second, unique annotation
		annotation2 := &processedProfileAnnotation{
			id:       "id-2",
			text:     "Annotation 2",
			time:     1609480000000,
			timeEnd:  1609490000000,
			isRegion: false,
		}

		// Add duplicate of second
		annotation2Duplicate := &processedProfileAnnotation{
			id:       "id-2",
			text:     "Annotation 2 duplicate",
			time:     1609500000000,
			timeEnd:  1609510000000,
			isRegion: true,
		}

		ga.add(annotation1)
		ga.add(annotation1Duplicate)
		ga.add(annotation2)
		ga.add(annotation2Duplicate)

		require.Equal(t, 2, len(ga.ids))
		require.Equal(t, "id-1", ga.ids[0])
		require.Equal(t, "id-2", ga.ids[1])

		// The first annotation should have an extended timeEnd
		require.Equal(t, time.UnixMilli(1609455600000), ga.times[0])
		require.Equal(t, time.UnixMilli(1609470000000), ga.timeEnds[0])
		require.Equal(t, "Annotation 1", ga.texts[0])
		require.Equal(t, true, ga.isRegions[0])

		// The second annotation should have an extended timeEnd
		require.Equal(t, time.UnixMilli(1609480000000), ga.times[1])
		require.Equal(t, time.UnixMilli(1609510000000), ga.timeEnds[1])
		require.Equal(t, "Annotation 2", ga.texts[1])
		require.Equal(t, false, ga.isRegions[1])
	})
}

func TestCreateAnnotationFrame(t *testing.T) {
	rawAnnotation := `{"body":{"periodType":"day","periodLimitMb":1024,"limitResetTime":1609459200}}`

	t.Run("creates frame with correct fields", func(t *testing.T) {
		annotations := []*TimedAnnotation{
			{
				Timestamp: 1609455600000,
				Annotation: &typesv1.ProfileAnnotation{
					Key:   string(ProfileAnnotationKeyThrottled),
					Value: rawAnnotation,
				},
			},
		}

		frame, err := CreateAnnotationFrame(annotations)
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
		frame, err := CreateAnnotationFrame([]*TimedAnnotation{})
		require.NoError(t, err)
		require.NotNil(t, frame)
		require.Equal(t, 5, len(frame.Fields))
		require.Equal(t, 0, frame.Fields[0].Len())
	})
}
