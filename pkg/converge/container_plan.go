package converge

// computeWantedContainers derives the container set the source implies, and
// resolves the identity each container should carry.
//
// A container is wanted when the source declares it, or — with
// [ContainerConfig.Implied] — when any admitted entity key passes through it.
// The identity comes from the declaration if one pins it, otherwise from
// [ContainerConfig.FallbackIdentity], and otherwise nowhere: a container with
// no identity of its own is satisfied by existing.
func (s *state) computeWantedContainers() error {
	cc := s.cfg.containers

	add := func(c Key, decl *Declaration) error {
		if cc.MaxDepth > 0 && c.Depth() > cc.MaxDepth {
			return keyErr(c, ErrDepthExceeded)
		}
		w := containerWant{provenance: FromFallback}
		if decl != nil {
			w.declared = true
			w.fingerprint = decl.Fingerprint
			if decl.Identity != "" {
				w.identity, w.provenance = decl.Identity, FromDeclaration
			}
		}
		if w.identity == "" && cc.FallbackIdentity != nil {
			w.identity, w.provenance = cc.FallbackIdentity(c), FromFallback
		}
		s.wantCont[c] = w
		return nil
	}

	keys := make([]Key, 0, len(s.contDecl))
	for c := range s.contDecl {
		keys = append(keys, c)
	}
	sortKeys(keys)
	excluded := make(map[Key]bool)
	for c, d := range s.contDecl {
		if d.Verdict == Excluded {
			excluded[c] = true
		}
	}

	for _, c := range keys {
		d := s.contDecl[c]
		if d.Verdict == Excluded {
			continue
		}
		// A container inside one the source refuses cannot exist either.
		// Without this the plan ensures a child inside a container it never
		// creates, or removes the refused parent while the child survives.
		if unreachable(c, excluded) {
			if !s.reportedExclusions[c] {
				s.reportedExclusions[c] = true
				s.exclusions = append(s.exclusions, Exclusion{
					Key:     c,
					Reason:  ReasonContainerExcluded,
					Removed: len(s.obsCont[c]) > 0,
				})
			}
			continue
		}
		if err := add(c, &d); err != nil {
			return err
		}
	}

	if cc.Implied {
		var walkErr error
		for _, k := range s.sortedEntityKeys(s.admitted) {
			if unreachable(k, excluded) {
				continue
			}
			k.eachAncestor(func(a Key) bool {
				if _, ok := s.wantCont[a]; ok {
					// Its own ancestors were added when it was.
					return false
				}
				if _, declared := s.contDecl[a]; declared {
					return true // excluded declaration: deliberately not wanted
				}
				if err := add(a, nil); err != nil {
					walkErr = err
					return false
				}
				return true
			})
			if walkErr != nil {
				return walkErr
			}
		}
	}

	// Every ancestor of a wanted container is itself wanted, or the plan would
	// try to create a container inside one that does not exist.
	if cc.Implied {
		for _, c := range s.sortedContainerKeys(s.wantCont) {
			for _, a := range c.Ancestors() {
				if _, ok := s.wantCont[a]; ok {
					continue
				}
				if _, declared := s.contDecl[a]; declared {
					continue
				}
				if err := add(a, nil); err != nil {
					return err
				}
			}
		}
	}
	return nil
}

// excludeUnreachableEntities removes entities whose container the source
// declares unholdable. Writing an entity into a container that cannot exist is
// not a smaller failure than refusing it, so it is refused — and named, with
// the container's reason, rather than dropped.
func (s *state) excludeUnreachableEntities() {
	if len(s.contDecl) == 0 {
		return
	}
	excludedContainers := make([]Key, 0)
	excludedSet := make(map[Key]bool)
	for c, d := range s.contDecl {
		if d.Verdict == Excluded {
			excludedContainers = append(excludedContainers, c)
			excludedSet[c] = true
		}
	}
	if len(excludedContainers) == 0 {
		return
	}
	sortKeys(excludedContainers)

	for _, k := range s.sortedEntityKeys(s.entities) {
		unreachable := false
		k.eachAncestor(func(c Key) bool {
			if excludedSet[c] {
				unreachable = true
				return false
			}
			return true
		})
		if !unreachable {
			continue
		}
		delete(s.entities, k)
		s.exclusions = append(s.exclusions, Exclusion{
			Key:     k,
			Reason:  ReasonContainerExcluded,
			Removed: len(s.obsEntity[k]) > 0,
		})
	}
	for _, c := range excludedContainers {
		if s.reportedExclusions[c] {
			continue
		}
		s.reportedExclusions[c] = true
		s.exclusions = append(s.exclusions, Exclusion{
			Key:     c,
			Reason:  s.contDecl[c].Reason,
			Removed: len(s.obsCont[c]) > 0,
		})
	}
}

