package cloudmigrationimpl

import (
	"bytes"
	"compress/gzip"
	"crypto/sha256"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"slices"
	"strings"

	"github.com/grafana/grafana/pkg/services/cloudmigration"
)

type SnapshotWriter struct {
	// Folder where files will be written to.
	folder string
	// A map from resource type (e.g. dashboard, datasource) to a list of file paths that contain resources of the type.
	index map[string]*resourceIndex
}

type resourceIndex struct {
	// Number used to name partition files. Starts at 0. Monotonically increasing.
	partitionNumber uint32
	// List of file paths that contain resources of a specific type (e.g. dashboard, datasource).
	filePaths []string
}

func NewSnapshotWriter(folder string) (writer *SnapshotWriter, err error) {
	if _, err := os.Stat(folder); err != nil {
		if !errors.Is(err, os.ErrNotExist) {
			return nil, fmt.Errorf("getting folder info: %w", err)
		}

		if err := os.MkdirAll(folder, 0750); err != nil {
			return nil, fmt.Errorf("creating directory to store snapshot files: %w", err)
		}
		//nolint:gosec
		folderFile, err := os.Open(folder)
		if err != nil {
			return nil, fmt.Errorf("opening directory: path=%s %w", folder, err)
		}
		defer func() {
			if closeErr := folderFile.Close(); closeErr != nil {
				err = errors.Join(err, fmt.Errorf("closing folder file: path=%s %w", folder, closeErr))
			}
		}()
		if err := folderFile.Sync(); err != nil {
			return nil, fmt.Errorf("syncinf folder: path=%s %w", folder, err)
		}
	}

	return &SnapshotWriter{
		folder: folder,
		index:  make(map[string]*resourceIndex, 0),
	}, nil
}

// TODO: make it parallel
func (writer *SnapshotWriter) Write(resourceType string, items []cloudmigration.MigrateDataRequestItemDTO) (err error) {
	if _, ok := writer.index[resourceType]; !ok {
		writer.index[resourceType] = &resourceIndex{partitionNumber: 0, filePaths: make([]string, 0)}
	}
	resourceIndex := writer.index[resourceType]

	filepath := filepath.Join(writer.folder, fmt.Sprintf("%s_partition_%d.json", strings.ToLower(resourceType), resourceIndex.partitionNumber))
	// nolint:gosec
	file, err := os.OpenFile(filepath, os.O_RDWR|os.O_CREATE|os.O_TRUNC, 0600)
	if err != nil {
		return fmt.Errorf("creating/opening partition file: filepath=%s %w", filepath, err)
	}
	defer func() {
		if closeErr := file.Close(); closeErr != nil {
			err = errors.Join(err, fmt.Errorf("closing file: %w", closeErr))
		}
	}()

	buffer := bytes.NewBuffer(make([]byte, 0))

	gzipWriter := gzip.NewWriter(buffer)
	defer func() {
		if closeErr := gzipWriter.Close(); closeErr != nil {
			err = errors.Join(err, fmt.Errorf("closing gzip writer: %w", closeErr))
		}
	}()

	itemsJsonBytes, err := json.Marshal(&items)
	if err != nil {
		return fmt.Errorf("marshalling migration items: %w", err)
	}

	bytesWritten, err := gzipWriter.Write(itemsJsonBytes)
	if err != nil {
		return fmt.Errorf("writing buffer to gzip writer: bytesWritten=%d %w", bytesWritten, err)
	}
	if bytesWritten != len(itemsJsonBytes) {
		return fmt.Errorf("writing buffer to gzip writer failed, unable to write every byte: bytesWritten=%d expectedBytesWritten=%d", bytesWritten, len(itemsJsonBytes))
	}

	if err := gzipWriter.Flush(); err != nil {
		return fmt.Errorf("flushwing gzip writer: %w", err)
	}

	bufferBytes := buffer.Bytes()
	checksum, err := computeBufferChecksum(bufferBytes)
	if err != nil {
		return fmt.Errorf("computing checksum: %w", err)
	}

	partitionJsonBytes, err := json.Marshal(compressedPartition{
		Checksum: checksum,
		Data:     bufferBytes,
	})
	if err != nil {
		return fmt.Errorf("marshalling data with checksum: %w", err)
	}

	if _, err := file.Write(partitionJsonBytes); err != nil {
		return fmt.Errorf("writing partition bytes to file: %w", err)
	}

	if err := file.Sync(); err != nil {
		return fmt.Errorf("syncing file: %w", err)
	}

	resourceIndex.partitionNumber++
	resourceIndex.filePaths = append(resourceIndex.filePaths, filepath)

	return nil
}

// index is an in memory index mapping resource types to file paths where the file contains a list of resources.
type index struct {
	// Checksum is a checksum computed using `Items`.
	Checksum string `json:"checksum"`
	// Items looks like this:
	// {
	//   "DATASOURCE": ["tmp/datasource_partition_0.json"]
	//   "DASHBOARD": ["tmp/dashboard_partition_0.json"]
	//   ..
	// }
	Items map[string][]string `json:"items"`
}

// compressedPartition represents a file that contains resources of a specific type (e.g. dashboards).
type compressedPartition struct {
	// Checksum is a checksum computed using `Data`.
	Checksum string `json:"checksum"`
	Data     []byte `json:"data"`
}

