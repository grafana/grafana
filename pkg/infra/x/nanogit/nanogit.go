package nanogit

import (
	"bytes"
	"compress/zlib"
	"crypto/sha1"
	"encoding/binary"
	"encoding/hex"
	"errors"
	"fmt"
	"io"
	"net/http"
	"strconv"
	"time"
)

func deltaHeaderSize(b []byte) (uint, []byte) {
	var size, j uint
	var cmd byte
	for {
		cmd = b[j]
		size |= (uint(cmd) & 0x7f) << (j * 7)
		j++
		if uint(cmd)&0xb80 == 0 || j == uint(len(b)) {
			break
		}
	}
	return size, b[j:]
}

func PatchDelta(src, delta []byte) (dest []byte) {
	const minDeltaSize = 4
	if len(delta) < minDeltaSize {
		return nil
	}
	size, delta := deltaHeaderSize(delta)
	if size != uint(len(src)) {
		return nil
	}
	size, delta = deltaHeaderSize(delta)
	origSize := size

	for {
		cmd := delta[0]
		delta = delta[1:]
		if (cmd & 0x80) != 0 {
			var cp_off, cp_size uint
			if (cmd & 0x01) != 0 {
				cp_off = uint(delta[0])
				delta = delta[1:]
			}
			if (cmd & 0x02) != 0 {
				cp_off |= uint(delta[0]) << 8
				delta = delta[1:]
			}
			if (cmd & 0x04) != 0 {
				cp_off |= uint(delta[0]) << 16
				delta = delta[1:]
			}
			if (cmd & 0x08) != 0 {
				cp_off |= uint(delta[0]) << 24
				delta = delta[1:]
			}

			if (cmd & 0x10) != 0 {
				cp_size = uint(delta[0])
				delta = delta[1:]
			}
			if (cmd & 0x20) != 0 {
				cp_size |= uint(delta[0]) << 8
				delta = delta[1:]
			}
			if (cmd & 0x40) != 0 {
				cp_size |= uint(delta[0]) << 16
				delta = delta[1:]
			}
			if cp_size == 0 {
				cp_size = 0x10000
			}
			if cp_off+cp_size < cp_off ||
				cp_off+cp_size > uint(len(src)) ||
				cp_size > origSize {
				break
			}
			dest = append(dest, src[cp_off:cp_off+cp_size]...)
			size -= cp_size
		} else if cmd != 0 {
			if uint(cmd) > origSize {
				break
			}
			dest = append(dest, delta[0:uint(cmd)]...)
			size -= uint(cmd)
			delta = delta[uint(cmd):]
		} else {
			return nil
		}
		if size <= 0 {
			break
		}
	}
	return dest
}

type Object interface {
	Type() string
	Hash() string
}

type Hash []byte

func (h Hash) String() string { return hex.EncodeToString(h) }

type Commit struct {
	Tree      Hash
	Parents   []Hash
	Author    Signature
	Committer Signature
	Message   string
	hash      string
}

func NewCommit(b []byte) (*Commit, error) {
	o := &Commit{hash: githash("commit", b)}

	lines := bytes.Split(b, []byte{'\n'})
	for i := range lines {
		if len(lines[i]) > 0 {
			var err error

			split := bytes.SplitN(lines[i], []byte{' '}, 2)
			switch string(split[0]) {
			case "tree":
				o.Tree = make([]byte, 20)
				_, err = hex.Decode(o.Tree, split[1])
			case "parent":
				h := make([]byte, 20)
				_, err = hex.Decode(h, split[1])
				if err == nil {
					o.Parents = append(o.Parents, h)
				}
			case "author":
				o.Author = NewSignature(split[1])
			case "committer":
				o.Committer = NewSignature(split[1])
			}

			if err != nil {
				return nil, err
			}
		} else {
			o.Message = string(bytes.Join(lines[i+1:], []byte{'\n'}))
			break
		}
	}

	return o, nil
}

func (o *Commit) Type() string { return "commit" }
func (o *Commit) Hash() string { return o.hash }

type Signature struct {
	Name  string
	Email string
	When  time.Time
}

