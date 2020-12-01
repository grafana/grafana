package ngalert

import (
	"crypto/sha1"
	"encoding/json"
	"fmt"
	"sort"

	"github.com/grafana/grafana-plugin-sdk-go/data"
)

type InstanceLabels data.Labels

func (il *InstanceLabels) FromDB(b []byte) error {
	tl := &tupleLabels{}
	err := json.Unmarshal(b, tl)
	if err != nil {
		return err
	}
	labels, err := tupleLablesToLabels(*tl)
	if err != nil {
		return err
	}
	*il = labels
	return nil
}

func (il *InstanceLabels) ToDB() ([]byte, error) {
	// Currently handled manually in sql command, needed to fulfill the xorm
	// converter interface it seems
	return []byte{}, nil
}

// SetLabelsHash sets a key for the alert instance based on the alert
// id and labels and returns the json representation of the labels used
// to create the Hash.
func SetLabelsHash(labels InstanceLabels) (string, string, error) {
	tl := labelsToTupleLabels(labels)

	b, err := json.Marshal(tl)
	if err != nil {
		return "", "", fmt.Errorf("can not gereate key for alert instance due to failure to encode labels: %w", err)
	}

	h := sha1.New()
	h.Write(b)

	return string(b), fmt.Sprintf("%x", h.Sum(nil)), nil
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
func labelsToTupleLabels(l InstanceLabels) tupleLabels {
	t := make(tupleLabels, 0, len(l))
	for k, v := range l {
		t = append(t, tupleLabel{k, v})
	}
	t.sortBtKey()
	return t
}

// tupleLabelsToLabels converts tupleLabels to Labels (map[string]string), erroring if there are duplicate keys.
func tupleLablesToLabels(tuples tupleLabels) (InstanceLabels, error) {
	labels := make(map[string]string)
	for _, tuple := range tuples {
		if key, ok := labels[tuple[0]]; ok {
			return nil, fmt.Errorf("duplicate key '%v' in lables: %v", key, tuples)
		}
		labels[tuple[0]] = tuple[1]
	}
	return labels, nil
}
