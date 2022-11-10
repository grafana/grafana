package nanogit

import (
	"bytes"
	"fmt"
	"sort"
	"strings"
)

type GitAddress struct {
	Owner string `json:"owner"`
	Repo  string `json:"repo"`
}

type TreeListing struct {
	Branch    string             `json:"branch"`
	Root      *Node              `json:"root,omitempty"`
	Shared    map[string][]*Node `json:"shared,omitempty"` // Some folder trees are redundant
	Errors    []string           `json:"errors,omitempty"`
	BytesRead int                `json:"bytesRead,omitempty"`
}

type Node struct {
	Name     string `json:"name,omitempty"`
	Hash     string `json:"hash,omitempty"`
	IsShared bool   `json:"shared,omitempty"`
	IsFolder bool   `json:"folder,omitempty"`
	Body     []byte `json:"body,omitempty"`

	Children []*Node `json:"children,omitempty"`
}

type byName []*Node

func (s byName) Len() int {
	return len(s)
}
func (s byName) Swap(i, j int) {
	s[i], s[j] = s[j], s[i]
}
func (s byName) Less(i, j int) bool {
	return s[i].Name < s[j].Name
}

func (n *Node) sort() {
	if n.Children == nil {
		return
	}
	sort.Sort(byName(n.Children))
	for _, c := range n.Children {
		c.sort()
	}
}

func ListRefs(addr GitAddress) ([]Node, error) {
	refs := make([]Node, 0, 10)
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
			refs = append(refs, Node{
				Hash: line[0:idx],
				Name: line[idx+1:],
			})
		}
	}
	return refs, err
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

func ReadTree(addr GitAddress, branch string) (TreeListing, error) {
	listing := TreeListing{Branch: branch}
	x, err := cmd(addr.Owner, addr.Repo, fmtLines([]string{
		"command=fetch\n",
		"object-format=sha1\n",
		"",
		"thin-pack\n",
		"no-progress\n",
		"ofs-delta\n",
		"deepen 1\n",
		"filter blob:none\n",
		"want " + branch + "\n",
		"done\n",
	}))
	if err != nil {
		return listing, err
	}

	listing.BytesRead = len(x)
	parts, err := parsePktLine(x)
	if err != nil {
		return listing, err
	}

	shared := make([]*Node, 0)
	trees := make(map[string]*Node, 0)
	entries := make(map[string]*Node, 0)
	for i, p := range parts {
		if string(p) == "packfile\n" {
			file := readPackfileResponse(parts, i)

			rr, err := NewPackfileReader(bytes.NewReader(file), 1000000, nil)
			if err != nil {
				return listing, err
			}
			p, err := rr.Read()
			if err != nil {
				return listing, err
			}

			for name, t := range p.Trees {
				node := &Node{
					Hash:     name,
					IsFolder: true,
				}
				trees[node.Hash] = node
				for _, e := range t.Entries {
					child := &Node{
						Name: e.Name,
						Hash: e.Hash,
					}
					node.Children = append(node.Children, child)

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
					listing.Shared = make(map[string][]*Node)
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

		if tree.IsShared {
			fmt.Printf("SHARED TREEXX: %s\n", tree.Hash)
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
	return listing, err
}

// https://git-scm.com/docs/protocol-v2
func ReadBody(addr GitAddress, branch string, oids ...string) ([]Node, error) {
	lines := []string{
		"command=fetch\n",
		"object-format=sha1\n",
		"",
		"thin-pack\n",
		"no-progress\n",
		"ofs-delta\n",
		"deepen 1\n",
		"filter blob:none\n",
		"shallow " + branch + "\n",
	}
	for _, s := range oids {
		lines = append(lines, fmt.Sprintf("want %s\n", s))
	}
	lines = append(lines, "done\n")

	z, err := cmd(addr.Owner, addr.Repo, fmtLines(lines))
	if err != nil {
		return nil, err
	}
	nodes := make([]Node, 0, len(oids))
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
				return nodes, err
			}

			for k, v := range p.Commits {
				fmt.Println("COMIT", k, v.Author)
			}

			for name, _ := range p.Blobs {
				nodes = append(nodes, Node{
					Hash: name,
					Body: cache[name],
				})
			}
		}
	}
	return nodes, err
}
