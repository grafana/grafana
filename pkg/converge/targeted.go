package converge

// namedContentDiffers reports whether the source states something about the
// container that the target does not already hold.
func (s *state) namedContentDiffers(c Key) bool {
	obs := s.obsCont[c]
	if len(obs) == 0 {
		return false
	}
	want, ok := s.wantCont[c]
	if !ok {
		return false
	}
	return want.fingerprint != obs[0].Fingerprint
}

// containerHasContents reports whether the target holds anything inside the
// container, by key or by parent identity.
func (s *state) containerHasContents(c Key) bool {
	for k, obs := range s.obsEntity {
		if k.Within(c) {
			return true
		}
		for _, o := range obs {
			for _, container := range s.obsCont[c] {
				if o.Parent != "" && o.Parent == container.Identity {
					return true
				}
			}
		}
	}
	for other := range s.obsCont {
		if other.Within(c) {
			return true
		}
	}
	return false
}

// restrictToTargeted drops everything a targeted plan has no mandate to touch.
//
// A targeted plan is handed a subset of the source and makes no claim about the
// rest, so it has no basis for deciding that a container's identity is wrong or
// that an entity nobody mentioned should go. Without this, writing one file
// would re-identify the container it lands in and remove whatever else happened
// to fall inside the hint closure — side effects the caller did not ask for and
// a user would not predict.
//
// What survives is exactly: operations on the keys the caller named, and the
// container ensures that make those operations possible. Everything else in the
// closure stays as read-only context — it is still needed to pair a relocation
// and to resolve which container a write lands in, but it is not acted on.
func (s *state) restrictToTargeted(hinted []Key) {
	named := make(map[Key]bool, len(hinted))
	for _, k := range hinted {
		named[k] = true
		named[k.AsContainer()] = true
	}

	// Which containers this plan actually needs: the ones a surviving operation
	// lands in, and everything above them. The closure also admits keys reached
	// by a fingerprint match, so a container elsewhere in the source can carry
	// a missing-container ensure with nothing surviving inside it — creating a
	// folder the caller never mentioned.
	required := make(map[Key]bool, len(hinted))
	requireAncestry := func(k Key) {
		for p := k.Parent(); p != ""; p = p.Parent() {
			if required[p] {
				break
			}
			required[p] = true
		}
	}
	for _, op := range s.ops {
		switch op.Kind {
		case OpEnsureContainer:
			if named[op.Key] {
				required[op.Key] = true
				requireAncestry(op.Key)
			}
		case OpRemoveContainer:
			// A removal needs nothing brought into existence.
		default:
			if named[op.Key] || (op.From != "" && named[op.From]) {
				requireAncestry(op.Key)
			}
		}
	}

	kept := s.ops[:0]
	for _, op := range s.ops {
		switch op.Kind {
		case OpEnsureContainer:
			switch {
			case len(s.obsCont[op.Key]) == 0 && required[op.Key]:
				// A container the path needs and the target does not have.
				op.Reason = ""
				op.Group = ""
				kept = append(kept, op)
			case named[op.Key] && s.namedContentDiffers(op.Key):
				// The caller named this container and what the source says
				// about it differs from what the target holds, so that is the
				// write it asked for — whatever reason the planner attached.
				// A nested folder whose observed parent is a pinned UID gets
				// ReasonParentChanged here, because Targeted declares a bare
				// ancestor whose derived identity differs; matching on
				// ReasonContentChanged alone dropped the requested edit.
				//
				// The identity comes from the target in every case: a targeted
				// plan updates what a container says about itself, never which
				// container it is. Marking it observed matters: a veto pass
				// that saw a path-derived fallback here would treat it as
				// trusted and check permission against a folder that does not
				// exist.
				op.Identity = s.obsCont[op.Key][0].Identity
				op.IdentityProvenance = FromInventory
				op.Reason = ReasonContentChanged
				op.Group = ""
				kept = append(kept, op)
			default:
				// An incidental ancestor update or re-identification the
				// caller did not ask for.
			}
		case OpRemoveContainer:
			// Only if the container is empty. Keeping the removal while the
			// operations that would empty it are dropped below produces a plan
			// that violates the empty-before-removal guarantee — and a caller
			// that asked to delete one folder did not ask to delete what is in
			// it. A recursive delete has to be an explicit request.
			if named[op.Key] && !s.containerHasContents(op.Key) {
				kept = append(kept, op)
			}
		default:
			if named[op.Key] || (op.From != "" && named[op.From]) {
				op.Group = ""
				if op.Reason == ReasonReparent {
					op.Reason = ""
				}
				kept = append(kept, op)
			}
		}
	}
	s.ops = kept

	// Exclusions follow the same rule: a plan that never surveyed the source
	// must not imply it did by listing what it happened to see.
	keptExclusions := s.exclusions[:0]
	for _, e := range s.exclusions {
		if named[e.Key] {
			keptExclusions = append(keptExclusions, e)
		}
	}
	s.exclusions = keptExclusions
}
