package notifier

import (
	"context"
	"encoding/base64"
	"fmt"
	"os"
	"path/filepath"

	alertingNotify "github.com/grafana/alerting/notify"

	"github.com/grafana/grafana/pkg/infra/kvstore"
	"github.com/grafana/grafana/pkg/infra/log"
)

const KVNamespace = "alertmanager"

// FileStore is in charge of persisting the alertmanager files to the database.
// It uses the KVstore table and encodes the files as a base64 string.
type FileStore struct {
	kv             *kvstore.NamespacedKVStore
	orgID          int64
	workingDirPath string
	logger         log.Logger
}

func NewFileStore(orgID int64, store kvstore.KVStore, workingDirPath string) *FileStore {
	return &FileStore{
		workingDirPath: workingDirPath,
		orgID:          orgID,
		kv:             kvstore.WithNamespace(store, orgID, KVNamespace),
		logger:         log.New("filestore", "org", orgID),
	}
}

// FilepathFor returns the filepath to an Alertmanager file.
// If the file is already present on disk it no-ops.
// If not, it tries to read the database and if there's no file it no-ops.
// If there is a file in the database, it decodes it and writes to disk for Alertmanager consumption.
func (fileStore *FileStore) FilepathFor(ctx context.Context, filename string) (string, error) {
	// Then, let's attempt to read it from the database.
	content, exists, err := fileStore.kv.Get(ctx, filename)
	if err != nil {
		return "", fmt.Errorf("error reading file '%s' from database: %w", filename, err)
	}

	// if it doesn't exist, let's no-op and let the Alertmanager create one. We'll eventually save it to the database.
	if !exists {
		return fileStore.pathFor(filename), nil
	}

	// If we have a file stored in the database, let's decode it and write it to disk to perform that initial load to memory.
	bytes, err := decode(content)
	if err != nil {
		return "", fmt.Errorf("error decoding file '%s': %w", filename, err)
	}

	if err := fileStore.WriteFileToDisk(filename, bytes); err != nil {
		return "", fmt.Errorf("error writing file %s: %w", filename, err)
	}

	return fileStore.pathFor(filename), err
}

// Persist takes care of persisting the binary representation of internal state to the database as a base64 encoded string.
func (fileStore *FileStore) Persist(ctx context.Context, filename string, st alertingNotify.State) (int64, error) {
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

// WriteFileToDisk writes a file with the provided name and contents to the Alertmanager working directory with the default grafana permission.
func (fileStore *FileStore) WriteFileToDisk(fn string, content []byte) error {
	// Ensure the working directory is created
	err := os.MkdirAll(fileStore.workingDirPath, 0750)
	if err != nil {
		return fmt.Errorf("unable to create the working directory %q: %s", fileStore.workingDirPath, err)
	}

	return os.WriteFile(fileStore.pathFor(fn), content, 0644)
}

// CleanUp will remove the working directory from disk.
func (fileStore *FileStore) CleanUp() {
	if err := os.RemoveAll(fileStore.workingDirPath); err != nil {
		fileStore.logger.Warn("unable to delete the local working directory", "dir", fileStore.workingDirPath,
			"error", err)
		return
	}
	fileStore.logger.Info("successfully deleted working directory", "dir", fileStore.workingDirPath)
}

func (fileStore *FileStore) pathFor(fn string) string {
	return filepath.Join(fileStore.workingDirPath, fn)
}

func decode(s string) ([]byte, error) {
	return base64.StdEncoding.DecodeString(s)
}

func encode(b []byte) string {
	return base64.StdEncoding.EncodeToString(b)
}