func NewSignature(signature []byte) Signature {
	ret := Signature{}
	if len(signature) == 0 {
		return ret
	}

	from := 0
	state := 'n' // n: name, e: email, t: timestamp, z: timezone
	for i := 0; ; i++ {
		var c byte
		var end bool
		if i < len(signature) {
			c = signature[i]
		} else {
			end = true
		}

		switch state {
		case 'n':
			if c == '<' || end {
				if i == 0 {
					break
				}
				ret.Name = string(signature[from : i-1])
				state = 'e'
				from = i + 1
			}
		case 'e':
			if c == '>' || end {
				ret.Email = string(signature[from:i])
				i++
				state = 't'
				from = i + 1
			}
		case 't':
			if c == ' ' || end {
				t, err := strconv.ParseInt(string(signature[from:i]), 10, 64)
				if err == nil {
					ret.When = time.Unix(t, 0)
				}
				end = true
			}
		}

		if end {
			break
		}
	}

	return ret
}

func (s *Signature) String() string { return fmt.Sprintf("%q <%s> @ %s", s.Name, s.Email, s.When) }

type Tree struct {
	Entries []TreeEntry
	hash    string
}

type TreeEntry struct {
	Name string
	Hash string
}

func NewTree(body []byte) (*Tree, error) {
	o := &Tree{hash: githash("tree", body)}

	if len(body) == 0 {
		return o, nil
	}

	for {
		split := bytes.SplitN(body, []byte{0}, 2)
		split1 := bytes.SplitN(split[0], []byte{' '}, 2)

		o.Entries = append(o.Entries, TreeEntry{
			Name: string(split1[1]),
			Hash: fmt.Sprintf("%x", split[1][0:20]),
		})

		body = split[1][20:]
		if len(split[1]) == 20 {
			break
		}
	}

	return o, nil
}

func (o *Tree) Type() string { return "tree" }
func (o *Tree) Hash() string { return o.hash }

type Blob struct {
	Len  int
	hash string
}

func NewBlob(b []byte) (*Blob, error) {
	return &Blob{Len: len(b), hash: githash("blob", b)}, nil
}

func (o *Blob) Type() string { return "blob" }
func (o *Blob) Hash() string { return o.hash }

type ContentCallback func(hash string, content []byte)

type Packfile struct {
	Version     uint32
	Size        int64
	ObjectCount int
	Checksum    []byte
	Commits     map[string]*Commit
	Trees       map[string]*Tree
	Blobs       map[string]*Blob
}

func NewPackfile() *Packfile {
	return &Packfile{
		Commits: make(map[string]*Commit, 0),
		Trees:   make(map[string]*Tree, 0),
		Blobs:   make(map[string]*Blob, 0),
	}
}

type BlobEntry struct {
	path string
	*Blob
}

type SubtreeEntry struct {
	path string
	*Tree
	TreeCh
}

type treeEntry interface {
	isTreeEntry()
	Path() string
}

func (b BlobEntry) isTreeEntry()    {}
func (b BlobEntry) Path() string    { return b.path }
func (b SubtreeEntry) isTreeEntry() {}
func (b SubtreeEntry) Path() string { return b.path }

type TreeCh <-chan treeEntry

func (p *Packfile) WalkCommit(commitHash string) (TreeCh, error) {
	commit, ok := p.Commits[commitHash]
	if !ok {
		return nil, fmt.Errorf("unable to find %q commit", commitHash)
	}

	treeHash := fmt.Sprintf("%x", string(commit.Tree))
	return p.WalkTree(p.Trees[treeHash]), nil
}

func (p *Packfile) WalkTree(tree *Tree) TreeCh {
	return p.walkTree(tree, "")
}

func (p *Packfile) walkTree(tree *Tree, pathPrefix string) TreeCh {
	ch := make(chan treeEntry)

	if tree == nil {
		close(ch)
		return ch
	}

	go func() {
		defer func() {
			close(ch)
		}()
		for _, e := range tree.Entries {
			path := pathPrefix + e.Name
			if blob, ok := p.Blobs[e.Hash]; ok {
				ch <- BlobEntry{path, blob}
			} else if subtree, ok := p.Trees[e.Hash]; ok {
				ch <- SubtreeEntry{path, subtree, p.walkTree(subtree, path+"/")}
			}
		}
	}()

	return ch
}

