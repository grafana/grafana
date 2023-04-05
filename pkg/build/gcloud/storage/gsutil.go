package storage

import (
	"context"
	"errors"
	"fmt"
	"io"
	"log"
	"mime"
	"os"
	"os/exec"
	"path"
	"path/filepath"
	"regexp"
	"strings"
	"sync"
	"time"

	"cloud.google.com/go/storage"
	"google.golang.org/api/iterator"
	"google.golang.org/api/option"

	"github.com/grafana/grafana/pkg/build/fsutil"
	"github.com/grafana/grafana/pkg/build/gcloud"
)

var (
	// ErrorNilBucket is returned when a function is called where a bucket argument is expected and the bucket is nil.
	ErrorNilBucket = errors.New("a bucket must be provided")
)

const (
	// maxThreads specify the number of max threads that can run at the same time.
	// Set to 1000, since the maximum number of simultaneous open files for the runners is 1024.
	maxThreads = 1000
)

// Client wraps the gcloud storage Client with convenient helper functions.
// By using an embedded type we can still use the functions provided by storage.Client if we need to.
type Client struct {
	storage.Client
}

// File represents a file in Google Cloud Storage.
type File struct {
	FullPath    string
	PathTrimmed string
}

// New creates a new Client by checking for the Google Cloud SDK auth key and/or environment variable.
func New() (*Client, error) {
	client, err := newClient()
	if err != nil {
		return nil, err
	}

	return &Client{
		Client: *client,
	}, nil
}

// newClient initializes the google-cloud-storage (GCS) client.
// It first checks for the application-default_credentials.json file then the GCP_KEY environment variable.
func newClient() (*storage.Client, error) {
	ctx := context.Background()

	byteKey, err := gcloud.GetDecodedKey()
	if err != nil {
		return nil, fmt.Errorf("failed to get gcp key, err: %w", err)
	}
	client, err := storage.NewClient(ctx, option.WithCredentialsJSON(byteKey))
	if err != nil {
		log.Println("failed to login with GCP_KEY, trying with default application credentials...")
		client, err = storage.NewClient(ctx)
		if err != nil {
			return nil, fmt.Errorf("failed to open Google Cloud Storage client: %w", err)
		}
	}

	return client, nil
}

// CopyLocalDir copies a local directory 'dir' to the bucket 'bucket' at the path 'bucketPath'.
func (client *Client) CopyLocalDir(ctx context.Context, dir string, bucket *storage.BucketHandle, bucketPath string, trim bool) error {
	if bucket == nil {
		return ErrorNilBucket
	}

	files, err := ListLocalFiles(dir)
	if err != nil {
		return err
	}
	log.Printf("Number or files to be copied over: %d\n", len(files))

	for _, chunk := range asChunks(files, maxThreads) {
		var wg sync.WaitGroup
		for _, f := range chunk {
			wg.Add(1)
			go func(file File) {
				defer wg.Done()
				err = client.Copy(ctx, file, bucket, bucketPath, trim)
				if err != nil {
					log.Printf("failed to copy objects, err: %s\n", err.Error())
				}
			}(f)
		}
		wg.Wait()
	}

	return nil
}

// Copy copies a single local file into the bucket at the provided path.
// trim variable should be set to true if the full object path is needed - false otherwise.
func (client *Client) Copy(ctx context.Context, file File, bucket *storage.BucketHandle, remote string, trim bool) error {
	if bucket == nil {
		return ErrorNilBucket
	}

	localFile, err := os.Open(file.FullPath)
	if err != nil {
		return fmt.Errorf("failed to open file %s, err: %q", file.FullPath, err)
	}
	defer func() {
		if err := localFile.Close(); err != nil {
			log.Println("failed to close localfile", "err", err)
		}
	}()

	extension := strings.ToLower(path.Ext(file.FullPath))
	contentType := mime.TypeByExtension(extension)

	filePath := file.FullPath
	if trim {
		filePath = file.PathTrimmed
	}

	objectPath := path.Join(remote, filePath)

	wc := bucket.Object(objectPath).NewWriter(ctx)
	wc.ContentType = contentType
	defer func() {
		if err := wc.Close(); err != nil {
			log.Println("failed to close writer", "err", err)
		}
	}()

	if _, err = io.Copy(wc, localFile); err != nil {
		return fmt.Errorf("failed to copy to Cloud Storage: %w", err)
	}

	log.Printf("Successfully uploaded tarball to Google Cloud Storage, path: %s/%s\n", remote, file.FullPath)

	return nil
}

