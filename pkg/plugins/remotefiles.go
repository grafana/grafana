package plugins

import (
	"bytes"
	"errors"
	"io"
	"io/fs"
	"net/http"
	"net/url"
	"os"
	"time"

	"github.com/grafana/grafana/pkg/infra/log"
)

var ErrPluginFileRead = errors.New("file could not be read")

var _ fs.FS = (*RemoteFS)(nil)

type RemoteFS struct {
	m        map[string]*RemoteFile
	basePath string
	client   http.Client
	log      log.Logger
}

func NewRemoteFS(basePath string) RemoteFS {
	return RemoteFS{
		m:        map[string]*RemoteFile{},
		basePath: basePath,
	}
}

func (f RemoteFS) Open(name string) (fs.File, error) {
	u, err := url.JoinPath(f.basePath, name)
	if err != nil {
		return nil, err
	}

	resp, err := f.client.Get(u)
	if err != nil {
		return nil, err
	}

	defer func() {
		err = resp.Body.Close()
		if err != nil {
			f.log.Error("Could not close response body", "err", err)
		}
	}()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		f.log.Warn("Error occurred when unmarshalling remote plugin file", "url", u, "err", err)
		return nil, err
	}

	if resp.StatusCode == 404 {
		return nil, ErrFileNotExist
	} else if resp.StatusCode/100 != 2 {
		return nil, ErrPluginFileRead
	}

	return &RemoteFile{
		path:   u,
		reader: bytes.NewReader(body),
	}, nil
}

func (f RemoteFS) Base() string {
	return f.basePath
}

func (f RemoteFS) Files() []string {
	return []string{}
}

var _ fs.File = (*RemoteFile)(nil)

type RemoteFile struct {
	path   string
	reader *bytes.Reader
}

func (p *RemoteFile) Stat() (fs.FileInfo, error) {
	return remoteFileInfo{
		name: p.path,
		size: p.reader.Size(),
	}, nil
}

func (p *RemoteFile) Read(b []byte) (int, error) {
	return p.reader.Read(b)
}

func (p *RemoteFile) Close() error {
	return nil
}

type remoteFileInfo struct {
	name string
	size int64
}

func (fi remoteFileInfo) Name() string       { return fi.name }
func (fi remoteFileInfo) Size() int64        { return fi.size }
func (fi remoteFileInfo) Mode() os.FileMode  { return 0444 } // Read for all
func (fi remoteFileInfo) ModTime() time.Time { return time.Time{} }
func (fi remoteFileInfo) IsDir() bool        { return false }
func (fi remoteFileInfo) Sys() interface{}   { return nil }
