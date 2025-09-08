package resourcepermission

import (
	"encoding/json"
	"fmt"
	"strconv"
	"strings"

	"github.com/grafana/grafana/apps/iam/pkg/apis/iam/v0alpha1"
)

type continueToken struct {
	offset int64 // the internal id (sort by!)
}

func readContinueToken(next string) (continueToken, error) {
	var err error
	token := continueToken{}
	if next == "" {
		return token, nil
	}
	parts := strings.Split(next, "/")
	sub := strings.Split(parts[0], ":")
	if sub[0] != "start" {
		return token, fmt.Errorf("expected internal ID in second slug")
	}
	token.offset, err = strconv.ParseInt(sub[1], 10, 64)
	if err != nil {
		return token, fmt.Errorf("error parsing updated")
	}

	return token, err
}

func (r *continueToken) String() string {
	return fmt.Sprintf("start:%d", r.offset)
}

// listIterator implements resource.ListIterator for iterating over resource permissions.
type listIterator struct {
	// List of resourcePermissions to iterate over
	resourcePermissions []v0alpha1.ResourcePermission
	// Initial offset
	initOffset int64
	// Current index in the resource permission slice (1-based)
	idx int
	// Error encountered during iteration
	err error
	// Continue token for pagination
	token continueToken
}

func (r *listIterator) cur() *v0alpha1.ResourcePermission {
	// idx is 1-based
	return &r.resourcePermissions[r.idx-1]
}

func (r *listIterator) Close() error {
	return nil
}

// ContinueToken implements resource.ListIterator.
func (r *listIterator) ContinueToken() string {
	return r.token.String()
}

// Error implements resource.ListIterator.
func (r *listIterator) Error() error {
	return r.err
}

// Folder implements resource.ListIterator.
func (r *listIterator) Folder() string {
	return ""
}

// Name implements resource.ListIterator.
func (r *listIterator) Name() string {
	return r.cur().Name
}

// Namespace implements resource.ListIterator.
func (r *listIterator) Namespace() string {
	return r.resourcePermissions[r.idx-1].GetNamespace()
}

// Next implements resource.ListIterator.
func (r *listIterator) Next() bool {
	if r.err != nil || r.idx >= len(r.resourcePermissions) {
		return false
	}

	r.idx++
	r.token.offset = r.initOffset + int64(r.idx)

	return true
}

// ResourceVersion implements resource.ListIterator.
func (r *listIterator) ResourceVersion() int64 {
	return r.cur().GetUpdateTimestamp().UnixMilli()
}

// Value implements resource.ListIterator.
func (r *listIterator) Value() []byte {
	b, err := json.Marshal(r.cur())
	r.err = err
	return b
}
