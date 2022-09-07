package models

import (
	// nolint:gosec
	"crypto/sha1"
	"encoding/json"
	"fmt"
	"sort"

	"github.com/grafana/grafana-plugin-sdk-go/data"
)

// InstanceLabels is an extension to data.Labels with methods
// for database serialization.
type InstanceLabels data.Labels

// FromDB loads labels stored in the database as json tuples into InstanceLabels.
// FromDB is part of the xorm Conversion interface.
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

// ToDB is not implemented as serialization is handled with manual SQL queries).
// ToDB is part of the xorm Conversion interface.
func (il *InstanceLabels) ToDB() ([]byte, error) {
	// Currently handled manually in sql command, needed to fulfill the xorm
	// converter interface it seems
	return []byte{}, fmt.Errorf("database serialization of alerting ng Instance labels is not implemented")
}

func (il *InstanceLabels) StringKey() (string, error) {
	tl := labelsToTupleLabels(*il)
	b, err := json.Marshal(tl)
	if err != nil {
		return "", fmt.Errorf("could not generate key due to failure to encode labels: %w", err)
	}
	return string(b), nil
}

// StringAndHash returns a the json representation of the labels as tuples
// sorted by key. It also returns the a hash of that representation.
func (il *InstanceLabels) StringAndHash() (string, string, error) {
	tl := labelsToTupleLabels(*il)

	b, err := json.Marshal(tl)
	if err != nil {
		return "", "", fmt.Errorf("could not generate key for alert instance due to failure to encode labels: %w", err)
	}

	h := sha1.New()
	if _, err := h.Write(b); err != nil {
		return "", "", err
	}

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
func (t *tupleLabels) sortByKey() {
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
	t.sortByKey()
	return t
}

// tupleLabelsToLabels converts tupleLabels to Labels (map[string]string), erroring if there are duplicate keys.
func tupleLablesToLabels(tuples tupleLabels) (InstanceLabels, error) {
	if tuples == nil {
		return InstanceLabels{}, nil
	}
	labels := make(map[string]string)
	for _, tuple := range tuples {
		if key, ok := labels[tuple[0]]; ok {
			return nil, fmt.Errorf("duplicate key '%v' in lables: %v", key, tuples)
		}
		labels[tuple[0]] = tuple[1]
	}
	return labels, nil
}
