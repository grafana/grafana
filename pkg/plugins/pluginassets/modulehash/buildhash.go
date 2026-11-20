package modulehash

import (
	"context"
	"crypto/sha256"
	"encoding/binary"
	"encoding/hex"
	"fmt"
	"io"
	"path/filepath"
	"sort"

	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/codes"
	"go.opentelemetry.io/otel/trace"

	"github.com/grafana/grafana/pkg/plugins"
)

// BuildHash returns a deterministic SHA-256 content digest over an installed
// build's asset set, hex-encoded. It is used to give FS/unsigned plugin builds a
// stable content-addressable identity (buildHash) independent of the signed-CDN
// MANIFEST.txt / SRI path.
//
// The digest is computed over the sorted list of relative file paths and their
// contents, so identical bytes on any replica yield an identical hash. File
// names are normalised to forward slashes so the hash is stable across operating
// systems.
func BuildHash(fs plugins.FS) (string, error) {
	files, err := fs.Files()
	if err != nil {
		return "", fmt.Errorf("list files: %w", err)
	}

	// Hash by the normalised (slash) path so both the ordering AND the hashed name are
	// platform-independent: identical plugin bytes must yield the same buildHash on
	// Windows and Linux. Sorting must happen on the normalised name — sorting the raw
	// names first would order '/' and '\' differently across operating systems. The
	// file is still opened by its original (OS-native) name.
	type entry struct{ slash, orig string }
	entries := make([]entry, len(files))
	for i, name := range files {
		entries[i] = entry{slash: filepath.ToSlash(name), orig: name}
	}
	sort.Slice(entries, func(i, j int) bool { return entries[i].slash < entries[j].slash })

	h := sha256.New()
	var lenBuf [8]byte
	for _, e := range entries {
		// Length-prefix the name to avoid ambiguity between concatenated fields.
		binary.BigEndian.PutUint64(lenBuf[:], uint64(len(e.slash)))
		h.Write(lenBuf[:])
		h.Write([]byte(e.slash))

		if err := hashFileContents(fs, e.orig, h, lenBuf[:]); err != nil {
			return "", err
		}
	}

	return hex.EncodeToString(h.Sum(nil)), nil
}

// hashFileContents opens name on fs and writes a length-prefixed copy of its
// contents into h. The prefix uses lenBuf as scratch space.
func hashFileContents(fs plugins.FS, name string, h io.Writer, lenBuf []byte) error {
	f, err := fs.Open(name)
	if err != nil {
		return fmt.Errorf("open %q: %w", name, err)
	}
	defer f.Close() //nolint:errcheck

	info, err := f.Stat()
	if err != nil {
		return fmt.Errorf("stat %q: %w", name, err)
	}
	binary.BigEndian.PutUint64(lenBuf, uint64(info.Size()))
	if _, err := h.Write(lenBuf); err != nil {
		return fmt.Errorf("write size %q: %w", name, err)
	}
	if _, err := io.Copy(h, f); err != nil {
		return fmt.Errorf("read %q: %w", name, err)
	}
	return nil
}

// BuildHash returns a deterministic content hash (buildHash) for a registered
// plugin's build directory. Unlike ModuleHash — which is the signed-CDN SRI hash
// read from MANIFEST.txt and is intentionally empty for FS/unsigned plugins —
// BuildHash addresses every retained/served build by its content, so FS and
// unsigned plugins also get a stable identity. It does not consult signatures or
// the CDN and does not affect SRI verification.
func (c *Calculator) BuildHash(ctx context.Context, pluginID, pluginVersion string) string {
	p, ok := c.reg.Plugin(ctx, pluginID, pluginVersion)
	if !ok {
		c.log.Error("Failed to calculate build hash as plugin is not registered", "pluginId", pluginID)
		return ""
	}
	if p.FS == nil {
		return ""
	}

	// CDN-hosted plugins are served from the shared CDN, so all replicas serve identical
	// assets (no per-replica build drift) and their asset URLs already carry the version.
	// They must not be pinned to the local /public/plugins/:id/:buildHash/* route — doing
	// so would bypass CDN offload and the CDN source transform — so they get no buildHash.
	if c.cdn.PluginSupported(pluginID) {
		return ""
	}

	// Cache the digest: bootdata calls this once per panel/datasource/app on every index
	// load, so without a cache each request would re-walk and SHA-256 every installed
	// plugin's files (the same hot path ModuleHash caches). The entry is keyed by
	// id:version but validated against the active build's identity: an in-process
	// rebuild/reinstall — even one that keeps the same version string — swaps the
	// registry's plugin pointer, so a stale entry is detected and recomputed rather than
	// served (a same-version replace would otherwise advertise an evicted hash). Only
	// cache misses hash the filesystem and open a span.
	k := pluginID + ":" + pluginVersion
	if cached, ok := c.buildHashCache.Load(k); ok {
		if entry := cached.(buildHashCacheEntry); entry.plugin == p {
			return entry.hash
		}
	}

	ctx, span := c.tracer.Start(ctx, "buildhash.compute", trace.WithAttributes(
		attribute.String("plugin.id", pluginID),
		attribute.String("plugin.version", pluginVersion),
	))
	defer span.End()

	bh, err := BuildHash(p.FS)
	if err != nil {
		span.RecordError(err)
		span.SetStatus(codes.Error, err.Error())
		c.log.Error("Failed to calculate build hash", "pluginId", p.ID, "error", err)
		return ""
	}
	c.buildHashCache.Store(k, buildHashCacheEntry{plugin: p, hash: bh})
	return bh
}

// buildHashCacheEntry pairs a computed buildHash with the exact active-build plugin
// pointer it was computed for, so BuildHash can invalidate the entry when the registry
// swaps in a new build for the same (pluginID, version).
type buildHashCacheEntry struct {
	plugin *plugins.Plugin
	hash   string
}
