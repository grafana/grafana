package resourcepermission

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"strconv"
	"strings"
	"time"

	"github.com/grafana/grafana/apps/iam/pkg/apis/iam/v0alpha1"
)

type continueToken struct {
	id int64 // the internal id (sort by!)
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
	token.id, err = strconv.ParseInt(sub[1], 10, 64)
	if err != nil {
		return token, fmt.Errorf("error parsing updated")
	}

	return token, err
}

func (r *continueToken) String() string {
	return fmt.Sprintf("start:%d", r.id)
}

type listIterator struct {
	// Rows returned by the query
	rows *sql.Rows
	// permissionGroups maps a group key to its resource permissions
	permissionGroups map[string][]flatResourcePermission
	// Current row being processed
	row *v0alpha1.ResourcePermission
	// Error encountered during iteration
	err error
	// Continue token for pagination
	token continueToken
	// List of rejected items
	// If there are > 1000 rejected items, the iterator will stop and return an error.
	rejected []v0alpha1.ResourcePermission
	// keys for iteration over the permissionGroups map
	keys []string
	// current key index
	currentKeyIndex int
	// Track the highest resource version seen during iteration
	listRV int64
}

func (r *listIterator) Close() error {
	if r.rows != nil {
		return r.rows.Close()
	}
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
	return r.row.Name
}

// Namespace implements resource.ListIterator.
func (r *listIterator) Namespace() string {
	return ""
}

// Next implements resource.ListIterator.
func (r *listIterator) Next() bool {
	if r.err != nil {
		return false
	}

	// Process grouped permissions
	if r.currentKeyIndex < len(r.keys) {
		key := r.keys[r.currentKeyIndex]
		perms := r.permissionGroups[key]

		resourcePermission := toV0ResourcePermission(perms)
		if resourcePermission == nil {
			r.currentKeyIndex++
			return r.Next() // Try next group
		}

		r.row = resourcePermission
		r.currentKeyIndex++

		// Update listRV with the highest resource version seen
		// Use timestamp-based versioning for now (consistent with write operations)
		if resourcePermission != nil {
			currentRV := int64(time.Now().UnixMilli())
			if r.listRV < currentRV {
				r.listRV = currentRV
			}
		}

		// Set the continue token based on the first permission in the group
		if len(perms) > 0 {
			r.token.id = perms[0].ID
		}

		return true
	}

	return false
}

// ResourceVersion implements resource.ListIterator.
func (r *listIterator) ResourceVersion() int64 {
	// Since ResourcePermissions don't have a version field, we'll use the current timestamp
	return 1
}

// Value implements resource.ListIterator.
func (r *listIterator) Value() []byte {
	b, err := json.Marshal(r.row)
	r.err = err
	return b
}
