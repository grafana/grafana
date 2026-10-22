package converge

// HintSet narrows planning to the keys that may have changed.
//
// A hint set says where to look. It does not say what to conclude: a source
// that reports "A was renamed to B" supplies two keys to re-examine and no
// authority over whether a rename happened. The planner re-derives that from
// fingerprints, exactly as it would in a full plan — which is what makes a
// hinted plan and a full plan converge on the same state.
type HintSet struct {
	// Keys may have changed since the target was last converged.
	Keys []Key

	// Complete reports whether the hint source can guarantee that no key
	// outside Keys changed. When false — an unknown previous version, a gap in
	// versions, a rewritten history — the hints are ignored and planning runs
	// in [ModeFull]. Soundness is never traded for a narrower scan.
	Complete bool
}

// closure expands the hint keys to every key whose planning outcome the hinted
// keys can affect:
//
//  1. ancestor containers of each hinted key, since a write materialises them;
//  2. keys directly inside a hinted container, since re-identifying a container
//     re-parents its direct children;
//  3. the container a hinted key declares, via [ContainerConfig.ContainerFor],
//     since changing the key that pins an identity changes the container;
//  4. keys sharing a fingerprint with a hinted key, so that both halves of a
//     relocation fall inside the window.
//
// Rule 4 is why a caller that cannot supply fingerprint-matched keys must
// disable move detection for that run rather than accept a silent downgrade
// from "moved" to "deleted and recreated".
func (h HintSet) closure(decls []Declaration, obs []Observation, cc ContainerConfig) map[Key]bool {
	in := make(map[Key]bool, len(h.Keys)*4)
	for _, k := range h.Keys {
		in[k] = true
		for _, a := range k.Ancestors() {
			in[a] = true
		}
		if cc.ContainerFor != nil {
			if c, ok := cc.ContainerFor(k); ok {
				in[c.AsContainer()] = true
			}
		}
	}

	// Rules 2 and 4 need the transitive closure, which a single pass over the
	// inputs cannot produce: whether a key is in depends on whether its parent
	// is, and the inputs arrive in no particular order. Iterating to a fixpoint
	// is what keeps the window from depending on slice order — and with
	// ReparentDescendants a window that stops short omits descendant updates
	// the plan needs.
	fingerprints := make(map[Fingerprint]bool)
	noteFingerprint := func(k Key, fp Fingerprint) {
		if fp != "" && in[k] {
			fingerprints[fp] = true
		}
	}
	for _, d := range decls {
		noteFingerprint(d.Key, d.Fingerprint)
	}
	for _, o := range obs {
		noteFingerprint(o.Key, o.Fingerprint)
	}

	type candidate struct {
		key Key
		fp  Fingerprint
	}
	candidates := make([]candidate, 0, len(decls)+len(obs))
	for _, d := range decls {
		candidates = append(candidates, candidate{d.Key, d.Fingerprint})
	}
	for _, o := range obs {
		candidates = append(candidates, candidate{o.Key, o.Fingerprint})
	}

	for changed := true; changed; {
		changed = false
		for _, c := range candidates {
			if in[c.key] {
				continue
			}
			parent := c.key.Parent()
			if (c.fp != "" && fingerprints[c.fp]) || (parent != "" && in[parent]) {
				in[c.key] = true
				if c.fp != "" {
					fingerprints[c.fp] = true
				}
				changed = true
			}
		}
	}
	return in
}
