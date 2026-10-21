package converge

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
			// Keep only ensures for containers that do not exist yet: a
			// targeted plan creates the path it needs and leaves identities
			// alone.
			if len(s.obsCont[op.Key]) == 0 {
				op.Reason = ""
				op.Group = ""
				kept = append(kept, op)
			}
		case OpRemoveContainer:
			if named[op.Key] {
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