// markReidentifications finds containers whose identity is changing before any
// entity operation is emitted, so that unchanged children can be rewritten to
// follow their container.
// demoteDuplicateContainerIdentities resolves two containers claiming one
// identity.
//
// The claim is dropped, not the container. A source that pins an identity
// another container already owns is still declaring a container at that key —
// only the override is unholdable — so the container keeps the identity it
// already has and the conflict is reported. Excluding it instead would delete
// a folder, and everything in it, because of one bad line in a metadata file.
//
// The first claimant in key order keeps the identity, which is what makes the
// outcome reproducible rather than a function of map iteration.
// preferWantedContainerObservations puts the observation whose identity the
// source wants at the head of each key's list.
//
// Everything downstream reads obsCont[c][0] as the survivor: re-identification
// compares against it, duplicate cleanup removes the rest, and parent
// resolution reports it. Leaving that to identity order means a key holding
// both the wanted identity and another one is re-identified *to* the identity
// it already has while that same identity is removed as surplus — an empty
// folder loses both, and a populated one fails cleanup.
func (s *state) preferWantedContainerObservations() {
	for c, want := range s.wantCont {
		if !want.identityMatters() {
			continue
		}
		obs := s.obsCont[c]
		for i, o := range obs {
			if o.Identity != want.identity || i == 0 {
				continue
			}
			obs[0], obs[i] = obs[i], obs[0]
			break
		}
	}
}

func (s *state) demoteDuplicateContainerIdentities() {
	if len(s.wantCont) < 2 {
		return
	}
	claimed := make(map[Identity]Key, len(s.wantCont))
	for _, c := range s.sortedContainerKeys(s.wantCont) {
		w := s.wantCont[c]
		if !w.identityMatters() {
			continue
		}
		if _, dup := claimed[w.identity]; !dup {
			claimed[w.identity] = c
			continue
		}

		if obs := s.obsCont[c]; len(obs) > 0 {
			w.identity, w.provenance = obs[0].Identity, FromInventory
		} else if s.cfg.containers.FallbackIdentity != nil {
			w.identity, w.provenance = s.cfg.containers.FallbackIdentity(c), FromFallback
		} else {
			w.identity, w.provenance = "", FromFallback
		}
		s.wantCont[c] = w

		s.exclusions = append(s.exclusions, Exclusion{Key: c, Reason: ReasonDuplicateIdentity})
	}
}

func (s *state) markReidentifications() error {
	// A targeted plan was handed a subset of the source, so it has no standing
	// to decide that a container's identity is wrong. It creates the path it
	// needs and leaves identities alone.
	if s.cfg.scope == ScopeTargeted {
		return nil
	}

	for _, c := range s.sortedContainerKeys(s.wantCont) {
		w := s.wantCont[c]
		if !w.identityMatters() {
			continue
		}

		obs := s.obsCont[c]
		if len(obs) == 0 || obs[0].Identity == w.identity {
			continue
		}
		// The container keeps its key and takes a new identity. Its children
		// must re-parent before the old container can be removed, so all three
		// belong to one group.
		s.reidentified[c] = GroupID("reidentify:" + string(c))
	}
	return nil
}

// planContainerOps emits the container operations: ensures for containers that
// must exist or take a new identity, relocations for containers that keep an
// identity at a new key, and removals for everything left over.
func (s *state) planContainerOps() {
	relocating := s.containerMoves()

	for _, c := range s.sortedContainerKeys(s.wantCont) {
		w := s.wantCont[c]
		if from, ok := relocating[c]; ok {
			parent, parentIdentity, parentProvenance := s.resolveContainer(c)
			s.ops = append(s.ops, Op{
				Kind:                OpMove,
				From:                from,
				Key:                 c,
				Identity:            w.identity,
				IdentityProvenance:  w.provenance,
				Fingerprint:         w.fingerprint,
				Container:           parent,
				ContainerIdentity:   parentIdentity,
				ContainerProvenance: parentProvenance,
			})
			continue
		}

		obs := s.obsCont[c]
		_, reidentifying := s.reidentified[c]
		switch {
		case len(obs) == 0:
			s.ops = append(s.ops, s.containerOp(OpEnsureContainer, c, w, ""))
		case !reidentifying && s.containerNeedsReparent(c, obs[0]):
			// A container sits inside another one, so it needs the same
			// treatment an entity does: when the container above it takes a
			// new identity, it has to be re-asserted or it keeps pointing at
			// the one that is going away.
			s.ops = append(s.ops, s.containerOp(OpEnsureContainer, c, w, ReasonParentChanged))
		case !reidentifying && w.fingerprint != obs[0].Fingerprint:
			// A container has content of its own — a title, a description,
			// whatever the source states about it — and that content can
			// change without the identity changing. Comparing only identities
			// leaves such a change unapplied forever: nothing in the plan ever
			// mentions the container again.
			//
			// The ensure is idempotent by contract, so re-asserting it is how
			// the content is refreshed.
			s.ops = append(s.ops, s.containerOp(OpEnsureContainer, c, w, ReasonContentChanged))
		case reidentifying:
			g := s.reidentified[c]
			op := s.containerOp(OpEnsureContainer, c, w, ReasonReparent)
			op.Group = g
			s.ops = append(s.ops, op)
			// The old container survives until its children have re-parented.
			s.ops = append(s.ops, Op{
				Kind:      OpRemoveContainer,
				Key:       c,
				Identity:  obs[0].Identity,
				Reason:    ReasonReparent,
				Group:     g,
				Container: c.Parent(),
			})
		}

		// Surplus containers at one key: same deterministic survivor rule as
		// entities, deferred so children can re-parent first.
		for i, o := range obs {
			if i == 0 {
				continue
			}
			s.ops = append(s.ops, Op{
				Kind:      OpRemoveContainer,
				Key:       c,
				Identity:  o.Identity,
				Reason:    ReasonDuplicate,
				Container: c.Parent(),
			})
		}
	}

	// A container a relocation vacates is not removed separately, so index the
	// origins once instead of scanning the relocation map per container.
	vacatedByMove := make(map[Key]bool, len(relocating))
	for _, from := range relocating {
		vacatedByMove[from] = true
	}

	gone := make([]Key, 0, len(s.obsCont))
	for c := range s.obsCont {
		if _, ok := s.wantCont[c]; ok {
			continue
		}
		if vacatedByMove[c] {
			continue
		}
		gone = append(gone, c)
	}
	sortKeys(gone)
	for _, c := range gone {
		for _, o := range s.obsCont[c] {
			s.ops = append(s.ops, Op{
				Kind:      OpRemoveContainer,
				Key:       c,
				Identity:  o.Identity,
				Container: c.Parent(),
			})
		}
	}
}

