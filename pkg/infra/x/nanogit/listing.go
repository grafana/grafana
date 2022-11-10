package nanogit

import (
	"bytes"
	"fmt"
	"sort"
	"strings"

	"github.com/grafana/grafana-plugin-sdk-go/data"
)

func ListRefs(addr GitAddress) ([]TreeEntry, error) {
	refs := make([]TreeEntry, 0, 10)
	refsData, err := cmd(addr.Owner, addr.Repo, fmtLines([]string{
		"command=ls-refs\n",
		"object-format=sha1\n",
	}))
	if err != nil {
		return refs, err
	}
	lines, err := parsePktLine(refsData)
	if err != nil {
		return refs, err
	}
	for _, linex := range lines {
		line := strings.TrimRight(string(linex), "\r\n")
		idx := strings.Index(line, " ")
		if idx > 5 {
			refs = append(refs, TreeEntry{
				Hash: line[0:idx],
				Name: line[idx+1:],
			})
		}
	}
	return refs, err
}

type treeListing struct {
	Root      *node              `json:"root,omitempty"`
	Shared    map[string][]*node `json:"shared,omitempty"` // Some folder trees are redundant
	Errors    []string           `json:"errors,omitempty"`
	BytesRead int                `json:"bytesRead,omitempty"`
}

type node struct {
	Name     string `json:"name,omitempty"`
	Hash     string `json:"hash,omitempty"`
	IsShared bool   `json:"shared,omitempty"`
	IsFolder bool   `json:"folder,omitempty"`
	Body     []byte `json:"body,omitempty"`

	Children []*node `json:"children,omitempty"`
}

type byName []*node

func (s byName) Len() int {
	return len(s)
}
func (s byName) Swap(i, j int) {
	s[i], s[j] = s[j], s[i]
}
func (s byName) Less(i, j int) bool {
	return s[i].Name < s[j].Name
}

func (n *node) sort() {
	if n.Children == nil {
		return
	}
	sort.Sort(byName(n.Children))
	for _, c := range n.Children {
		c.sort()
	}
}

func (t *treeListing) toDataFrame() *data.Frame {
	path := data.NewFieldFromFieldType(data.FieldTypeString, 0)
	hash := data.NewFieldFromFieldType(data.FieldTypeString, 0)
	path.Name = "path"
	hash.Name = "hash"

	visitor := func(prefix string, n *node) {}
	trav := func(prefix string, n *node) {
		sub := prefix + n.Name
		if n.IsFolder {
			sub += "/"
		}
		path.Append(sub)
		hash.Append(n.Hash)

		children := n.Children
		if children == nil && n.IsShared {
			children = t.Shared[n.Hash]
		}
		for _, child := range children {
			visitor(sub, child)
		}
	}
	visitor = trav // lets it be defined inside the function
	for _, r := range t.Root.Children {
		trav("", r)
	}

	return data.NewFrame("", path, hash)
}

func readPackfileResponse(lines [][]byte, i int) []byte {
	offset := 1
	var file []byte
	part := lines[i+offset]
	for bytes.HasPrefix(part, []byte("\x01")) {
		file = append(file, part[1:]...)
		offset++
		part = lines[i+offset]
	}
	return file
}

func GetListing(addr GitAddress) (*data.Frame, error) {
	if addr.Branch == "" {
		return nil, fmt.Errorf("missing bracnch")
	}

	listing := treeListing{}
	x, err := cmd(addr.Owner, addr.Repo, fmtLines([]string{
		"command=fetch\n",
		"object-format=sha1\n",
		"",
		"thin-pack\n",
		"no-progress\n",
		"ofs-delta\n",
		"deepen 1\n",
		"filter blob:none\n",
		"want " + addr.Branch + "\n",
		"done\n",
	}))
	if err != nil {
		return nil, err
	}

	parts, err := parsePktLine(x)
	if err != nil {
		return nil, err
	}

	shared := make([]*node, 0)
	trees := make(map[string]*node, 0)
	entries := make(map[string]*node, 0)
	for i, p := range parts {
		if string(p) == "packfile\n" {
			file := readPackfileResponse(parts, i)

			rr, err := NewPackfileReader(bytes.NewReader(file), 1000000, nil)
			if err != nil {
				return nil, err
			}
			p, err := rr.Read()
			if err != nil {
				return nil, err
			}

			for name, t := range p.Trees {
				n := &node{
					Hash:     name,
					IsFolder: true,
				}
				trees[n.Hash] = n
				for _, e := range t.Entries {
					child := &node{
						Name: e.Name,
						Hash: e.Hash,
					}
					n.Children = append(n.Children, child)

					old := entries[e.Hash]
					if old != nil {
						old.IsShared = true
						child.IsShared = true
						shared = append(shared, old, child)
					}
					entries[e.Hash] = child // This may be a tree!
				}
			}
		}
	}

	for _, tree := range trees {
		entry, ok := entries[tree.Hash]
		if ok {
			if entry.Children != nil {
				listing.Errors = append(listing.Errors, fmt.Sprintf("found twice %s", tree.Hash))
			}
			entry.IsFolder = true
			if entry.IsShared {
				tree.sort()
				if listing.Shared == nil {
					listing.Shared = make(map[string][]*node)
				}
				listing.Shared[tree.Hash] = tree.Children
			} else {
				entry.Children = tree.Children
			}
		} else if listing.Root == nil {
			listing.Root = tree
		} else {
			listing.Errors = append(listing.Errors, fmt.Sprintf("found multiple roots: %s", tree.Hash))
			fmt.Printf("multiple roots???")
		}
	}

	if listing.Shared != nil {
		for _, entry := range shared {
			if listing.Shared[entry.Hash] != nil {
				entry.IsFolder = true
				entry.IsShared = true
			}
		}
	}

	listing.Root.sort()
	frame := listing.toDataFrame()
	frame.Meta = &data.FrameMeta{
		Custom: &GetFrameMeta{
			Address:   addr,
			BytesRead: len(x),
		},
	}
	return frame, err
}

// https://git-scm.com/docs/protocol-v2
func ReadBody(addr GitAddress, oids ...string) error {
	lines := []string{
		"command=fetch\n",
		"object-format=sha1\n",
		"",
		"thin-pack\n",
		"no-progress\n",
		"ofs-delta\n",
		"deepen 1\n",
		"filter blob:none\n",
		"shallow " + addr.Branch + "\n",
	}
	for _, s := range oids {
		lines = append(lines, fmt.Sprintf("want %s\n", s))
	}
	lines = append(lines, "done\n")

	z, err := cmd(addr.Owner, addr.Repo, fmtLines(lines))
	if err != nil {
		return err
	}
	parts, _ := parsePktLine(z)
	for i, p := range parts {
		if string(p) == "packfile\n" {
			file := readPackfileResponse(parts, i)

			cache := map[string][]byte{}
			rr, _ := NewPackfileReader(bytes.NewReader(file), 1000000, func(hash string, content []byte) {
				cache[hash] = content
			})
			p, err := rr.Read()
			if err != nil {
				return err
			}

			for k, v := range p.Commits {
				fmt.Println("Commit", k, v.Author, v.Message)
			}

			for name := range p.Blobs {
				fmt.Println("BLOG", name, len(cache[name]), "bytes")
			}
		}
	}
	return err
}
