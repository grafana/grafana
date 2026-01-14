package exemplar

import (
	"testing"

	"github.com/stretchr/testify/require"
)

func TestCreateExemplarFrame_ProfileType(t *testing.T) {
	exemplars := []*Exemplar{
		{ProfileId: "profile-1", SpanId: "span-1", Value: 1.0, Timestamp: 100, Labels: map[string]string{"pod": "pod-1"}},
		{ProfileId: "profile-2", SpanId: "span-2", Value: 2.0, Timestamp: 200, Labels: map[string]string{"pod": "pod-2"}},
	}
	labels := map[string]string{
		"service": "api",
	}
	frame := CreateExemplarFrame(labels, exemplars, ExemplarTypeProfile, "bytes")

	require.Equal(t, "exemplar", frame.Name)
	// Time, Value, Id, service (from labels), pod (from exemplar labels)
	require.Equal(t, 5, len(frame.Fields))
	require.Equal(t, "Time", frame.Fields[0].Name)
	require.Equal(t, "Value", frame.Fields[1].Name)
	require.Equal(t, "Id", frame.Fields[2].Name)

	// Check that Id field shows Profile ID
	require.Equal(t, "Profile ID", frame.Fields[2].Config.DisplayName)

	rows, err := frame.RowLen()
	require.NoError(t, err)
	require.Equal(t, 2, rows)

	row := frame.RowCopy(0)
	require.Equal(t, 5, len(row))
	require.Equal(t, 1.0, row[1])
	require.Equal(t, "profile-1", row[2]) // Should use ProfileId for profile type
}

func TestCreateExemplarFrame_SpanType(t *testing.T) {
	exemplars := []*Exemplar{
		{
			ProfileId: "profile-1",
			SpanId:    "span-abc123",
			Value:     100.0,
			Timestamp: 1000,
			Labels: map[string]string{
				"pod":       "pod-xyz",
				"namespace": "prod",
				"__name__":  "cpu",
			},
		},
	}
	labels := map[string]string{
		"service": "api",
	}
	frame := CreateExemplarFrame(labels, exemplars, ExemplarTypeSpan, "nanoseconds")

	require.Equal(t, "exemplar", frame.Name)

	// Check Value field configuration
	valueField := frame.Fields[1]
	require.Equal(t, "Value", valueField.Name)
	require.Equal(t, "Value", valueField.Config.DisplayName)
	require.Equal(t, "nanoseconds", valueField.Config.Unit)

	// Check Id field configuration
	idField := frame.Fields[2]
	require.Equal(t, "Id", idField.Name)
	require.Equal(t, "Span ID", idField.Config.DisplayName)

	// Verify span ID is used for span type
	rows, err := frame.RowLen()
	require.NoError(t, err)
	require.Equal(t, 1, rows)

	row := frame.RowCopy(0)
	require.Equal(t, "span-abc123", row[2]) // Should use SpanId for span type
}

func TestCreateExemplarFrame_AllLabelsIncluded(t *testing.T) {
	exemplars := []*Exemplar{
		{
			ProfileId: "profile-1",
			SpanId:    "span-1",
			Value:     1.0,
			Timestamp: 100,
			Labels: map[string]string{
				"pod":              "pod-1",
				"__profile_type__": "cpu",
				"__name__":         "process_cpu",
			},
		},
	}
	labels := map[string]string{
		"service": "api",
	}
	frame := CreateExemplarFrame(labels, exemplars, ExemplarTypeSpan, "count")

	// Verify all fields are created (including private labels)
	fieldNames := []string{}
	for _, field := range frame.Fields {
		fieldNames = append(fieldNames, field.Name)
	}

	require.Contains(t, fieldNames, "Time")
	require.Contains(t, fieldNames, "Value")
	require.Contains(t, fieldNames, "Id")
	require.Contains(t, fieldNames, "service")
	require.Contains(t, fieldNames, "pod")
	require.Contains(t, fieldNames, "__profile_type__")
	require.Contains(t, fieldNames, "__name__")
}