// partition is the same as compressedPartition except that `Data` has been uncompressed and renamed to `Items`.
type partition struct {
	Checksum string
	Items    []cloudmigration.MigrateDataRequestItemDTO
}

func computeBufferChecksum(buffer []byte) (string, error) {
	hash := sha256.New()
	bytesWritten, err := hash.Write(buffer)
	if err != nil {
		return "", fmt.Errorf("writing buffer to hash :%w", err)
	}
	if bytesWritten != len(buffer) {
		return "", fmt.Errorf("writing buffer to hash, expected to write %d bytes but wrote %d", len(buffer), bytesWritten)
	}
	return fmt.Sprintf("%x", hash.Sum(nil)), nil
}

func computeIndexChecksum(index map[string][]string) (string, error) {
	keys := make([]string, 0, len(index))
	for key := range index {
		keys = append(keys, key)
	}
	// Sort map keys to ensure the same hash is computed every time.
	slices.Sort(keys)

	hash := sha256.New()
	for _, key := range keys {
		bytesWritten, err := hash.Write([]byte(key))
		if err != nil {
			return "", fmt.Errorf("writing key to hash :%w", err)
		}
		if bytesWritten != len(key) {
			return "", fmt.Errorf("writing key to hash, expected to write %d bytes but wrote %d", len(key), bytesWritten)
		}

		for _, value := range index[key] {
			bytesWritten, err = hash.Write([]byte(value))
			if err != nil {
				return "", fmt.Errorf("writing value to hash :%w", err)
			}
			if bytesWritten != len(value) {
				return "", fmt.Errorf("writing value to hash, expected to write %d bytes but wrote %d", len(key), bytesWritten)
			}
		}
	}

	return fmt.Sprintf("%x", hash.Sum(nil)), nil
}

// Writes the in memory index to disk.
func (writer *SnapshotWriter) Finish() (indexFilePath string, err error) {
	items := make(map[string][]string)
	for resourceType, resourceIndex := range writer.index {
		items[resourceType] = resourceIndex.filePaths
	}

	// TODO: ensure user cannot access data they don't own by uploading an malicious index file
	checksum, err := computeIndexChecksum(items)
	if err != nil {
		return "", fmt.Errorf("computing index checksum: %w", err)
	}
	index := index{Checksum: checksum, Items: items}

	bytes, err := json.Marshal(index)
	if err != nil {
		return "", fmt.Errorf("json marshalling index: %w", err)
	}

	indexFilePath = filepath.Join(writer.folder, "index.json")
	// nolint:gosec
	file, err := os.OpenFile(indexFilePath, os.O_RDWR|os.O_CREATE|os.O_TRUNC, 0600)
	defer func() {
		if closeErr := file.Close(); closeErr != nil {
			err = errors.Join(err, fmt.Errorf("closing index file: %w", closeErr))
		}
	}()
	if err != nil {
		return indexFilePath, fmt.Errorf("creating/opening index file: filepath=%s %w", indexFilePath, err)
	}
	if _, err := file.Write(bytes); err != nil {
		return indexFilePath, fmt.Errorf("writing index contents to file: %w", err)
	}
	if err := file.Sync(); err != nil {
		return indexFilePath, fmt.Errorf("syncing index file contents: %w", err)
	}

	return indexFilePath, nil
}

// ReadIndex reads the index containing the path to the data files.
func ReadIndex(reader io.Reader) (index, error) {
	var data index
	if err := json.NewDecoder(reader).Decode(&data); err != nil {
		return data, fmt.Errorf("reading and decoding snapshot data: %w", err)
	}

	checksum, err := computeIndexChecksum(data.Items)
	if err != nil {
		return data, fmt.Errorf("computing index checksum: %w", err)
	}
	if data.Checksum != checksum {
		return data, fmt.Errorf("index checksum mismatch: expected=%s got=%s", data.Checksum, checksum)
	}

	return data, nil
}

// ReadFile reads a file containing a list of resources.
func ReadFile(reader io.Reader) (partition partition, err error) {
	var data compressedPartition
	if err := json.NewDecoder(reader).Decode(&data); err != nil {
		return partition, fmt.Errorf("reading and decoding snapshot partition: %w", err)
	}

	checksum, err := computeBufferChecksum(data.Data)
	if err != nil {
		return partition, fmt.Errorf("computing partition checksum: %w", err)
	}
	if data.Checksum != checksum {
		return partition, fmt.Errorf("partition checksum mismatch: expected=%s got=%s", data.Checksum, checksum)
	}

	gzipReader, err := gzip.NewReader(bytes.NewReader(data.Data))
	if err != nil {
		return partition, fmt.Errorf("creating gzip reader: %w", err)
	}
	defer func() {
		if closeErr := gzipReader.Close(); closeErr != nil {
			err = errors.Join(err, fmt.Errorf("closing gzip reader: %w", closeErr))
		}
	}()

	items := make([]cloudmigration.MigrateDataRequestItemDTO, 0)
	if err := json.NewDecoder(gzipReader).Decode(&items); err != nil {
		return partition, fmt.Errorf("unmarshalling []MigrateDataRequestItemDTO: %w", err)
	}

	partition.Checksum = data.Checksum
	partition.Items = items

	return partition, nil
}