// containerNeedsReparent reports whether a container has to be re-asserted
// because the container above it is not the one it currently points at.
func (s *state) containerNeedsReparent(c Key, observed Observation) bool {
	if observed.Parent == "" {
		return false // the caller cannot tell us, so we do not guess
	}
	parent := c.Parent()
	if parent == "" {
		return false
	}
	want, ok := s.wantCont[parent]
	if !ok || !want.identityMatters() {
		return false
	}
	return want.identity != observed.Parent
}

// containerOp builds a container operation. Container names the container this
// one sits inside and ContainerIdentity is that container's identity, never
// this one's — the container's own identity is Identity. Conflating them tells
// a veto pass to authorise a folder creation against the folder being created.
func (s *state) containerOp(kind OpKind, c Key, w containerWant, reason Reason) Op {
	parent, parentIdentity, parentProvenance := s.resolveContainer(c)
	return Op{
		Kind:                kind,
		Key:                 c,
		Identity:            w.identity,
		IdentityProvenance:  w.provenance,
		Fingerprint:         w.fingerprint,
		Reason:              reason,
		Container:           parent,
		ContainerIdentity:   parentIdentity,
		ContainerProvenance: parentProvenance,
	}
}

// containerMoves finds containers that keep their identity at a new key. The
// identity legitimately resolves to both keys until the old one is removed, so
// a caller's duplicate-identity guard has to tolerate exactly these and no
// others — which is why they are reported as one [OpMove] rather than as an
// ensure plus a remove.
func (s *state) containerMoves() map[Key]Key {
	if !s.cfg.moves || s.cfg.scope == ScopeTargeted {
		// Same reason as entity moves: a targeted plan has no mandate to
		// relocate a container nobody named.
		return nil
	}
	byIdentity := make(map[Identity]Key, len(s.obsCont))
	for _, c := range s.sortedContainerKeys(s.obsCont) {
		for _, o := range s.obsCont[c] {
			if _, dup := byIdentity[o.Identity]; dup {
				byIdentity[o.Identity] = "" // ambiguous: never pair it
				continue
			}
			byIdentity[o.Identity] = c
		}
	}

	moves := make(map[Key]Key)
	for _, c := range s.sortedContainerKeys(s.wantCont) {
		w := s.wantCont[c]
		if !w.identityMatters() {
			continue
		}
		if len(s.obsCont[c]) > 0 {
			continue // already here: not a relocation
		}
		from, ok := byIdentity[w.identity]
		if !ok || from == "" || from == c {
			continue
		}
		if _, stillWanted := s.wantCont[from]; stillWanted {
			continue // both keys wanted: a collision, not a move
		}
		moves[c] = from
	}
	return moves
}

func (s *state) sortedContainerKeys(m any) []Key {
	var keys []Key
	switch v := m.(type) {
	case map[Key]containerWant:
		for k := range v {
			keys = append(keys, k)
		}
	case map[Key][]Observation:
		for k := range v {
			keys = append(keys, k)
		}
	}
	sortKeys(keys)
	return keys
}

// unreachable reports whether any container enclosing k is refused by the
// source. Anything inside one cannot be held either.
func unreachable(k Key, excluded map[Key]bool) bool {
	if len(excluded) == 0 {
		return false
	}
	found := false
	k.eachAncestor(func(a Key) bool {
		if excluded[a] {
			found = true
			return false
		}
		return true
	})
	return found
}
