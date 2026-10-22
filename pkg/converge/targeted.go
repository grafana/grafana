package converge

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

	kept := s.ops[:0]
	for _, op := range s.ops {
		switch op.Kind {
		case OpEnsureContainer:
			switch {
			case len(s.obsCont[op.Key]) == 0:
				// A container the path needs and the target does not have.
				op.Reason = ""
				op.Group = ""
				kept = append(kept, op)
			case named[op.Key] && op.Reason == ReasonContentChanged:
				// The caller named this container and its content changed, so
				// that is the write it asked for. Its identity still comes
				// from the target: a targeted plan updates what a container
				// says about itself, never which container it is.
				op.Identity = s.obsCont[op.Key][0].Identity
				op.ContainerProvenance = FromInventory
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
