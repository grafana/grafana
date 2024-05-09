package sqlstash

import (
	"encoding/json"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/services/store/entity"
)

func TestNewEntitySerializedData(t *testing.T) {
	t.Parallel()

	// test data for maps
	someMap := map[string]string{
		"alpha": "aleph",
		"beta":  "beth",
	}
	someMapJSONb, err := json.Marshal(someMap)
	require.NoError(t, err)
	someMapJSON := string(someMapJSONb)

	// test data for errors
	someErrors := []*entity.EntityErrorInfo{
		{
			Code:        1,
			Message:     "not cool",
			DetailsJson: []byte(`"nothing to add"`),
		},
	}
	someErrorsJSONb, err := json.Marshal(someErrors)
	require.NoError(t, err)
	someErrorsJSON := string(someErrorsJSONb)

	t.Run("happy path - nothing to serialize", func(t *testing.T) {
		t.Parallel()

		d, err := newEntitySerializedData(&entity.Entity{
			Labels: map[string]string{},
			Fields: map[string]string{},
			Errors: []*entity.EntityErrorInfo{},
		})
		require.NoError(t, err)

		require.JSONEq(t, `{}`, string(d.Labels))
		require.JSONEq(t, `{}`, string(d.Fields))
		require.JSONEq(t, `[]`, string(d.Errors))

		// nil Go Object/Slice map to empty JSON Object/Array for consistency

		d, err = newEntitySerializedData(new(entity.Entity))
		require.NoError(t, err)

		require.JSONEq(t, `{}`, string(d.Labels))
		require.JSONEq(t, `{}`, string(d.Fields))
		require.JSONEq(t, `[]`, string(d.Errors))
	})

	t.Run("happy path - everything to serialize", func(t *testing.T) {
		t.Parallel()

		d, err := newEntitySerializedData(&entity.Entity{
			Labels: someMap,
			Fields: someMap,
			Errors: someErrors,
		})
		require.NoError(t, err)

		require.JSONEq(t, someMapJSON, string(d.Labels))
		require.JSONEq(t, someMapJSON, string(d.Fields))
		require.JSONEq(t, someErrorsJSON, string(d.Errors))
	})

	// NOTE: the error path for serialization is not reachable as far as we can
	// predict. If you find a way to simulate a serialization error, consider
	// raising awareness of such case(s) and add the corresponding tests here
}
