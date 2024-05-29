package notifier

import (
	"context"
	"encoding/base64"
	"fmt"

	alertingNotify "github.com/grafana/alerting/notify"

	"github.com/grafana/grafana/pkg/infra/kvstore"
	"github.com/grafana/grafana/pkg/infra/log"
)

const (
	KVNamespace             = "alertmanager"
	NotificationLogFilename = "notifications"
	SilencesFilename        = "silences"
)

// FileStore is in charge of persisting the alertmanager files to the database.
// It uses the KVstore table and encodes the files as a base64 string.
type FileStore struct {
	kv     *kvstore.NamespacedKVStore
	orgID  int64
	logger log.Logger
}

func NewFileStore(orgID int64, store kvstore.KVStore) *FileStore {
	return &FileStore{
		orgID:  orgID,
		kv:     kvstore.WithNamespace(store, orgID, KVNamespace),
		logger: log.New("ngalert.notifier.alertmanager.file_store", orgID),
	}
}

// GetSilences returns the content of the silences file from kvstore.
func (fileStore *FileStore) GetSilences(ctx context.Context) (string, error) {
	return fileStore.contentFor(ctx, SilencesFilename)
}

func (fileStore *FileStore) GetNotificationLog(ctx context.Context) (string, error) {
	return fileStore.contentFor(ctx, NotificationLogFilename)
}

// contentFor returns the content for the given Alertmanager kvstore key.
func (fileStore *FileStore) contentFor(ctx context.Context, filename string) (string, error) {
	// Then, let's attempt to read it from the database.
	content, exists, err := fileStore.kv.Get(ctx, filename)
	if err != nil {
		return "", fmt.Errorf("error reading file '%s' from database: %w", filename, err)
	}

	// File doesn't exist, Alertmanager will eventually save it to the database.
	if !exists {
		return "", nil
	}

	// If we have a file stored in the database, let's decode it and write it to disk to perform that initial load to memory.
	bytes, err := decode(content)
	if err != nil {
		return "", fmt.Errorf("error decoding file '%s': %w", filename, err)
	}

	return string(bytes), err
}

// SaveSilences saves the silences to the database and returns the size of the unencoded state.
func (fileStore *FileStore) SaveSilences(ctx context.Context, st alertingNotify.State) (int64, error) {
	return fileStore.persist(ctx, SilencesFilename, st)
}

// SaveNotificationLog saves the notification log to the database and returns the size of the unencoded state.
func (fileStore *FileStore) SaveNotificationLog(ctx context.Context, st alertingNotify.State) (int64, error) {
	return fileStore.persist(ctx, NotificationLogFilename, st)
}

// persist takes care of persisting the binary representation of internal state to the database as a base64 encoded string.
func (fileStore *FileStore) persist(ctx context.Context, filename string, st alertingNotify.State) (int64, error) {
	var size int64

	bytes, err := st.MarshalBinary()
	if err != nil {
		return size, err
	}

	if err = fileStore.kv.Set(ctx, filename, encode(bytes)); err != nil {
		return size, err
	}

	return int64(len(bytes)), err
}

func decode(s string) ([]byte, error) {
	return base64.StdEncoding.DecodeString(s)
}

func encode(b []byte) string {
	return base64.StdEncoding.EncodeToString(b)
}
