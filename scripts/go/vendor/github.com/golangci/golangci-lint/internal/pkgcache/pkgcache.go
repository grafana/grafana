package pkgcache

import (
	"bytes"
	"encoding/gob"
	"encoding/hex"
	"fmt"
	"runtime"
	"sort"
	"sync"

	"github.com/pkg/errors"
	"golang.org/x/tools/go/packages"

	"github.com/golangci/golangci-lint/internal/cache"
	"github.com/golangci/golangci-lint/pkg/logutils"
	"github.com/golangci/golangci-lint/pkg/timeutils"
)

// Cache is a per-package data cache. A cached data is invalidated when
// package or it's dependencies change.
type Cache struct {
	lowLevelCache *cache.Cache
	pkgHashes     sync.Map
	sw            *timeutils.Stopwatch
	log           logutils.Log  // not used now, but may be needed for future debugging purposes
	ioSem         chan struct{} // semaphore limiting parallel IO
}

func NewCache(sw *timeutils.Stopwatch, log logutils.Log) (*Cache, error) {
	c, err := cache.Default()
	if err != nil {
		return nil, err
	}
	return &Cache{
		lowLevelCache: c,
		sw:            sw,
		log:           log,
		ioSem:         make(chan struct{}, runtime.GOMAXPROCS(-1)),
	}, nil
}

func (c *Cache) Trim() {
	c.sw.TrackStage("trim", func() {
		c.lowLevelCache.Trim()
	})
}

func (c *Cache) Put(pkg *packages.Package, key string, data interface{}) error {
	var err error
	buf := &bytes.Buffer{}
	c.sw.TrackStage("gob", func() {
		err = gob.NewEncoder(buf).Encode(data)
	})
	if err != nil {
		return errors.Wrap(err, "failed to gob encode")
	}

	var aID cache.ActionID

	c.sw.TrackStage("key build", func() {
		aID, err = c.pkgActionID(pkg)
		if err == nil {
			aID = cache.Subkey(aID, key)
		}
	})
	if err != nil {
		return errors.Wrapf(err, "failed to calculate package %s action id", pkg.Name)
	}
	c.ioSem <- struct{}{}
	c.sw.TrackStage("cache io", func() {
		err = c.lowLevelCache.PutBytes(aID, buf.Bytes())
	})
	<-c.ioSem
	if err != nil {
		return errors.Wrapf(err, "failed to save data to low-level cache by key %s for package %s", key, pkg.Name)
	}

	return nil
}

var ErrMissing = errors.New("missing data")

func (c *Cache) Get(pkg *packages.Package, key string, data interface{}) error {
	var aID cache.ActionID
	var err error
	c.sw.TrackStage("key build", func() {
		aID, err = c.pkgActionID(pkg)
		if err == nil {
			aID = cache.Subkey(aID, key)
		}
	})
	if err != nil {
		return errors.Wrapf(err, "failed to calculate package %s action id", pkg.Name)
	}

	var b []byte
	c.ioSem <- struct{}{}
	c.sw.TrackStage("cache io", func() {
		b, _, err = c.lowLevelCache.GetBytes(aID)
	})
	<-c.ioSem
	if err != nil {
		if cache.IsErrMissing(err) {
			return ErrMissing
		}
		return errors.Wrapf(err, "failed to get data from low-level cache by key %s for package %s", key, pkg.Name)
	}

	c.sw.TrackStage("gob", func() {
		err = gob.NewDecoder(bytes.NewReader(b)).Decode(data)
	})
	if err != nil {
		return errors.Wrap(err, "failed to gob decode")
	}

	return nil
}

func (c *Cache) pkgActionID(pkg *packages.Package) (cache.ActionID, error) {
	hash, err := c.packageHash(pkg)
	if err != nil {
		return cache.ActionID{}, errors.Wrap(err, "failed to get package hash")
	}

	key := cache.NewHash("action ID")
	fmt.Fprintf(key, "pkgpath %s\n", pkg.PkgPath)
	fmt.Fprintf(key, "pkghash %s\n", hash)

	return key.Sum(), nil
}

// packageHash computes a package's hash. The hash is based on all Go
// files that make up the package, as well as the hashes of imported
// packages.
func (c *Cache) packageHash(pkg *packages.Package) (string, error) {
	cachedHash, ok := c.pkgHashes.Load(pkg)
	if ok {
		return cachedHash.(string), nil
	}

	key := cache.NewHash("package hash")
	fmt.Fprintf(key, "pkgpath %s\n", pkg.PkgPath)
	for _, f := range pkg.CompiledGoFiles {
		c.ioSem <- struct{}{}
		h, err := cache.FileHash(f)
		<-c.ioSem
		if err != nil {
			return "", errors.Wrapf(err, "failed to calculate file %s hash", f)
		}
		fmt.Fprintf(key, "file %s %x\n", f, h)
	}

	imps := make([]*packages.Package, 0, len(pkg.Imports))
	for _, imp := range pkg.Imports {
		imps = append(imps, imp)
	}
	sort.Slice(imps, func(i, j int) bool {
		return imps[i].PkgPath < imps[j].PkgPath
	})
	for _, dep := range imps {
		if dep.PkgPath == "unsafe" {
			continue
		}

		depHash, err := c.packageHash(dep)
		if err != nil {
			return "", errors.Wrapf(err, "failed to calculate hash for dependency %s", dep.Name)
		}

		fmt.Fprintf(key, "import %s %s\n", dep.PkgPath, depHash)
	}
	h := key.Sum()
	ret := hex.EncodeToString(h[:])
	c.pkgHashes.Store(pkg, ret)
	return ret, nil
}
