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
	raw, err := base64.RawURLEncoding.DecodeString(token)
	if err != nil {
		return resourceListKey{}, apierrors.NewBadRequest(fmt.Sprintf("invalid continue token: %s", err))
	}
	var key resourceListKey
	if err := json.Unmarshal(raw, &key); err != nil {
		return resourceListKey{}, apierrors.NewBadRequest(fmt.Sprintf("invalid continue token: %s", err))
	}
	return key, nil
}

// pageResourceList returns one page of items in the key order, with the token that resumes after
// it. Items are sorted whether or not paging was asked for: a caller that drops the limit must not
// get the same items in another order.
func pageResourceList(items []provisioning.ResourceListItem, opts ListOptions) (*provisioning.ResourceList, error) {
	slices.SortFunc(items, func(a, b provisioning.ResourceListItem) int {
		return keyOf(a).compare(keyOf(b))
	})

	if opts.Continue != "" {
		after, err := decodeContinue(opts.Continue)
		if err != nil {
			return nil, err
		}
		from, _ := slices.BinarySearchFunc(items, after, func(item provisioning.ResourceListItem, key resourceListKey) int {
			return keyOf(item).compare(key)
		})
		if from < len(items) && keyOf(items[from]).compare(after) == 0 {
			from++
		}
		items = items[from:]
	}

	list := &provisioning.ResourceList{}
	if opts.Limit > 0 && int64(len(items)) > opts.Limit {
		items = items[:opts.Limit]
		list.Continue = keyOf(items[len(items)-1]).encode()
	}
	list.Items = items
	return list, nil
}
