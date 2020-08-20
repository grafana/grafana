package dashdiffs

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/components/simplejson"
)

func TestDiff(t *testing.T) {
	// Sample json docs for tests only
	const (
		leftJSON = `{
			"key": "value",
			"object": {
				"key": "value",
				"anotherObject": {
					"same": "this field is the same in rightJSON",
					"change": "this field should change in rightJSON",
					"delete": "this field doesn't appear in rightJSON"
				}
			},
			"array": [
				"same",
				"change",
				"delete"
			],
			"embeddedArray": {
				"array": [
					"same",
					"change",
					"delete"
				]
			}
		}`

		rightJSON = `{
			"key": "differentValue",
			"object": {
				"key": "value",
				"newKey": "value",
				"anotherObject": {
					"same": "this field is the same in rightJSON",
					"change": "this field should change in rightJSON",
					"add": "this field is added"
				}
			},
			"array": [
				"same",
				"changed!",
				"add"
			],
			"embeddedArray": {
				"array": [
					"same",
					"changed!",
					"add"
				]
			}
		}`
	)

	// Compute the diff between the two JSON objects
	baseData, err := simplejson.NewJson([]byte(leftJSON))
	require.NoError(t, err)

	newData, err := simplejson.NewJson([]byte(rightJSON))
	require.NoError(t, err)

	left, jsonDiff, err := getDiff(baseData, newData)
	require.NoError(t, err)

	t.Run("JSONFormatter produces expected JSON tokens", func(t *testing.T) {
		f := NewJSONFormatter(left)
		_, err := f.Format(jsonDiff)
		require.NoError(t, err)

		// Total up the change types. If the number of different change
		// types is correct, it means that the diff is producing correct
		// output to the template rendered.
		changeCounts := make(map[ChangeType]int)
		for _, line := range f.Lines {
			changeCounts[line.Change]++
		}

		// The expectedChangeCounts here were determined by manually
		// looking at the JSON
		expectedChangeCounts := map[ChangeType]int{
			ChangeNil:       12,
			ChangeAdded:     2,
			ChangeDeleted:   1,
			ChangeOld:       5,
			ChangeNew:       5,
			ChangeUnchanged: 5,
		}
		assert.EqualValues(t, expectedChangeCounts, changeCounts)
	})

	t.Run("BasicFormatter produces expected BasicBlocks", func(t *testing.T) {
		f := NewBasicFormatter(left)
		_, err := f.Format(jsonDiff)
		require.NoError(t, err)

		bd := &BasicDiff{}
		blocks := bd.Basic(f.jsonDiff.Lines)

		changeCounts := make(map[ChangeType]int)
		for _, block := range blocks {
			for _, change := range block.Changes {
				changeCounts[change.Change]++
			}

			for _, summary := range block.Summaries {
				changeCounts[summary.Change]++
			}

			changeCounts[block.Change]++
		}

		expectedChangeCounts := map[ChangeType]int{
			ChangeNil:     3,
			ChangeAdded:   2,
			ChangeDeleted: 1,
			ChangeOld:     3,
		}
		assert.EqualValues(t, expectedChangeCounts, changeCounts)
	})
}
