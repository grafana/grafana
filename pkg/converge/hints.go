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

	// Rules 2 and 4 need a pass over both sides.
	fingerprints := make(map[Fingerprint]bool)
	for _, d := range decls {
		if in[d.Key] {
			fingerprints[d.Fingerprint] = true
		}
	}
	for _, o := range obs {
		if in[o.Key] {
			fingerprints[o.Fingerprint] = true
		}
	}

	add := func(k Key, fp Fingerprint) {
		if in[k] {
			return
		}
		if fp != "" && fingerprints[fp] {
			in[k] = true
			return
		}
		if p := k.Parent(); p != "" && in[p] {
			in[k] = true
		}
	}
	for _, d := range decls {
		add(d.Key, d.Fingerprint)
	}
	for _, o := range obs {
		add(o.Key, o.Fingerprint)
	}
	return in
}
