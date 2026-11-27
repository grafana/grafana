package resource

import (
	"context"
	"fmt"
	"regexp"
	"strconv"
	"strings"
	"testing"
	"time"
	"uuid"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/storage/unified/resource/kv"
)

func saveTestBlob(t *testing.T, store kv.KV, uid string) string {
	t.Helper()
	key := kv.BlobKey{Group: "group", Resource: "resource", Namespace: "namespace", Name: "name", UID: uid}.String()
	w, err := store.Save(t.Context(), kv.BlobDataSection, key)
	require.NoError(t, err)
	_, err = w.Write(append(kv.EncodeBlobValueHeader("text/plain"), "x"...))
	require.NoError(t, err)
	require.NoError(t, w.Close())
	return key
}

func TestUUIDV7Time(t *testing.T) {
	before := time.Now().Add(-time.Second)
	got, ok := uuidV7Time(uuid.NewV7().String())
	require.True(t, ok)
	require.WithinDuration(t, time.Now(), got, 2*time.Second)
	require.True(t, got.After(before))
	_, ok = uuidV7Time(uuid.NewV4().String())
	require.False(t, ok)
	_, ok = uuidV7Time("blob")
	require.False(t, ok)
}

func TestUUIDV7TimeValidation(t *testing.T) {
	const valid = "01234567-89ab-7cde-8fab-0123456789ab"
	want := time.UnixMilli(0x0123456789ab)
	for _, uid := range []string{valid, strings.ToUpper(valid), "01234567-89ab-7cde-9fab-0123456789ab", "01234567-89ab-7cde-afab-0123456789ab", "01234567-89ab-7cde-bfab-0123456789ab"} {
		got, ok := uuidV7Time(uid)
		require.True(t, ok, uid)
		require.Equal(t, want, got)
	}
	invalid := make([]string, 0, 8+len(valid)+15+12)
	invalid = append(invalid, "", "blob", "00000000-0000-7xxx-xxxx-xxxxxxxxxxxx", valid[:35], valid+"0", "{"+valid+"}", "urn:uuid:"+valid, strings.ReplaceAll(valid, "-", ""))
	for i := range len(valid) {
		invalid = append(invalid, valid[:i]+"x"+valid[i+1:])
	}
	for _, version := range "012345689abcdef" {
		invalid = append(invalid, valid[:14]+string(version)+valid[15:])
	}
	for _, variant := range "01234567cdef" {
		invalid = append(invalid, valid[:19]+string(variant)+valid[20:])
	}
	for _, uid := range invalid {
		t.Run(uid, func(t *testing.T) {
			got, ok := uuidV7Time(uid)
			require.False(t, ok)
			require.True(t, got.IsZero())
		})
	}
}

func FuzzUUIDV7Time(f *testing.F) {
	for _, uid := range []string{"", "blob", "00000000-0000-7xxx-xxxx-xxxxxxxxxxxx", "01234567-89ab-7cde-8fab-0123456789ab", "FFFFFFFF-FFFF-7FFF-BFFF-FFFFFFFFFFFF", "00000000-0000-7000-8000-000000000000", "01234567-89ab-7cde-cfab-0123456789ab"} {
		f.Add(uid)
	}
	canonicalV7 := regexp.MustCompile(`^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-7[0-9a-fA-F]{3}-[89aAbB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$`)
	f.Fuzz(func(t *testing.T, uid string) {
		got, ok := uuidV7Time(uid)
		require.Equal(t, canonicalV7.MatchString(uid), ok)
		if !ok {
			require.True(t, got.IsZero())
			return
		}
		ms, err := strconv.ParseInt(uid[:8]+uid[9:13], 16, 64)
		require.NoError(t, err)
		require.Equal(t, time.UnixMilli(ms), got)
	})
}

func TestBlobGCUIDAgeSafety(t *testing.T) {
	now := time.UnixMilli(0x0123456789ab)
	grace := time.Hour
	for _, tc := range []struct {
		name           string
		uid            string
		count, skipped int
	}{
		{name: "malformed suffix", uid: "00000000-0000-7xxx-xxxx-xxxxxxxxxxxx", skipped: 1},
		{name: "invalid variant", uid: "00000000-0000-7000-c000-000000000000", skipped: 1},
		{name: "invalid separator", uid: "00000000-0000-7000-8000x000000000000", skipped: 1},
		{name: "legacy", uid: "00000000-0000-4000-8000-000000000000", skipped: 1},
		{name: "future", uid: uidAt(now.Add(time.Hour))},
		{name: "within grace", uid: uidAt(now.Add(-grace + time.Millisecond))},
		{name: "grace boundary", uid: uidAt(now.Add(-grace)), count: 1},
		{name: "beyond grace", uid: uidAt(now.Add(-grace - time.Millisecond)), count: 1},
	} {
		t.Run(tc.name, func(t *testing.T) {
			store := setupBadgerKV(t)
			key := saveTestBlob(t, store, tc.uid)
			gc := NewBlobGarbageCollector(store, 10, 0)
			count, err := gc.Collect(t.Context(), now, grace, false, func(context.Context, kv.BlobKey) (bool, error) { return false, nil })
			require.NoError(t, err)
			require.Equal(t, tc.count, count)
			require.Equal(t, tc.skipped, gc.SkippedWithoutAge())
			reader, err := store.Get(t.Context(), kv.BlobDataSection, key)
			if tc.count > 0 {
				require.ErrorIs(t, err, kv.ErrNotFound)
			} else {
				require.NoError(t, err)
				value, err := kv.ReadAllAndClose(reader)
				require.NoError(t, err)
				require.Equal(t, append(kv.EncodeBlobValueHeader("text/plain"), "x"...), value)
			}
		})
	}
}

func uidAt(at time.Time) string {
	ms := at.UnixMilli()
	return fmt.Sprintf("%08x-%04x-7000-8000-000000000000", ms>>16, ms&0xffff)
}

func TestBlobGCPlainKVUsesUIDAge(t *testing.T) {
	store := setupBadgerKV(t)
	gc := NewBlobGarbageCollector(store, 10, 0)
	unref := func(context.Context, kv.BlobKey) (bool, error) { return false, nil }
	oldKey := saveTestBlob(t, store, uuid.NewV7().String())
	now := time.Now()

	count, err := gc.Collect(t.Context(), now, time.Hour, false, unref)
	require.NoError(t, err)
	require.Zero(t, count, "within grace")

	count, err = gc.Collect(t.Context(), now.Add(2*time.Hour), time.Hour, false, unref)
	require.NoError(t, err)
	require.Equal(t, 1, count)
	_, err = store.Get(t.Context(), kv.BlobDataSection, oldKey)
	require.ErrorIs(t, err, kv.ErrNotFound)
}

func TestBlobGCPlainKVSkipsLegacyUIDs(t *testing.T) {
	store := setupBadgerKV(t)
	gc := NewBlobGarbageCollector(store, 10, 0)
	unref := func(context.Context, kv.BlobKey) (bool, error) { return false, nil }
	legacy := saveTestBlob(t, store, uuid.NewV4().String())

	// Even far beyond any grace period and across collector restarts, a blob
	// whose age cannot be determined is never deleted.
	for range 2 {
		count, err := gc.Collect(t.Context(), time.Now().Add(1000*time.Hour), time.Hour, false, unref)
		require.NoError(t, err)
		require.Zero(t, count)
		require.Equal(t, 1, gc.SkippedWithoutAge())
		gc = NewBlobGarbageCollector(store, 10, 0)
	}
	_, err := store.Get(t.Context(), kv.BlobDataSection, legacy)
	require.NoError(t, err)
}