const MaxObjectsLimit = 1000000

var ErrMaxSize = fmt.Errorf("max size exceeded for in-memory client")

type TrackingByteReader struct {
	r    io.Reader
	n, l int
}

func (t *TrackingByteReader) Pos() int { return t.n }

func (t *TrackingByteReader) Read(p []byte) (n int, err error) {
	n, err = t.r.Read(p)
	if err != nil {
		return 0, err
	}
	t.n += n
	if t.n >= t.l {
		return n, ErrMaxSize
	}
	return n, err
}

func (t *TrackingByteReader) ReadByte() (c byte, err error) {
	var p [1]byte
	n, err := t.r.Read(p[:])
	if err != nil {
		return 0, err
	}
	if n > 1 {
		return 0, fmt.Errorf("read %d bytes, should have read just 1", n)
	}
	t.n += n // n is 1
	return p[0], nil
}

type PackfileReader struct {
	r *TrackingByteReader

	objects map[string]packfileObject
	offsets map[int]string
	deltas  []packfileDelta

	contentCallback ContentCallback
}

type packfileObject struct {
	bytes []byte
	typ   int8
}

type packfileDelta struct {
	hash  string
	delta []byte
}

func NewPackfileReader(r io.Reader, l int, fn ContentCallback) (*PackfileReader, error) {
	return &PackfileReader{
		r:               &TrackingByteReader{r: r, n: 0, l: l},
		objects:         make(map[string]packfileObject, 0),
		offsets:         make(map[int]string, 0),
		contentCallback: fn,
	}, nil
}

func (pr *PackfileReader) Pos() int { return pr.r.Pos() }

func (pr *PackfileReader) Read() (*Packfile, error) {
	packfile := NewPackfile()

	if err := pr.validateHeader(); err != nil {
		if errors.Is(err, io.EOF) {
			// This is an empty repo. It's OK.
			return packfile, nil
		}
		return nil, err
	}

	ver, err := pr.readInt32()
	if err != nil {
		return nil, err
	}

	count, err := pr.readInt32()
	if err != nil {
		return nil, err
	}

	packfile.Version = ver
	packfile.ObjectCount = int(count)

	if packfile.ObjectCount > MaxObjectsLimit {
		return nil, NewError("too many objects (%d)", packfile.ObjectCount)
	}

	if err := pr.readObjects(packfile); err != nil {
		return nil, err
	}

	packfile.Size = int64(pr.r.Pos())

	return packfile, nil
}

func (pr *PackfileReader) validateHeader() error {
	var header = make([]byte, 4)
	if _, err := pr.r.Read(header); err != nil {
		return err
	}

	if !bytes.Equal(header, []byte{'P', 'A', 'C', 'K'}) {
		return NewError("Pack file does not start with 'PACK'")
	}

	return nil
}

func (pr *PackfileReader) readInt32() (uint32, error) {
	var value uint32
	if err := binary.Read(pr.r, binary.BigEndian, &value); err != nil {
		return 0, err
	}
	return value, nil
}

func (pr *PackfileReader) readObjects(packfile *Packfile) error {
	// This code has 50-80 µs of overhead per object not counting zlib inflation.
	// Together with zlib inflation, it's 400-410 µs for small objects.
	// That's 1 sec for ~2450 objects, ~4.20 MB, or ~250 ms per MB,
	// of which 12-20 % is _not_ zlib inflation (ie. is our code).

	for i := 0; i < packfile.ObjectCount; i++ {
		var pos = pr.Pos()
		obj, err := pr.readObject(packfile)
		if err != nil && err != io.EOF {
			return err
		}

		pr.offsets[pos] = obj.hash

		if errors.Is(err, io.EOF) {
			break
		}
	}

	return nil
}

