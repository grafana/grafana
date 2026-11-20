package test

import (
	"bytes"
	"context"
	"fmt"
	"io"
	"maps"
	"slices"
	"strings"
	"testing"

	"github.com/stretchr/testify/require"
	"pgregory.net/rapid"

	kvpkg "github.com/grafana/grafana/pkg/storage/unified/resource/kv"
)

// SQL routes sections to different tables. Events and Leases both support
// arbitrary text values and every batch mode, so the same model can check
// isolation between two sections on every backend.
var propertySections = []string{kvpkg.EventsSection, kvpkg.LeasesSection}

// propertyBlockSize is the unit for generated value sizes. Sizes cluster just
// below, at, and just above its multiples, and range up to several blocks, so
// examples mix tiny values with values tens of KiB long.
const propertyBlockSize = 10 << 10

// propertyT is the subset of *testing.T and *rapid.T used by the runner, so a
// shrunk example can be replayed from a plain test.
type propertyT interface {
	require.TestingT
	Logf(format string, args ...any)
	Context() context.Context
}

// RunKVPropertyTest uses rapid to generate sequences of reads, range scans,
// saves, deletes, and batch operations against the store. An in-memory model
// predicts the resulting state and the expected bytes, key order, and errors.
// After each operation, the runner checks the observed state, including that
// a rejected batch reports the first failing operation and leaves no changes.
//
// RAPID_CHECKS (or -rapid.checks) sets the case budget and RAPID_SEED (or
// -rapid.seed) replays a run. On failure, rapid shrinks the sequence and the
// log includes a Go literal that runKVExample can replay.
func RunKVPropertyTest(t *testing.T, kv kvpkg.KV, nsPrefix string) {
	if nsPrefix == "" {
		nsPrefix = GenerateRandomKVPrefix()
	}
	runTestKVProperties(t, kv, nsPrefix)
}

func runTestKVProperties(t *testing.T, kv kvpkg.KV, nsPrefix string) {
	nsPrefix += "-property"
	// Keep the keyspace fresh even when rapid reruns identical draws to shrink.
	example := 0
	rapid.Check(t, func(rt *rapid.T) {
		example++
		prefix := fmt.Sprintf("%s/%d/", nsPrefix, example)
		pool := drawPropertyPool(rt)
		ops := drawPropertyOps(rt, pool)
		rt.Logf("Replay with runKVExample(t, kv, %q, %#v,\n%s)", prefix, pool, propertyLiteral(ops))
		runKVExample(rt, kv, prefix, pool, ops)
	})
}

// drawPropertyPool makes eight keys with a shared prefix. Reusing a small
// pool makes operations collide. The variants exercise byte ordering around
// '/' and '~' and include keys that are prefixes of other keys.
func drawPropertyPool(t *rapid.T) []string {
	const alphabet = "-.0:ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz123456789_"
	segment := rapid.StringOfN(rapid.RuneFrom([]rune(alphabet)), 1, 8, -1)
	stem := segment.Draw(t, "stem")
	tail := segment.Draw(t, "tail")
	return []string{
		stem, stem + "-" + tail, stem + "." + tail, stem + "/" + tail,
		stem + "0" + tail, stem + ":" + tail, stem + "~", stem + "~" + tail,
	}
}

// Values are limited to printable ASCII because SQL stores Events and Leases
// values in text columns.
const (
	propertyFirstByte  = '!'
	propertyByteRange  = '~' - '!' + 1
	propertyByteOffset = 31
)

// propertyValue describes the payload by length and a byte used to build a
// repeating pattern. A Go reproducer can specify a 30 KiB payload in two fields.
type propertyValue struct {
	size int
	fill byte
}

// rotate returns the printable byte n positions after b, wrapping around.
func rotate(b byte, n int) byte {
	return propertyFirstByte + byte((int(b-propertyFirstByte)+n)%propertyByteRange)
}

func (v propertyValue) bytes() []byte {
	// The offsets produce three distinct bytes. propertyBlockSize isn't a
	// multiple of three, so adjacent blocks start at different points in
	// the pattern and reordering them changes the payload.
	pattern := []byte{v.fill, rotate(v.fill, propertyByteOffset), rotate(v.fill, 2*propertyByteOffset)}
	return bytes.Repeat(pattern, (v.size+len(pattern)-1)/len(pattern))[:v.size]
}