func TestCreateExemplarFrame_NoDuplicateFields(t *testing.T) {
	// Test that labels in both series labels and exemplar labels don't create duplicate fields
	exemplars := []*Exemplar{
		{
			ProfileId: "profile-1",
			SpanId:    "span-1",
			Value:     1.0,
			Timestamp: 100,
			Labels: map[string]string{
				"pod":       "exemplar-pod-123", // Different value than series label
				"namespace": "prod",              // This is only in exemplar labels
			},
		},
	}
	labels := map[string]string{
		"service": "api",
		"pod":     "series-pod-456", // This is also in exemplar labels but with different value
	}
	frame := CreateExemplarFrame(labels, exemplars, ExemplarTypeSpan, "short")

	// Count how many fields have each name
	fieldCounts := make(map[string]int)
	for _, field := range frame.Fields {
		fieldCounts[field.Name]++
	}

	// Each field name should appear exactly once
	require.Equal(t, 1, fieldCounts["Time"])
	require.Equal(t, 1, fieldCounts["Value"])
	require.Equal(t, 1, fieldCounts["Id"])
	require.Equal(t, 1, fieldCounts["service"])
	require.Equal(t, 1, fieldCounts["pod"], "pod field should appear exactly once, not duplicated")
	require.Equal(t, 1, fieldCounts["namespace"])

	// Verify the exemplar-specific pod value is used (not the series value)
	rows, err := frame.RowLen()
	require.NoError(t, err)
	require.Equal(t, 1, rows)

	podField, _ := frame.FieldByName("pod")
	require.NotNil(t, podField)
	require.Equal(t, "exemplar-pod-123", podField.At(0), "Should use exemplar-specific pod value, not series value")

	// Verify series label is used when exemplar doesn't have the label
	serviceField, _ := frame.FieldByName("service")
	require.NotNil(t, serviceField)
	require.Equal(t, "api", serviceField.At(0))

	// Verify exemplar-only label
	namespaceField, _ := frame.FieldByName("namespace")
	require.NotNil(t, namespaceField)
	require.Equal(t, "prod", namespaceField.At(0))
}

func TestCreateExemplarFrame_ExemplarValueTakesPrecedence(t *testing.T) {
	// Test that exemplar label values take precedence over series label values
	exemplars := []*Exemplar{
		{
			ProfileId: "profile-1",
			SpanId:    "span-1",
			Value:     1.0,
			Timestamp: 100,
			Labels: map[string]string{
				"pod":       "pod-abc",
				"node":      "node-xyz",
				"span_name": "my-span",
			},
		},
		{
			ProfileId: "profile-2",
			SpanId:    "span-2",
			Value:     2.0,
			Timestamp: 200,
			Labels: map[string]string{
				"pod":       "pod-def",
				"node":      "node-uvw",
				"span_name": "another-span",
			},
		},
	}
	labels := map[string]string{
		"service": "api",
	}
	frame := CreateExemplarFrame(labels, exemplars, ExemplarTypeSpan, "bytes")

	// Verify we have the correct number of rows
	rows, err := frame.RowLen()
	require.NoError(t, err)
	require.Equal(t, 2, rows)

	// Verify each exemplar has its own pod, node, and span_name values
	podField, _ := frame.FieldByName("pod")
	require.NotNil(t, podField)
	require.Equal(t, "pod-abc", podField.At(0))
	require.Equal(t, "pod-def", podField.At(1))

	nodeField, _ := frame.FieldByName("node")
	require.NotNil(t, nodeField)
	require.Equal(t, "node-xyz", nodeField.At(0))
	require.Equal(t, "node-uvw", nodeField.At(1))

	spanNameField, _ := frame.FieldByName("span_name")
	require.NotNil(t, spanNameField)
	require.Equal(t, "my-span", spanNameField.At(0))
	require.Equal(t, "another-span", spanNameField.At(1))

	// Verify series label is the same for both
	serviceField, _ := frame.FieldByName("service")
	require.NotNil(t, serviceField)
	require.Equal(t, "api", serviceField.At(0))
	require.Equal(t, "api", serviceField.At(1))
}