func (pr *PackfileReader) readObject(packfile *Packfile) (*objectReader, error) {
	o, err := newObjectReader(pr, packfile)
	if err != nil {
		return nil, err
	}

	switch o.typ {
	case OBJ_REF_DELTA:
		err = o.readREFDelta()
	case OBJ_OFS_DELTA:
		err = o.readOFSDelta()
	case OBJ_COMMIT, OBJ_TREE, OBJ_BLOB, OBJ_TAG:
		err = o.readObject()
	default:
		err = NewError("Invalid git object tag %q", o.typ)
	}

	if err != nil {
		return nil, err
	}

	return o, err
}

const (
	OBJ_COMMIT    = 1
	OBJ_TREE      = 2
	OBJ_BLOB      = 3
	OBJ_TAG       = 4
	OBJ_OFS_DELTA = 6
	OBJ_REF_DELTA = 7
)

const SIZE_LIMIT uint64 = 1 << 32 // 4GB

type objectReader struct {
	pr    *PackfileReader
	pf    *Packfile
	hash  string
	steps int

	typ  int8
	size uint64
}

func newObjectReader(pr *PackfileReader, pf *Packfile) (*objectReader, error) {
	o := &objectReader{pr: pr, pf: pf}

	var buf [1]byte
	if _, err := o.Read(buf[:]); err != nil {
		return nil, err
	}

	o.typ = int8((buf[0] >> 4) & 7)
	o.size = uint64(buf[0] & 15)
	o.steps++ // byte we just read to get `o.typ` and `o.size`

	var shift uint = 4
	for buf[0]&0x80 == 0x80 {
		if _, err := o.Read(buf[:]); err != nil {
			return nil, err
		}

		o.size += uint64(buf[0]&0x7f) << shift
		o.steps++ // byte we just read to update `o.size`
		shift += 7
	}

	return o, nil
}

func (o *objectReader) readREFDelta() error {
	var ref [20]byte
	if _, err := o.Read(ref[:]); err != nil {
		return err
	}

	buf, err := o.inflate()
	if err != nil {
		return err
	}

	refhash := fmt.Sprintf("%x", ref)
	referenced, ok := o.pr.objects[refhash]
	if !ok {
		o.pr.deltas = append(o.pr.deltas, packfileDelta{hash: refhash, delta: buf[:]})
	} else {
		patched := PatchDelta(referenced.bytes, buf[:])
		if patched == nil {
			return NewError("error while patching %x", ref)
		}
		o.typ = referenced.typ
		err = o.addObject(patched)
		if err != nil {
			return err
		}
	}

	return nil
}

func decodeOffset(src io.ByteReader, steps int) (int, error) {
	b, err := src.ReadByte()
	if err != nil {
		return 0, err
	}
	var offset = int(b & 0x7f)
	for (b & 0x80) != 0 {
		offset += 1 // WHY?
		b, err = src.ReadByte()
		if err != nil {
			return 0, err
		}
		offset = (offset << 7) + int(b&0x7f)
	}
	// offset needs to be aware of the bytes we read for `o.typ` and `o.size`
	offset += steps
	return -offset, nil
}

func (o *objectReader) readOFSDelta() error {
	var pos = o.pr.Pos()

	// read negative offset
	offset, err := decodeOffset(o.pr.r, o.steps)
	if err != nil {
		return err
	}

	buf, err := o.inflate()
	if err != nil {
		return err
	}

	refhash := o.pr.offsets[pos+offset]
	referenced, ok := o.pr.objects[refhash]
	if !ok {
		return NewError("can't find a pack entry at %d", pos+offset)
	} else {
		patched := PatchDelta(referenced.bytes, buf)
		if patched == nil {
			return NewError("error while patching %x", refhash)
		}
		o.typ = referenced.typ
		err = o.addObject(patched)
		if err != nil {
			return err
		}
	}

	return nil
}

func (o *objectReader) readObject() error {
	buf, err := o.inflate()
	if err != nil {
		return err
	}

	return o.addObject(buf)
}

