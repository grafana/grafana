package ngalert

import (
	"crypto/sha1"
	"encoding/json"
	"fmt"
	"sort"

	"github.com/grafana/grafana-plugin-sdk-go/data"
)

// SetLabelsHash sets a key for the alert instance based on the alert
// id and labels and returns the json representation of the labels used
// to create the Hash.
func (ai *AlertInstance) SetLabelsHash() (string, error) {
	tl := labelsToTupleLabels(ai.Labels)

	b, err := json.Marshal(tl)
	if err != nil {
		return "", fmt.Errorf("can not gereate key for alert instance due to failure to encode labels: %w", err)
	}

	h := sha1.New()
	h.Write(b)
	ai.LabelsHash = fmt.Sprintf("%x", h.Sum(nil))

	return string(b), nil
}

// The following is based on SDK code, copied for now

// tupleLables is an alternative representation of Labels (map[string]string) that can be sorted
// and then marshalled into a consistent string that can be used a map key. All tupleLabel objects
// in tupleLabels should have unique first elements (keys).
type tupleLabels []tupleLabel

// tupleLabel is an element of tupleLabels and should be in the form of [2]{"key", "value"}.
type tupleLabel [2]string

// Sort tupleLabels by each elements first property (key).
func (t *tupleLabels) sortBtKey() {
	if t == nil {
		return
	}
	sort.Slice((*t)[:], func(i, j int) bool {
		return (*t)[i][0] < (*t)[j][0]
	})
}

// labelsToTupleLabels converts Labels (map[string]string) to tupleLabels.
func labelsToTupleLabels(l data.Labels) tupleLabels {
	t := make(tupleLabels, 0, len(l))
	for k, v := range l {
		t = append(t, tupleLabel{k, v})
	}
	t.sortBtKey()
	return t
}
