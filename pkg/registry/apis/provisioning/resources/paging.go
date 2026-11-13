package resources

import (
	"cmp"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"slices"

	apierrors "k8s.io/apimachinery/pkg/api/errors"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
)

// ListOptions bounds one page of a managed-resource list.
type ListOptions struct {
	// Limit caps the items returned; zero returns every item and no continue token.
	Limit int64
	// Continue resumes after the item named by the previous page's continue token.
	Continue string
}

// resourceListKey orders the list and identifies where a page resumes from. A namespace holds one
// object per group, resource and name, so the three together are unique and the order is total.
type resourceListKey struct {
	Group    string `json:"g"`
	Resource string `json:"r"`
	Name     string `json:"n"`
}

func keyOf(item provisioning.ResourceListItem) resourceListKey {
	return resourceListKey{Group: item.Group, Resource: item.Resource, Name: item.Name}
}

func (k resourceListKey) compare(other resourceListKey) int {
	return cmp.Or(
		cmp.Compare(k.Group, other.Group),
		cmp.Compare(k.Resource, other.Resource),
		cmp.Compare(k.Name, other.Name),
	)
}

func (k resourceListKey) encode() string {
	// The field set is fixed and every field is a string, so marshalling cannot fail.
	raw, _ := json.Marshal(k)
	return base64.RawURLEncoding.EncodeToString(raw)
}

func decodeContinue(token string) (resourceListKey, error) {
	invalid := func(reason string) error {
		return apierrors.NewBadRequest(fmt.Sprintf("invalid continue token: %s", reason))
	}
	raw, err := base64.RawURLEncoding.DecodeString(token)
	if err != nil {
		return resourceListKey{}, invalid(err.Error())
	}
	var key resourceListKey
	if err := json.Unmarshal(raw, &key); err != nil {
		return resourceListKey{}, invalid(err.Error())
	}
	// Decoding alone does not establish a key: `null` and `{}` both yield an empty one, which
	// sorts before every item and would silently restart the list. Group may be empty.
	if key.Resource == "" || key.Name == "" {
		return resourceListKey{}, invalid("missing resource or name")
	}
	return key, nil
}

// resourcePage is a validated page request: how many items to return, and where to resume.
type resourcePage struct {
	limit int64
	after *resourceListKey
}

// newResourcePage validates the paging parameters. The lister calls it before its reads, so a bad
// token costs nothing and fails as a bad request rather than as whatever the reads returned.
func newResourcePage(opts ListOptions) (resourcePage, error) {
	page := resourcePage{limit: opts.Limit}
	if opts.Continue != "" {
		after, err := decodeContinue(opts.Continue)
		if err != nil {
			return resourcePage{}, err
		}
		page.after = &after
	}
	return page, nil
}

// of returns the page's items in the key order, with the token that resumes after it. Items are
// sorted whether or not paging was asked for: a caller that drops the limit must not get the same
// items in another order.
func (p resourcePage) of(items []provisioning.ResourceListItem) *provisioning.ResourceList {
	slices.SortFunc(items, func(a, b provisioning.ResourceListItem) int {
		return keyOf(a).compare(keyOf(b))
	})

	if p.after != nil {
		from, _ := slices.BinarySearchFunc(items, *p.after, func(item provisioning.ResourceListItem, key resourceListKey) int {
			return keyOf(item).compare(key)
		})
		if from < len(items) && keyOf(items[from]).compare(*p.after) == 0 {
			from++
		}
		items = items[from:]
	}

	list := &provisioning.ResourceList{}
	if p.limit > 0 && int64(len(items)) > p.limit {
		items = items[:p.limit]
		list.Continue = keyOf(items[len(items)-1]).encode()
	}
	list.Items = items
	return list
}
