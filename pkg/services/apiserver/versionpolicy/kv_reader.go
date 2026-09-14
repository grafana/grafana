package versionpolicy

import (
	"context"
	"encoding/json"
	"fmt"
	"slices"

	"github.com/grafana/grafana/pkg/storage/unified/resource/kv"
)

const readBatchSize = 50

// KVReader reads the operator-set runtime layer from KV, one entry per group. A nil reader or store
// reads as no layer, so the registry falls back to ini.
type KVReader struct {
	store kv.KV
}

func NewKVReader(store kv.KV) *KVReader {
	return &KVReader{store: store}
}

// Read loads the per-group runtime layer. An error is returned rather than partially applied, so the
// caller keeps its last-known layer.
func (r *KVReader) Read(ctx context.Context) (map[string]VersionPolicy, error) {
	if r == nil || r.store == nil {
		return nil, nil
	}

	var keys []string
	for key, err := range r.store.Keys(ctx, kv.VersionPolicySection, kv.ListOptions{}) {
		if err != nil {
			return nil, err
		}
		keys = append(keys, key)
	}
	if len(keys) == 0 {
		return map[string]VersionPolicy{}, nil
	}

	layer := make(map[string]VersionPolicy, len(keys))
	for batch := range slices.Chunk(keys, readBatchSize) {
		for kve, err := range r.store.BatchGet(ctx, kv.VersionPolicySection, batch) {
			if err != nil {
				return nil, err
			}
			var p VersionPolicy
			dec := json.NewDecoder(kve.Value)
			dec.DisallowUnknownFields()
			decodeErr := dec.Decode(&p)
			_ = kve.Value.Close()
			if decodeErr != nil {
				return nil, fmt.Errorf("version policy: decoding KV value for group %q: %w", kve.Key, decodeErr)
			}
			if err := validatePolicy(p); err != nil {
				return nil, fmt.Errorf("version policy: invalid entry for group %q: %w", kve.Key, err)
			}
			layer[kve.Key] = p
		}
	}
	return layer, nil
}

func validatePolicy(p VersionPolicy) error {
	for _, v := range []string{p.PreferredVersion, p.MaxAllowedVersion} {
		if v == "" {
			continue
		}
		if _, ok := capRank(v); !ok {
			return fmt.Errorf("unparseable version %q", v)
		}
	}
	return nil
}
