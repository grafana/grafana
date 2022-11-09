package nanogit

import (
	"bytes"
	"fmt"
	"sort"
)

type GitAddress struct {
	Owner string `json:"owner"`
	Repo  string `json:"repo"`
}

type TreeListing struct {
	Branch    string   `json:"branch"`
	Root      *Node    `json:"root,omitempty"`
	BytesRead int      `json:"bytesRead,omitempty"`
	Errors    []string `json:"errors,omitempty"`
}

type Node struct {
	Name string `json:"name,omitempty"`
	Hash string `json:"hash,omitempty"`
	Body []byte `json:"body,omitempty"`

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
	return len(s[i].Name) < len(s[j].Name)
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

	trees := make(map[string]*Node, 0)
	entries := make(map[string]*Node, 0)
	for i, p := range parts {
		if string(p) == "packfile\n" {
			file := parts[i+1][1:]
			part2 := parts[i+2][1:]
			part3 := parts[i+3][1:]
			part4 := parts[i+4][1:]
			file = append(file, part2...)
			file = append(file, part3...)
			file = append(file, part4...)

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
					Hash: name,
				}
				trees[node.Hash] = node
				for _, e := range t.Entries {
					child := &Node{
						Name: e.Name,
						Hash: e.Hash,
					}
					entries[e.Hash] = child
					node.Children = append(node.Children, child)
				}
			}
		}
	}

	for _, tree := range trees {
		entry, ok := entries[tree.Hash]
		if ok {
			entry.Children = tree.Children
		} else if listing.Root == nil {
			listing.Root = tree
		} else {
			listing.Errors = append(listing.Errors, fmt.Sprintf("found multiple roots: %s", tree.Hash))
			fmt.Printf("multiple roots???")
		}
	}

	// for _, c := range tree.Children {
	// 	found, ok := trees[c.Hash]
	// 	if !ok {
	// 		found, ok = entries[c.Hash]
	// 	}
	// 	if ok {
	// 		c.Children = found.Children
	// 	}
	// }

	listing.Root.sort()
	return listing, err
}