func (o *objectReader) addObject(bytes []byte) error {
	var hash string

	switch o.typ {
	case OBJ_COMMIT:
		c, err := NewCommit(bytes)
		if err != nil {
			return err
		}
		o.pf.Commits[c.Hash()] = c
		hash = c.Hash()
	case OBJ_TREE:
		c, err := NewTree(bytes)
		if err != nil {
			return err
		}
		o.pf.Trees[c.Hash()] = c
		hash = c.Hash()
	case OBJ_BLOB:
		c, err := NewBlob(bytes)
		if err != nil {
			return err
		}
		o.pf.Blobs[c.Hash()] = c
		hash = c.Hash()

		if o.pr.contentCallback != nil {
			o.pr.contentCallback(hash, bytes)
		}
	}

	o.pr.objects[hash] = packfileObject{bytes: bytes, typ: o.typ}
	o.hash = hash

	return nil
}

func (o *objectReader) inflate() ([]byte, error) {
	zr, err := zlib.NewReader(o.pr.r)
	if err != nil {
		if errors.Is(err, zlib.ErrHeader) {
			return nil, zlib.ErrHeader
		} else {
			return nil, NewError("error opening packfile's object zlib: %v", err)
		}
	}
	defer zr.Close()

	if o.size > SIZE_LIMIT {
		return nil, NewError("the object size exceeed the allowed limit: %d", o.size)
	}

	var buf bytes.Buffer
	_, err = io.Copy(&buf, zr) // also: io.CopyN(&buf, zr, int64(o.size))
	if err != nil {
		return nil, err
	}

	var bufLen = buf.Len()
	if bufLen != int(o.size) {
		return nil, NewError("inflated size mismatch, expected %d, got %d", o.size, bufLen)
	}

	return buf.Bytes(), nil
}

func (o *objectReader) Read(p []byte) (int, error) {
	return o.pr.r.Read(p)
}

func (o *objectReader) ReadByte() (byte, error) {
	return o.pr.r.ReadByte()
}

type ReaderError struct {
	Msg string // description of error
}

func NewError(format string, args ...interface{}) error {
	return &ReaderError{Msg: fmt.Sprintf(format, args...)}
}

func (e *ReaderError) Error() string { return e.Msg }

func githash(t string, b []byte) string {
	h := []byte(t)
	h = append(h, ' ')
	h = strconv.AppendInt(h, int64(len(b)), 10)
	h = append(h, 0)
	h = append(h, b...)

	return fmt.Sprintf("%x", sha1.Sum(h))
}

func parsePktLine(b []byte) (lines [][]byte, err error) {
	for len(b) > 0 {
		n, err := strconv.ParseInt(string(b[0:4]), 16, 64)
		if err != nil {
			return nil, err
		}
		if n < 4 {
			lines = append(lines, nil)
			b = b[4:]
			continue
		}
		line := b[4:n]
		lines = append(lines, line)
		if n >= int64(len(b)) {
			return nil, fmt.Errorf("invalid pkt-line length: %d, buffer has %d bytes", n, len(b))
		}
		b = b[n:]
	}
	return lines, nil
}

func fmtLines(lines []string) (b []byte) {
	for _, line := range lines {
		if line == "" {
			b = append(b, '0', '0', '0', '1')
			continue
		}
		n := fmt.Sprintf("%04x", len(line)+4)
		b = append(b, []byte(n)...)
		b = append(b, []byte(line)...)
	}
	b = append(b, '0', '0', '0', '0')
	return b
}

func req(org, repo string) ([]byte, error) {
	req, err := http.NewRequest("GET", "https://github.com/"+org+"/"+repo+".git/info/refs?service=git-upload-pack", nil)
	if err != nil {
		return nil, err
	}
	req.Header.Add("Git-Protocol", "version=2")
	res, err := http.DefaultClient.Do(req)
	if err != nil {
		return nil, err
	}
	b, err := io.ReadAll(res.Body)
	_ = res.Body.Close()
	return b, err
}

func cmd(org, repo string, data []byte) ([]byte, error) {
	body := io.NopCloser(bytes.NewReader(data))
	req, err := http.NewRequest("POST", "https://github.com/"+org+"/"+repo+"/git-upload-pack", body)
	if err != nil {
		return nil, err
	}
	req.Header.Add("Git-Protocol", "version=2")
	res, err := http.DefaultClient.Do(req)
	if err != nil {
		return nil, err
	}
	b, err := io.ReadAll(res.Body)
	_ = res.Body.Close()
	return b, err
}
