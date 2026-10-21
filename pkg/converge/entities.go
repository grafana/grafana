package converge

// planEntities performs the set arithmetic between declared and observed
// entities. Everything excluded — by verdict, by an excluded container, or by
// a binding budget — is already absent from s.admitted, so it falls through to
// deletion here without a special case. That is the contract working: the
// desired state is one set, and absence from it has one consequence.
func (s *state) planEntities() {
	for _, k := range s.sortedEntityKeys(s.admitted) {
		d := s.admitted[k]
		obs := s.obsEntity[k]
		if len(obs) == 0 {
			s.emit(Op{Kind: OpCreate, Key: k, Fingerprint: d.Fingerprint})
			continue
		}

		primary := pickPrimary(obs, d.Fingerprint)
		// A target that holds more than one entity at a key is in a state it
		// should have prevented. Pick a survivor deterministically and remove
		// the rest, rather than letting map order decide which one the user
		// keeps.
		for _, o := range obs {
			if o.Identity == primary.Identity {
				continue
			}
			s.emit(Op{Kind: OpDelete, Key: k, Identity: o.Identity, Reason: ReasonDuplicate})
		}

		switch {
		case primary.Fingerprint != d.Fingerprint:
			s.emit(Op{Kind: OpUpdate, Key: k, Identity: primary.Identity, Fingerprint: d.Fingerprint})
		case s.needsReparent(k, primary):
			// Content is unchanged and the key is unchanged, but the container
			// beneath it is not the one this entity should end up in, so it is
			// rewritten to follow.
			s.emit(Op{
				Kind:        OpUpdate,
				Key:         k,
				Identity:    primary.Identity,
				Fingerprint: d.Fingerprint,
				Reason:      ReasonReparent,
			})
		}
	}

	gone := make([]Key, 0, len(s.obsEntity))
	for k := range s.obsEntity {
		if _, ok := s.admitted[k]; !ok {
			gone = append(gone, k)
		}
	}
	sortKeys(gone)
	for _, k := range gone {
		for _, o := range s.obsEntity[k] {
			s.emit(Op{Kind: OpDelete, Key: k, Identity: o.Identity})
		}
	}
}

// pickPrimary chooses which of several entities observed at one key survives:
// the one whose content matches the declaration, so an identity is preserved
// where possible, and otherwise the lowest identity so the choice is stable.
func pickPrimary(obs []Observation, want Fingerprint) Observation {
	primary := obs[0]
	for _, o := range obs {
		if o.Fingerprint == want {
			return o
		}
		if o.Identity < primary.Identity {
			primary = o
		}
	}
	return primary
}

// needsReparent reports whether an entity has to be rewritten even though its
// content has not changed, because the container it will sit in is not the one
// it sits in now.
//
// Two ways that happens: the container at its key is taking a new identity, or
// the target holds more than one container at that key and this entity belongs
// to one that is going away. The second is only knowable from
// [Observation.Parent], which is why a caller that can supply it should.
func (s *state) needsReparent(k Key, observed Observation) bool {
	parent := k.Parent()
	if parent == "" {
		return false
	}

	if observed.Parent != "" {
		if want, ok := s.wantCont[parent]; ok && want.identityMatters() && want.identity != observed.Parent {
			return true
		}
	}

	if len(s.reidentified) == 0 {
		return false
	}
	if _, ok := s.reidentified[parent]; ok {
		return true
	}
	if !s.cfg.containers.ReparentDescendants {
		return false
	}
	// Walking k's own ancestry is bounded by the key depth. Scanning every
	// re-identified container instead is the number of entities times the
	// number of re-identifications.
	found := false
	k.eachAncestor(func(c Key) bool {
		if _, ok := s.reidentified[c]; ok {
			found = true
			return false
		}
		return true
	})
	return found
}

// emit records an operation and resolves the container it lands in.
func (s *state) emit(op Op) {
	if !op.Kind.IsContainerOp() {
		op.Container, op.ContainerIdentity, op.ContainerProvenance = s.resolveContainer(op.Key)
	}
	if g, ok := s.reidentified[op.Container]; ok && op.Reason == ReasonReparent {
		op.Group = g
	}
	s.ops = append(s.ops, op)
}

// resolveContainer reports the container an entity key lands in, the identity
// that container will have once this plan has run, and where that identity
// came from.
//
// The identity the target already holds wins unless this plan is the thing
// changing it. That ordering is the point: a veto pass authorises against this
// value, and an identity the source asserted can be made to point at an object
// it does not own, so the trusted value is handed over whenever one exists and
// the provenance says plainly when none does.
func (s *state) resolveContainer(k Key) (Key, Identity, Provenance) {
	parent := k.Parent()
	if parent == "" {
		return "", "", FromInventory
	}

	if obs := s.obsCont[parent]; len(obs) > 0 {
		if _, changing := s.reidentified[parent]; !changing {
			return parent, obs[0].Identity, FromInventory
		}
	}
	if want, wanted := s.wantCont[parent]; wanted {
		return parent, want.identity, want.provenance
	}
	return parent, "", FromFallback
}