// CopyRemoteDir copies an entire directory 'from' from the bucket 'fromBucket' into the 'toBucket' at the path 'to'.
func (client *Client) CopyRemoteDir(ctx context.Context, fromBucket *storage.BucketHandle, from string, toBucket *storage.BucketHandle, to string) error {
	if toBucket == nil || fromBucket == nil {
		return ErrorNilBucket
	}

	files, err := ListRemoteFiles(ctx, fromBucket, FilesFilter{Prefix: from})
	if err != nil {
		return err
	}

	var ch = make(chan File, len(files))
	var wg sync.WaitGroup
	wg.Add(maxThreads)

	for i := 0; i < maxThreads; i++ {
		go func() {
			for {
				file, ok := <-ch
				if !ok {
					wg.Done()
					return
				}
				if err := client.RemoteCopy(ctx, file, fromBucket, toBucket, to); err != nil {
					log.Printf("failed to copy files between buckets: err: %s\n", err.Error())
					return
				}
			}
		}()
	}

	for _, file := range files {
		ch <- file
	}

	close(ch)
	wg.Wait()

	return nil
}

// RemoteCopy will copy the file 'file' from the 'fromBucket' to the 'toBucket' at the path 'path'.
func (client *Client) RemoteCopy(ctx context.Context, file File, fromBucket, toBucket *storage.BucketHandle, path string) error {
	// Should this be path.Join instead of filepath.Join? filepath.Join on Windows will produce `\\` separators instead of `/`.
	var (
		src       = fromBucket.Object(file.FullPath)
		dstObject = filepath.Join(path, file.PathTrimmed)
		dst       = toBucket.Object(dstObject)
	)

	if _, err := dst.CopierFrom(src).Run(ctx); err != nil {
		return fmt.Errorf("failed to copy object %s, to %s, err: %w", file.FullPath, dstObject, err)
	}

	log.Printf("%s was successfully copied to %v bucket!.\n\n", file.FullPath, toBucket)
	return nil
}

// DeleteDir deletes a directory at 'path' from the bucket.
func (client *Client) DeleteDir(ctx context.Context, bucket *storage.BucketHandle, path string) error {
	if bucket == nil {
		return ErrorNilBucket
	}

	files, err := ListRemoteFiles(ctx, bucket, FilesFilter{Prefix: path})
	if err != nil {
		return err
	}

	var ch = make(chan string, len(files))
	var wg sync.WaitGroup
	wg.Add(maxThreads)

	for i := 0; i < maxThreads; i++ {
		go func() {
			for {
				fullPath, ok := <-ch
				if !ok {
					wg.Done()
					return
				}
				err := client.Delete(ctx, bucket, fullPath)
				if err != nil && !errors.Is(err, storage.ErrObjectNotExist) {
					log.Printf("failed to delete objects, err %s\n", err.Error())
					panic(err)
				}
			}
		}()
	}

	for _, file := range files {
		ch <- file.FullPath
	}

	close(ch)
	wg.Wait()

	return nil
}

// Delete deletes single item from the bucket at 'path'.
func (client *Client) Delete(ctx context.Context, bucket *storage.BucketHandle, path string) error {
	object := bucket.Object(path)
	if err := object.Delete(ctx); err != nil {
		return fmt.Errorf("cannot delete %s, err: %w", path, err)
	}
	log.Printf("Successfully deleted tarball to Google Cloud Storage, path: %s", path)
	return nil
}

// ListLocalFiles lists files in a local filesystem.
func ListLocalFiles(dir string) ([]File, error) {
	var files []File
	err := filepath.Walk(dir, func(path string, info os.FileInfo, err error) error {
		if !info.IsDir() {
			files = append(files, File{
				FullPath: path,
				// Strip the dir name from the filepath
				PathTrimmed: strings.ReplaceAll(path, dir, ""),
			})
		}
		return nil
	})

	if err != nil {
		return nil, fmt.Errorf("error walking path: %v", err)
	}

	return files, nil
}

type FilesFilter struct {
	Prefix   string
	FileExts []string
}

// ListRemoteFiles lists all the files in the directory (filtering by FilesFilter) and returns a File struct for each one.
func ListRemoteFiles(ctx context.Context, bucket *storage.BucketHandle, filter FilesFilter) ([]File, error) {
	if bucket == nil {
		return []File{}, ErrorNilBucket
	}

	it := bucket.Objects(ctx, &storage.Query{
		Prefix: filter.Prefix,
	})

	var files []File
	for {
		attrs, err := it.Next()
		if err != nil {
			if errors.Is(err, iterator.Done) {
				break
			}
		}
		if err != nil {
			return nil, fmt.Errorf("failed to iterate through bucket, err: %w", err)
		}

		extMatch := len(filter.FileExts) == 0
		for _, ext := range filter.FileExts {
			if ext == filepath.Ext(attrs.Name) {
				extMatch = true
				break
			}
		}

		if extMatch {
			files = append(files, File{FullPath: attrs.Name, PathTrimmed: strings.TrimPrefix(attrs.Name, filter.Prefix)})
		}
	}

	return files, nil
}

