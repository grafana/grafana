package schedule

import (
	"context"
	"encoding/binary"
	"hash/fnv"
	"strings"

	"github.com/grafana/grafana/pkg/services/ngalert/models"
)

// ruleChainFingerprint returns a hash that covers every field that affects
// scheduling behavior: UID, interval, and the ordered membership lists. Two
// chains that differ in any of these fields will produce different fingerprints.
func ruleChainFingerprint(c models.SchedulableRuleChain) uint64 {
	h := fnv.New64()
	buf := make([]byte, 8)

	_, _ = h.Write([]byte(c.UID))
	_, _ = h.Write([]byte{0xff})

	binary.LittleEndian.PutUint64(buf, uint64(c.IntervalSeconds))
	_, _ = h.Write(buf)

	// Use a separator between recording and alert refs so that moving a UID
	// from one list to the other changes the fingerprint.
	_, _ = h.Write([]byte(strings.Join(c.RecordingRuleRefs, "\x00")))
	_, _ = h.Write([]byte{0xff})
	_, _ = h.Write([]byte(strings.Join(c.AlertRuleRefs, "\x00")))

	return h.Sum64()
}

// RuleChainStore provides rule chain definitions for scheduling.
type RuleChainStore interface {
	GetRuleChainForScheduling(ctx context.Context) ([]models.SchedulableRuleChain, error)
}

// NoopRuleChainStore is a RuleChainStore that always returns an empty slice.
// Used as the default when rule chains are not enabled.
type NoopRuleChainStore struct{}

func (n *NoopRuleChainStore) GetRuleChainForScheduling(ctx context.Context) ([]models.SchedulableRuleChain, error) {
	return []models.SchedulableRuleChain{}, nil
}