func drawPropertyValue(t *rapid.T, size *rapid.Generator[int]) propertyValue {
	return propertyValue{
		size: size.Draw(t, "size"),
		fill: rapid.ByteRange(propertyFirstByte, '~').Draw(t, "fill"),
	}
}

type propertyBatchOp struct {
	mode  kvpkg.BatchOpMode
	key   string
	value propertyValue
}

// propertyOp records one KV call. The kind selects which arguments apply.
// Keys and range bounds are stored as suffixes of the example's prefix.
type propertyOp struct {
	kind    string
	section string
	key     string
	value   propertyValue
	list    kvpkg.ListOptions
	keys    []string
	batch   []propertyBatchOp
}

// drawPropertyOps draws a list of commands that rapid can shorten on failure.
// Each command chooses a section and draws the arguments its operation needs.
// An overwrite command expands to two saves of the same key.
func drawPropertyOps(t *rapid.T, pool []string) []propertyOp {
	const c = propertyBlockSize
	// Give sizes around block multiples two of the three generator choices.
	boundarySize := rapid.SampledFrom([]int{1, c - 1, c, c + 1, 2 * c, 3*c + 1})
	valueSize := rapid.OneOf(boundarySize, boundarySize, rapid.IntRange(1, 4*c+1))
	largeSize := rapid.SampledFrom([]int{c + 1, 2 * c, 3*c + 1})
	key := rapid.SampledFrom(pool)
	section := rapid.SampledFrom(propertySections)
	batchOp := rapid.Custom(func(t *rapid.T) propertyBatchOp {
		op := propertyBatchOp{
			mode: kvpkg.BatchOpMode(rapid.IntRange(int(kvpkg.BatchOpPut), int(kvpkg.BatchOpDelete)).Draw(t, "mode")),
			key:  key.Draw(t, "key"),
		}
		if op.mode != kvpkg.BatchOpDelete {
			op.value = drawPropertyValue(t, valueSize)
		}
		return op
	})
	command := rapid.Custom(func(t *rapid.T) []propertyOp {
		kind := rapid.SampledFrom([]string{
			"save", "overwrite", "delete", "get", "keys", "batchGet", "batchDelete", "batch", "populate",
		}).Draw(t, "kind")
		op := propertyOp{kind: kind, section: section.Draw(t, "section")}
		switch kind {
		case "overwrite":
			// Replacing a value of several blocks with one byte checks that no part
			// of the old value survives.
			op.kind = "save"
			op.key = key.Draw(t, "key")
			op.value = drawPropertyValue(t, largeSize)
			smaller := op
			smaller.value = propertyValue{size: 1, fill: rotate(op.value.fill, 1)}
			return []propertyOp{op, smaller}
		case "save":
			op.key = key.Draw(t, "key")
			op.value = drawPropertyValue(t, valueSize)
		case "delete", "get":
			op.key = key.Draw(t, "key")
		case "keys":
			// An empty bound selects the edge of this example's key prefix.
			bound := rapid.SampledFrom(append([]string{""}, pool...))
			op.list = kvpkg.ListOptions{
				StartKey: bound.Draw(t, "start"),
				EndKey:   bound.Draw(t, "end"),
				Sort:     rapid.SampledFrom([]kvpkg.SortOrder{kvpkg.SortOrderAsc, kvpkg.SortOrderDesc}).Draw(t, "sort"),
				Limit:    int64(rapid.SampledFrom([]int{0, 1, 2, 3, len(pool) + 1}).Draw(t, "limit")),
			}
		case "batchGet", "batchDelete":
			// Draw with replacement so duplicate requests are possible.
			op.keys = rapid.SliceOfN(key, 0, len(pool)+2).Draw(t, "keys")
		case "batch":
			// Repeated keys exercise dependencies between operations in a batch.
			op.batch = rapid.SliceOfN(batchOp, 0, kvpkg.MaxBatchOps).Draw(t, "batch")
		case "populate":
			// Fill a section so even short examples can exercise several pages.
			op.kind = "batch"
			for _, suffix := range pool {
				op.batch = append(op.batch, propertyBatchOp{
					mode: kvpkg.BatchOpPut, key: suffix, value: drawPropertyValue(t, valueSize),
				})
			}
		}
		return []propertyOp{op}
	})
	var ops []propertyOp
	for _, commands := range rapid.SliceOfN(command, 1, 32).Draw(t, "commands") {
		ops = append(ops, commands...)
	}
	return ops
}

