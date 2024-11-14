package notifier

import (
	"context"
	"encoding/base64"
	"strings"
	"testing"
	"time"

	"github.com/google/go-cmp/cmp"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/services/ngalert/tests/fakes"
)

func TestFileStore_Silences(t *testing.T) {
	store := fakes.NewFakeKVStore(t)
	ctx := context.Background()
	var orgId int64 = 1

	// Initialize kvstore.
	now := time.Now()
	oneHour := now.Add(time.Hour)
	initialState := silenceState{
		"1": createSilence("1", now, oneHour),
		"2": createSilence("2", now, oneHour),
	}
	decodedState, err := initialState.MarshalBinary()
	require.NoError(t, err)
	encodedState := base64.StdEncoding.EncodeToString(decodedState)
	err = store.Set(ctx, orgId, KVNamespace, SilencesFilename, encodedState)
	require.NoError(t, err)

	fs := NewFileStore(orgId, store)

	// Load initial.
	silences, err := fs.GetSilences(ctx)
	require.NoError(t, err)
	decoded, err := decodeSilenceState(strings.NewReader(silences))
	require.NoError(t, err)
	if !cmp.Equal(initialState, decoded) {
		t.Errorf("Unexpected Diff: %v", cmp.Diff(initialState, decoded))
	}

	// Save new.
	newState := silenceState{
		"a": createSilence("a", now, oneHour),
		"b": createSilence("b", now, oneHour),
	}
	size, err := fs.SaveSilences(ctx, newState)
	require.NoError(t, err)
	require.EqualValues(t, len(decodedState), size)

	// Load new.
	silences, err = fs.GetSilences(ctx)
	require.NoError(t, err)
	decoded, err = decodeSilenceState(strings.NewReader(silences))
	require.NoError(t, err)
	if !cmp.Equal(newState, decoded) {
		t.Errorf("Unexpected Diff: %v", cmp.Diff(newState, decoded))
	}
}

func TestFileStore_NotificationLog(t *testing.T) {
	store := fakes.NewFakeKVStore(t)
	ctx := context.Background()
	var orgId int64 = 1

	// Initialize kvstore.
	now := time.Now()
	oneHour := now.Add(time.Hour)
	k1, v1 := createNotificationLog("group1", "receiver1", now, oneHour)
	k2, v2 := createNotificationLog("group2", "receiver2", now, oneHour)
	initialState := nflogState{k1: v1, k2: v2}
	decodedState, err := initialState.MarshalBinary()
	require.NoError(t, err)
	encodedState := base64.StdEncoding.EncodeToString(decodedState)
	err = store.Set(ctx, orgId, KVNamespace, NotificationLogFilename, encodedState)
	require.NoError(t, err)

	fs := NewFileStore(orgId, store)

	// Load initial.
	nflog, err := fs.GetNotificationLog(ctx)
	require.NoError(t, err)
	decoded, err := decodeNflogState(strings.NewReader(nflog))
	require.NoError(t, err)
	if !cmp.Equal(initialState, decoded) {
		t.Errorf("Unexpected Diff: %v", cmp.Diff(initialState, decoded))
	}

	// Save new.
	k1, v1 = createNotificationLog("groupA", "receiverA", now, oneHour)
	k2, v2 = createNotificationLog("groupB", "receiverB", now, oneHour)
	newState := nflogState{k1: v1, k2: v2}
	size, err := fs.SaveNotificationLog(ctx, newState)
	require.NoError(t, err)
	require.EqualValues(t, len(decodedState), size)

	// Load new.
	nflog, err = fs.GetNotificationLog(ctx)
	require.NoError(t, err)
	decoded, err = decodeNflogState(strings.NewReader(nflog))
	require.NoError(t, err)
	if !cmp.Equal(newState, decoded) {
		t.Errorf("Unexpected Diff: %v", cmp.Diff(newState, decoded))
	}
}
