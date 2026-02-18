package exemplar

import (
	"testing"

	"github.com/stretchr/testify/require"
)

func TestCreateExemplarFrame(t *testing.T) {
	exemplars := []*Exemplar{
		{Id: "1", Value: 1.0, Timestamp: 100, Labels: map[string]string{"__private_label__": "omitted"}},
		{Id: "2", Value: 2.0, Timestamp: 200, Labels: map[string]string{"label1": "value1", "label2": "value2"}},
	}
	labels := map[string]string{
		"foo": "bar",
	}
	unit := "short"
	frame := CreateExemplarFrame(labels, exemplars, unit)

	require.Equal(t, "exemplar", frame.Name)
	require.Equal(t, 6, len(frame.Fields))
	require.Equal(t, "Time", frame.Fields[0].Name)
	require.Equal(t, "Value", frame.Fields[1].Name)
	require.Equal(t, "short", frame.Fields[1].Config.Unit)
	require.Equal(t, "Id", frame.Fields[2].Name)
	require.Equal(t, "foo", frame.Fields[3].Name)
	require.Equal(t, "label1", frame.Fields[4].Name)
	require.Equal(t, "label2", frame.Fields[5].Name)

	rows, err := frame.RowLen()
	require.NoError(t, err)
	require.Equal(t, 2, rows)
	row := frame.RowCopy(0)
	require.Equal(t, 6, len(row))
	require.Equal(t, 1.0, row[1])
	require.Equal(t, "1", row[2])
	require.Equal(t, "bar", row[3])
	require.Equal(t, "", row[4])
	require.Equal(t, "", row[5])
	row = frame.RowCopy(1)
	require.Equal(t, 6, len(row))
	require.Equal(t, 2.0, row[1])
	require.Equal(t, "2", row[2])
	require.Equal(t, "bar", row[3])
	require.Equal(t, "value1", row[4])
	require.Equal(t, "value2", row[5])
}