// propertyLiteralReplacer drops this package's qualifier and renames the kv
// package to the alias used here, so the literal can be pasted into a test in
// this package. Only type names are rewritten, never key strings.
var propertyLiteralReplacer = strings.NewReplacer(
	"test.propertyOp{", "propertyOp{",
	"test.propertyValue{", "propertyValue{",
	"test.propertyBatchOp{", "propertyBatchOp{",
	"test.propertyBatchOp(", "propertyBatchOp(",
	"kv.ListOptions{", "kvpkg.ListOptions{",
)

// propertyLiteral uses fmt's Go syntax for each operation.
func propertyLiteral(ops []propertyOp) string {
	var literal strings.Builder
	literal.WriteString("[]propertyOp{\n")
	for _, op := range ops {
		entry := strings.TrimPrefix(fmt.Sprintf("%#v", op), "test.propertyOp")
		fmt.Fprintf(&literal, "\t%s,\n", propertyLiteralReplacer.Replace(entry))
	}
	literal.WriteByte('}')
	return literal.String()
}

// runKVExample executes a concrete operation list against the store and a fresh
// model. Use a fresh key prefix for each execution. A deterministic regression
// test can pass a plain *testing.T and the operation list logged by rapid.
func runKVExample(t propertyT, kv kvpkg.KV, prefix string, pool []string, ops []propertyOp) {
	ctx := t.Context()
	model := make(map[string]map[string][]byte, len(propertySections))
	for _, section := range propertySections {
		model[section] = make(map[string][]byte)
	}
	for i, op := range ops {
		t.Logf("operation %d: %s in %s", i, op.kind, op.section)
		rows := model[op.section]
		switch op.kind {
		case "save":
			value := op.value.bytes()
			writer, err := kv.Save(ctx, op.section, prefix+op.key)
			require.NoError(t, err)
			n, err := writer.Write(value)
			closeErr := writer.Close()
			require.NoError(t, err)
			require.NoError(t, closeErr)
			require.Equal(t, len(value), n)
			rows[op.key] = op.value.bytes()
		case "delete":
			require.NoError(t, kv.Delete(ctx, op.section, prefix+op.key))
			delete(rows, op.key)
		case "keys":
			checkPropertyKeys(t, kv, op.section, prefix, rows, op.list)
		case "batchGet":
			checkPropertyBatchGet(t, kv, op.section, prefix, rows, op.keys)
		case "batchDelete":
			require.NoError(t, kv.BatchDelete(ctx, op.section, prefixedKeys(prefix, op.keys)))
			for _, key := range op.keys {
				delete(rows, key)
			}
		case "batch":
			rows = applyPropertyBatch(t, kv, op.section, prefix, rows, op.batch)
			model[op.section] = rows
		}
		// Generated reads check their specific arguments. After every
		// operation, check the resulting state through Get, a full prefix
		// scan, and a whole-pool BatchGet. This also verifies rollback.
		key := op.key
		if key == "" {
			// List and batch operations have no single key. Rotate through
			// the pool to check Get even after those operations.
			key = pool[i%len(pool)]
		}
		checkPropertyGet(t, kv, op.section, prefix+key, rows[key])
		checkPropertyKeys(t, kv, op.section, prefix, rows, kvpkg.ListOptions{})
		checkPropertyBatchGet(t, kv, op.section, prefix, rows, pool)
	}

	// Check both sections for cross-section side effects and scan each in
	// descending order to exercise the reverse cursor on populated sections.
	for _, section := range propertySections {
		checkPropertyKeys(t, kv, section, prefix, model[section], kvpkg.ListOptions{Sort: kvpkg.SortOrderDesc})
		checkPropertyBatchGet(t, kv, section, prefix, model[section], pool)
	}
}

