package schedule

import (
	"context"
	"encoding/binary"
	"hash/fnv"
	"strings"

	"github.com/grafana/grafana/pkg/services/ngalert/models"
)

// ruleSequenceFingerprint returns a hash that covers every field that affects
// scheduling behavior: UID, interval, and the ordered membership lists. Two
// sequences that differ in any of these fields will produce different
// fingerprints.
func ruleSequenceFingerprint(s models.SchedulableRuleSequence) uint64 {
	h := fnv.New64()
	buf := make([]byte, 8)

	_, _ = h.Write([]byte(s.UID))
	_, _ = h.Write([]byte{0xff})

	binary.LittleEndian.PutUint64(buf, uint64(s.IntervalSeconds))
	_, _ = h.Write(buf)

	// Use a separator between recording and alert refs so that moving a UID
	// from one list to the other changes the fingerprint.
	_, _ = h.Write([]byte(strings.Join(s.RecordingRuleRefs, "\x00")))
	_, _ = h.Write([]byte{0xff})
	_, _ = h.Write([]byte(strings.Join(s.AlertRuleRefs, "\x00")))

	return h.Sum64()
}

// RuleSequenceStore provides rule sequence definitions for scheduling.
type RuleSequenceStore interface {
	GetRuleSequencesForScheduling(ctx context.Context) ([]models.SchedulableRuleSequence, error)
}

// NoopRuleSequenceStore is a RuleSequenceStore that always returns an empty
// slice. Used as the default when rule sequences are not enabled.
type NoopRuleSequenceStore struct{}

func (n *NoopRuleSequenceStore) GetRuleSequencesForScheduling(ctx context.Context) ([]models.SchedulableRuleSequence, error) {
	return []models.SchedulableRuleSequence{}, nil
}
