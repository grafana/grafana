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
	admit := admitter(in, cc)
	for _, k := range h.Keys {
		admit(k)
	}

	fingerprints := seedFingerprints(in, decls, obs)
	holders, claimed := identityHolders(in, decls, obs)
	candidates := closureCandidates(decls, obs)

	for changed := true; changed; {
		changed = false
		for _, c := range candidates {
			if in[c.key] {
				continue
			}
			parent := c.key.Parent()
			if (c.fp != "" && fingerprints[c.fp]) || (parent != "" && in[parent]) {
				admit(c.key)
				if c.fp != "" {
					fingerprints[c.fp] = true
				}
				changed = true
			}
		}
		if admitIdentityLinked(in, admit, holders, claimed) {
			changed = true
		}
	}
	return in
}

// admitter adds a key to the window along with everything the planner needs in
// order to decide it: its ancestors, and the container its content describes.
// Admitting a key without them makes the plan treat an existing folder as
// missing and re-parent what is inside it.
func admitter(in map[Key]bool, cc ContainerConfig) func(Key) {
	return func(k Key) {
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
}

type closureCandidate struct {
	key Key
	fp  Fingerprint
}

func closureCandidates(decls []Declaration, obs []Observation) []closureCandidate {
	out := make([]closureCandidate, 0, len(decls)+len(obs))
	for _, d := range decls {
		out = append(out, closureCandidate{d.Key, d.Fingerprint})
	}
	for _, o := range obs {
		out = append(out, closureCandidate{o.Key, o.Fingerprint})
	}
	return out
}

func seedFingerprints(in map[Key]bool, decls []Declaration, obs []Observation) map[Fingerprint]bool {
	out := make(map[Fingerprint]bool)
	for _, d := range decls {
		if d.Fingerprint != "" && in[d.Key] {
			out[d.Fingerprint] = true
		}
	}
	for _, o := range obs {
		if o.Fingerprint != "" && in[o.Key] {
			out[o.Fingerprint] = true
		}
	}
	return out
}

// identityHolders indexes the containers that state or hold each identity, and
// which of those identities are already in the window.
//
// Identities link containers that share no key and no fingerprint: a
// declaration claiming an identity another container already holds can only be
// demoted if both are in the window, so without this a hinted plan accepts a
// claim a full plan refuses.
func identityHolders(in map[Key]bool, decls []Declaration, obs []Observation) (map[Identity][]Key, map[Identity]bool) {
	holders := make(map[Identity][]Key)
	claimed := make(map[Identity]bool)
	note := func(k Key, id Identity, container bool) {
		if !container || id == "" {
			return
		}
		holders[id] = append(holders[id], k)
		if in[k] {
			claimed[id] = true
		}
	}
	for _, d := range decls {
		note(d.Key, d.Identity, d.Container)
	}
	for _, o := range obs {
		note(o.Key, o.Identity, o.Container)
	}
	return holders, claimed
}

func admitIdentityLinked(in map[Key]bool, admit func(Key), holders map[Identity][]Key, claimed map[Identity]bool) bool {
	changed := false
	for id, keys := range holders {
		if !claimed[id] {
			for _, k := range keys {
				if in[k] {
					claimed[id] = true
					changed = true
					break
				}
			}
		}
		if !claimed[id] {
			continue
		}
		for _, k := range keys {
			if !in[k] {
				admit(k)
				changed = true
			}
		}
	}
	return changed
}