// applyPropertyBatch simulates the operations on a copy of the section.
// On the first rejected operation, it checks the store's error and keeps the
// original model. The caller's follow-up reads then verify rollback.
func applyPropertyBatch(t propertyT, kv kvpkg.KV, section, prefix string, rows map[string][]byte, commands []propertyBatchOp) map[string][]byte {
	ops := make([]kvpkg.BatchOp, 0, len(commands))
	for _, command := range commands {
		op := kvpkg.BatchOp{Mode: command.mode, Key: prefix + command.key}
		if command.mode != kvpkg.BatchOpDelete {
			op.Value = command.value.bytes()
		}
		ops = append(ops, op)
	}

	next := maps.Clone(rows)
	for i, command := range commands {
		_, exists := next[command.key]
		var expectedErr error
		switch {
		case command.mode == kvpkg.BatchOpCreate && exists:
			expectedErr = kvpkg.ErrKeyAlreadyExists
		case command.mode == kvpkg.BatchOpUpdate && !exists:
			expectedErr = kvpkg.ErrNotFound
		case command.mode == kvpkg.BatchOpDelete:
			delete(next, command.key)
		default:
			next[command.key] = command.value.bytes()
		}
		if expectedErr != nil {
			err := kv.Batch(t.Context(), section, ops)
			var batchErr *kvpkg.BatchError
			require.ErrorAs(t, err, &batchErr)
			require.Equal(t, i, batchErr.Index)
			require.ErrorIs(t, batchErr, expectedErr)
			return rows
		}
	}
	require.NoError(t, kv.Batch(t.Context(), section, ops))
	return next
}

func checkPropertyGet(t propertyT, kv kvpkg.KV, section, key string, want []byte) {
	reader, err := kv.Get(t.Context(), section, key)
	if want == nil {
		if reader != nil {
			require.NoError(t, reader.Close())
		}
		require.ErrorIs(t, err, kvpkg.ErrNotFound, "Get(%q)", key)
		return
	}
	require.NoError(t, err, "Get(%q)", key)
	checkPropertyValue(t, reader, key, want)
}

func checkPropertyValue(t propertyT, reader io.ReadCloser, key string, want []byte) {
	require.NotNil(t, reader, "reader for %q", key)
	got, err := kvpkg.ReadAllAndClose(reader)
	require.NoError(t, err, "reading %q", key)
	require.True(t, bytes.Equal(want, got), "wrong value at %q (expected %d bytes, got %d)", key, len(want), len(got))
}

func checkPropertyKeys(t propertyT, kv kvpkg.KV, section, prefix string, rows map[string][]byte, opts kvpkg.ListOptions) {
	var want []string
	for key := range rows {
		if key >= opts.StartKey && (opts.EndKey == "" || key < opts.EndKey) {
			want = append(want, prefix+key)
		}
	}
	slices.Sort(want)
	if opts.Sort == kvpkg.SortOrderDesc {
		slices.Reverse(want)
	}
	if opts.Limit > 0 && opts.Limit < int64(len(want)) {
		want = want[:opts.Limit]
	}

	opts.StartKey = prefix + opts.StartKey
	if opts.EndKey == "" {
		opts.EndKey = kvpkg.PrefixRangeEnd(prefix)
	} else {
		opts.EndKey = prefix + opts.EndKey
	}
	var got []string
	for key, err := range kv.Keys(t.Context(), section, opts) {
		require.NoError(t, err, "Keys(%q, %+v)", section, opts)
		got = append(got, key)
	}
	require.Equal(t, want, got, "Keys(%q, %+v)", section, opts)
}

func checkPropertyBatchGet(t propertyT, kv kvpkg.KV, section, prefix string, rows map[string][]byte, keys []string) {
	var want, got []string
	for _, key := range keys {
		if _, exists := rows[key]; exists {
			want = append(want, prefix+key)
		}
	}
	for pair, err := range kv.BatchGet(t.Context(), section, prefixedKeys(prefix, keys)) {
		require.NoError(t, err, "BatchGet(%q, %q)", section, keys)
		checkPropertyValue(t, pair.Value, pair.Key, rows[strings.TrimPrefix(pair.Key, prefix)])
		got = append(got, pair.Key)
	}
	require.Equal(t, want, got, "BatchGet(%q, %q)", section, keys)
}

func prefixedKeys(prefix string, keys []string) []string {
	result := make([]string, len(keys))
	for i, key := range keys {
		result[i] = prefix + key
	}
	return result
}
