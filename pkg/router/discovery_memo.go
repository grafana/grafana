package router

import (
	"bytes"
	"hash/maphash"

	lru "github.com/hashicorp/golang-lru/v2"
)

// rootDiscoveryMemoSize bounds the merged root discovery documents kept. With
// the single-tenant fallback, each stack's answer is a different input.
const rootDiscoveryMemoSize = 64

// rootDiscoveryMemo keeps the merged root discovery documents (/apis and
// /openapi/v3) built from a source's answer, so an unchanged answer isn't
// decoded, merged and encoded on every request. A document is a function of
// its inputs alone: the path, the served snapshot, whether the answer is
// caller-scoped, and the answer's exact bytes. So two callers get the same
// document only when their sources answered byte for byte the same.
type rootDiscoveryMemo struct {
	seed    maphash.Seed
	entries *lru.Cache[rootDiscoveryMemoKey, rootDiscoveryMemoEntry]
}

type rootDiscoveryMemoKey struct {
	path     string
	snapshot *map[string]servingEntry
	scoped   bool
	// answer is a hash of the source's answer, which the entry holds, so
	// that a collision is told apart.
	answer uint64
}

type rootDiscoveryMemoEntry struct {
	answer []byte
	doc    *cachedDoc
}

func newRootDiscoveryMemo() *rootDiscoveryMemo {
	entries, err := lru.New[rootDiscoveryMemoKey, rootDiscoveryMemoEntry](rootDiscoveryMemoSize)
	if err != nil {
		panic(err) // the size is a positive constant
	}
	return &rootDiscoveryMemo{seed: maphash.MakeSeed(), entries: entries}
}

func (m *rootDiscoveryMemo) key(path string, snapshot *map[string]servingEntry, scoped bool, answer []byte) rootDiscoveryMemoKey {
	return rootDiscoveryMemoKey{path: path, snapshot: snapshot, scoped: scoped, answer: maphash.Bytes(m.seed, answer)}
}

// get returns the document built from exactly these inputs, if one is kept.
func (m *rootDiscoveryMemo) get(key rootDiscoveryMemoKey, answer []byte) (*cachedDoc, bool) {
	entry, ok := m.entries.Get(key)
	if !ok || !bytes.Equal(entry.answer, answer) {
		return nil, false
	}
	return entry.doc, true
}

func (m *rootDiscoveryMemo) add(key rootDiscoveryMemoKey, answer []byte, doc *cachedDoc) {
	m.entries.Add(key, rootDiscoveryMemoEntry{answer: answer, doc: doc})
}

// purge drops every document. publish calls it with each new snapshot, whose
// documents differ, and the snapshot in the key keeps a document built from
// an old one from being served after it.
func (m *rootDiscoveryMemo) purge() {
	m.entries.Purge()
}
