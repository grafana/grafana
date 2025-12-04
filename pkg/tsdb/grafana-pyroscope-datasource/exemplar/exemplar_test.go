package exemplar

import (
	"testing"

	"github.com/stretchr/testify/require"
)

func TestCreateExemplarFrame(t *testing.T) {
	exemplars := []*Exemplar{
		{Id: "1", Value: 1.0, Timestamp: 100},
		{Id: "2", Value: 2.0, Timestamp: 200},
	}
	labels := map[string]string{
		"foo": "bar",
	}
	frame := CreateExemplarFrame(labels, exemplars)

	require.Equal(t, "exemplar", frame.Name)
	require.Equal(t, 4, len(frame.Fields))
	require.Equal(t, "Time", frame.Fields[0].Name)
	require.Equal(t, "Value", frame.Fields[1].Name)
	require.Equal(t, "Id", frame.Fields[2].Name)
	require.Equal(t, "foo", frame.Fields[3].Name)

	rows, err := frame.RowLen()
	require.NoError(t, err)
	require.Equal(t, 2, rows)
	row := frame.RowCopy(0)
	require.Equal(t, 4, len(row))
	require.Equal(t, 1.0, row[1])
	require.Equal(t, "1", row[2])
	require.Equal(t, "bar", row[3])
}