// DownloadDirectory downloads files from bucket (filtering by FilesFilter) to destPath on disk.
func (client *Client) DownloadDirectory(ctx context.Context, bucket *storage.BucketHandle, destPath string, filter FilesFilter) error {
	if bucket == nil {
		return ErrorNilBucket
	}

	files, err := ListRemoteFiles(ctx, bucket, filter)
	if err != nil {
		return err
	}

	// return err if dir already exists
	exists, err := fsutil.Exists(destPath)
	if err != nil {
		return err
	}
	if exists {
		return fmt.Errorf("destination path %q already exists", destPath)
	}

	err = os.MkdirAll(destPath, 0750)
	if err != nil && !os.IsExist(err) {
		return err
	}

	for _, file := range files {
		err = client.downloadFile(ctx, bucket, file.FullPath, file.PathTrimmed)
		if err != nil {
			return err
		}
	}
	return nil
}

// GetLatestMainBuild gets the latest main build which is successfully uploaded to the gcs bucket.
func GetLatestMainBuild(ctx context.Context, bucket *storage.BucketHandle, path string) (string, error) {
	if bucket == nil {
		return "", ErrorNilBucket
	}

	it := bucket.Objects(ctx, &storage.Query{
		Prefix: path,
	})

	var files []string
	for {
		attrs, err := it.Next()
		if errors.Is(err, iterator.Done) {
			break
		}
		if err != nil {
			return "", fmt.Errorf("failed to iterate through bucket, err: %w", err)
		}

		files = append(files, attrs.Name)
	}

	var latestVersion string
	for i := len(files) - 1; i >= 0; i-- {
		captureVersion := regexp.MustCompile(`(\d+\.\d+\.\d+-\d+pre)`)
		if captureVersion.MatchString(files[i]) {
			latestVersion = captureVersion.FindString(files[i])
			break
		}
	}

	return latestVersion, nil
}

// downloadFile downloads an object to a file.
func (client *Client) downloadFile(ctx context.Context, bucket *storage.BucketHandle, objectName, destFileName string) error {
	if bucket == nil {
		return ErrorNilBucket
	}

	ctx, cancel := context.WithTimeout(ctx, time.Second*10)
	defer cancel()

	// nolint:gosec
	f, err := os.Create(destFileName)
	if err != nil {
		return fmt.Errorf("os.Create: %v", err)
	}

	rc, err := bucket.Object(objectName).NewReader(ctx)
	if err != nil {
		return fmt.Errorf("Object(%q).NewReader: %v", objectName, err)
	}
	defer func() {
		if err := rc.Close(); err != nil {
			log.Println("failed to close reader", "err", err)
		}
	}()

	if _, err := io.Copy(f, rc); err != nil {
		return fmt.Errorf("io.Copy: %v", err)
	}

	if err = f.Close(); err != nil {
		return fmt.Errorf("f.Close: %v", err)
	}

	return nil
}

// asChunks will split the supplied []File into slices with a max size of `chunkSize`
// []string{"a", "b", "c"}, 1 => [][]string{[]string{"a"}, []string{"b"}, []string{"c"}}
// []string{"a", "b", "c"}, 2 => [][]string{[]string{"a", "b"}, []string{"c"}}.
func asChunks(files []File, chunkSize int) [][]File {
	var fileChunks [][]File

	if len(files) == 0 {
		return [][]File{}
	}

	if len(files) > chunkSize && chunkSize > 0 {
		for i := 0; i < len(files); i += chunkSize {
			end := i + chunkSize

			if end > len(files) {
				end = len(files)
			}
			fileChunks = append(fileChunks, files[i:end])
		}
	} else {
		fileChunks = [][]File{files}
	}
	return fileChunks
}

func GCSCopy(desc, src, dest string) error {
	args := strings.Split(fmt.Sprintf("-m cp -r gs://%s gs://%s", src, dest), " ")
	// nolint:gosec
	cmd := exec.Command("gsutil", args...)
	out, err := cmd.CombinedOutput()
	if err != nil {
		return fmt.Errorf("failed to publish %s: %w\n%s", desc, err, out)
	}
	return nil
}
