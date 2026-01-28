package pluginfs

import (
	"bytes"
	"errors"
	"io"
	"io/fs"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"time"

	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/plugins/log"
)

var _ fs.FS = (*CDN)(nil)

type CDN struct {
	basePath string
	client   *http.Client
	log      log.Logger
}

func NewCDNFS(basePath string, client *http.Client) CDN {
	return CDN{
		basePath: basePath,
		client:   client,
		log:      log.New("fs.cdn"),
	}
}

func (f CDN) Type() plugins.FSType {
	return plugins.FSTypeCDN
}

func (f CDN) Open(name string) (fs.File, error) {
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
			f.log.Error("Could not close response body", "error", err)
		}
	}()

	if resp.StatusCode == 404 {
		return nil, plugins.ErrFileNotExist
	} else if resp.StatusCode/100 != 2 {
		return nil, plugins.ErrPluginFileRead
	}

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		f.log.Warn("Error occurred when reading CDN plugin file", "url", u, "error", err)
		return nil, err
	}

	return &cdnFile{
		path:   u,
		reader: bytes.NewReader(body),
	}, nil
}

func (f CDN) Rel(base string) (string, error) {
	base1, err := url.Parse(f.basePath)
	if err != nil {
		return "", err
	}

	base2, err := url.Parse(base)
	if err != nil {
		return "", err
	}

	if base1.Host != base2.Host {
		return "", errors.New("host mismatch")
	}

	return filepath.Rel(base1.Path, base2.Path)
}

func (f CDN) Base() string {
	return f.basePath
}

func (f CDN) Files() ([]string, error) {
	return []string{}, nil
}

func (f CDN) AssetPath(assets ...string) (string, error) {
	return url.JoinPath(f.basePath, assets...)
}

var _ fs.File = (*cdnFile)(nil)

type cdnFile struct {
	path   string
	reader *bytes.Reader
}

func (p *cdnFile) Stat() (fs.FileInfo, error) {
	return cdnFileInfo{
		name: p.path,
		size: p.reader.Size(),
	}, nil
}

func (p *cdnFile) Read(b []byte) (int, error) {
	return p.reader.Read(b)
}

func (p *cdnFile) Close() error {
	return nil
}

type cdnFileInfo struct {
	name string
	size int64
}

func (fi cdnFileInfo) Name() string       { return fi.name }
func (fi cdnFileInfo) Size() int64        { return fi.size }
func (fi cdnFileInfo) Mode() os.FileMode  { return 0444 } // Read for all
func (fi cdnFileInfo) ModTime() time.Time { return time.Time{} }
func (fi cdnFileInfo) IsDir() bool        { return false }
func (fi cdnFileInfo) Sys() interface{}   { return nil }
