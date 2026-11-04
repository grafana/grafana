package converge

// detectMoves pairs a creation with a deletion of identical content into one
// identity-preserving relocation.
//
// It reads only the declarations and observations already in hand. A source
// that reports "A was renamed to B" supplies a hint about where to look and no
// authority over whether a rename happened, so the pairing is re-derived here
// and nowhere else. When it cannot be derived — two deletions share a content
// fingerprint, so the right partner is unknowable — the plan degrades to a
// delete and a create. That is not an error: the target ends up holding the
// same content either way, and only the surviving identity differs.
func (s *state) detectMoves(named map[Key]bool) {
	allowed := func(k Key) bool { return named == nil || named[k] }

	byFingerprint := make(map[Fingerprint]int)
	ambiguous := make(map[Fingerprint]bool)
	for i, op := range s.ops {
		if op.Kind != OpDelete || op.Reason != "" || op.Key.IsContainer() {
			continue
		}
		if !allowed(op.Key) {
			continue
		}
		fp := s.observedFingerprint(op.Key, op.Identity)
		if fp == "" {
			continue
		}
		if _, exists := byFingerprint[fp]; exists {
			ambiguous[fp] = true
		}
		byFingerprint[fp] = i
	}
	for fp := range ambiguous {
		delete(byFingerprint, fp)
	}
	if len(byFingerprint) == 0 {
		return
	}

	consumed := make(map[int]bool)
	for i, op := range s.ops {
		if op.Kind != OpCreate || op.Fingerprint == "" || op.Key.IsContainer() {
			continue
		}
		if !allowed(op.Key) {
			continue
		}
		j, ok := byFingerprint[op.Fingerprint]
		if !ok {
			continue
		}
		del := s.ops[j]
		s.ops[i] = Op{
			Kind:                OpMove,
			From:                del.Key,
			Key:                 op.Key,
			Identity:            del.Identity,
			Fingerprint:         op.Fingerprint,
			Container:           op.Container,
			ContainerIdentity:   op.ContainerIdentity,
			ContainerProvenance: op.ContainerProvenance,
		}
		consumed[j] = true
		delete(byFingerprint, op.Fingerprint)
	}
	if len(consumed) == 0 {
		return
	}

	kept := make([]Op, 0, len(s.ops)-len(consumed))
	for i, op := range s.ops {
		if !consumed[i] {
			kept = append(kept, op)
		}
	}
	s.ops = kept
}

func (s *state) observedFingerprint(k Key, id Identity) Fingerprint {
	for _, o := range s.obsEntity[k] {
		if o.Identity == id {
			return o.Fingerprint
		}
	}
	return ""
}
