package resource

import (
	"context"
	"fmt"
	"io"
	"iter"
	"regexp"
	"strconv"
	"strings"
)

const (
	dataSection = "unified/data"
)

// dataStore is a data store that uses a KV store to store data.
type dataStore struct {
	kv KV
}

func newDataStore(kv KV) *dataStore {
	return &dataStore{
		kv: kv,
	}
}

type DataObj struct {
	Key   DataKey
	Value io.ReadCloser
}

type DataKey struct {
	Namespace       string
	Group           string
	Resource        string
	Name            string
	ResourceVersion int64
	Action          DataAction
}

var (
	// validNameRegex validates that a name contains only lowercase alphanumeric characters, '-' or '.'
	// and starts and ends with an alphanumeric character
	validNameRegex = regexp.MustCompile(`^[a-z0-9]([a-z0-9.-]*[a-z0-9])?$`)

	// k8sRegex validates Kubernetes qualified name format
	// must consist of alphanumeric characters, '-', '_' or '.', and must start and end with an alphanumeric character
	// all future Grafana UIDs will need to conform to this
	k8sRegex = regexp.MustCompile(`^[A-Za-z0-9][-A-Za-z0-9_.]*[A-Za-z0-9]$`)

	// legacyNameRegex validates legacy UIDs: letters, numbers, dashes, underscores
	// this matches the shortids that legacy Grafana used to generate uids
	legacyNameRegex = regexp.MustCompile(`^[a-zA-Z0-9\-_]+$`)
)

func (k DataKey) String() string {
	return fmt.Sprintf("%s/%s/%s/%s/%d~%s", k.Namespace, k.Group, k.Resource, k.Name, k.ResourceVersion, k.Action)
}

func (k DataKey) Equals(other DataKey) bool {
	return k.Namespace == other.Namespace && k.Group == other.Group && k.Resource == other.Resource && k.Name == other.Name && k.ResourceVersion == other.ResourceVersion && k.Action == other.Action
}

func (k DataKey) Validate() error {
	if k.Namespace == "" {
		if k.Group != "" || k.Resource != "" || k.Name != "" {
			return fmt.Errorf("namespace is required when group, resource, or name are provided")
		}
		return fmt.Errorf("namespace cannot be empty")
	}
	if k.Group == "" {
		if k.Resource != "" || k.Name != "" {
			return fmt.Errorf("group is required when resource or name are provided")
		}
		return fmt.Errorf("group cannot be empty")
	}
	if k.Resource == "" {
		if k.Name != "" {
			return fmt.Errorf("resource is required when name is provided")
		}
		return fmt.Errorf("resource cannot be empty")
	}
	if k.Name == "" {
		return fmt.Errorf("name cannot be empty")
	}
	if k.Action == "" {
		return fmt.Errorf("action cannot be empty")
	}

	// Validate each field against the naming rules
	if !validNameRegex.MatchString(k.Namespace) {
		return fmt.Errorf("namespace '%s' is invalid", k.Namespace)
	}
	if !validNameRegex.MatchString(k.Group) {
		return fmt.Errorf("group '%s' is invalid", k.Group)
	}
	if !validNameRegex.MatchString(k.Resource) {
		return fmt.Errorf("resource '%s' is invalid", k.Resource)
	}
	if !k8sRegex.MatchString(k.Name) && !legacyNameRegex.MatchString(k.Name) {
		return fmt.Errorf("name '%s' is invalid, must match k8s qualified name format or Grafana shortid format", k.Name)
	}

	switch k.Action {
	case DataActionCreated, DataActionUpdated, DataActionDeleted:
		return nil
	default:
		return fmt.Errorf("action '%s' is invalid: must be one of 'created', 'updated', or 'deleted'", k.Action)
	}
}

type ListRequestKey struct {
	Namespace string
	Group     string
	Resource  string
	Name      string
}

func (k ListRequestKey) Validate() error {
	// Check hierarchical validation - if a field is empty, more specific fields should also be empty
	if k.Namespace == "" {
		if k.Group != "" || k.Resource != "" || k.Name != "" {
			return fmt.Errorf("namespace is required when group, resource, or name are provided")
		}
		return nil // Empty namespace is allowed for ListRequestKey
	}
	if k.Group == "" {
		if k.Resource != "" || k.Name != "" {
			return fmt.Errorf("group is required when resource or name are provided")
		}
		// Only validate namespace if it's provided
		if !validNameRegex.MatchString(k.Namespace) {
			return fmt.Errorf("namespace '%s' is invalid", k.Namespace)
		}
		return nil
	}
	if k.Resource == "" {
		if k.Name != "" {
			return fmt.Errorf("resource is required when name is provided")
		}
		// Validate namespace and group if they're provided
		if !validNameRegex.MatchString(k.Namespace) {
			return fmt.Errorf("namespace '%s' is invalid", k.Namespace)
		}
		if !validNameRegex.MatchString(k.Group) {
			return fmt.Errorf("group '%s' is invalid", k.Group)
		}
		return nil
	}

	// All fields are provided, validate each one
	if !validNameRegex.MatchString(k.Namespace) {
		return fmt.Errorf("namespace '%s' is invalid", k.Namespace)
	}
	if !validNameRegex.MatchString(k.Group) {
		return fmt.Errorf("group '%s' is invalid", k.Group)
	}
	if !validNameRegex.MatchString(k.Resource) {
		return fmt.Errorf("resource '%s' is invalid", k.Resource)
	}
	if k.Name != "" && !k8sRegex.MatchString(k.Name) && !legacyNameRegex.MatchString(k.Name) {
		return fmt.Errorf("name '%s' is invalid", k.Name)
	}

	return nil
}

func (k ListRequestKey) Prefix() string {
	if k.Namespace == "" {
		return ""
	}
	if k.Group == "" {
		return fmt.Sprintf("%s/", k.Namespace)
	}
	if k.Resource == "" {
		return fmt.Sprintf("%s/%s/", k.Namespace, k.Group)
	}
	if k.Name == "" {
		return fmt.Sprintf("%s/%s/%s/", k.Namespace, k.Group, k.Resource)
	}
	return fmt.Sprintf("%s/%s/%s/%s/", k.Namespace, k.Group, k.Resource, k.Name)
}

type DataAction string

const (
	DataActionCreated DataAction = "created"
	DataActionUpdated DataAction = "updated"
	DataActionDeleted DataAction = "deleted"
)

// Keys returns all keys for a given key by iterating through the KV store
func (d *dataStore) Keys(ctx context.Context, key ListRequestKey) iter.Seq2[DataKey, error] {
	if err := key.Validate(); err != nil {
		return func(yield func(DataKey, error) bool) {
			yield(DataKey{}, err)
		}
	}

	prefix := key.Prefix()
	return func(yield func(DataKey, error) bool) {
		for k, err := range d.kv.Keys(ctx, dataSection, ListOptions{
			StartKey: prefix,
			EndKey:   PrefixRangeEnd(prefix),
		}) {
			if err != nil {
				yield(DataKey{}, err)
				return
			}
			key, err := ParseKey(k)
			if err != nil {
				yield(DataKey{}, err)
				return
			}
			if !yield(key, nil) {
				return
			}
		}
	}
}

// LastResourceVersion returns the last key for a given resource
func (d *dataStore) LastResourceVersion(ctx context.Context, key ListRequestKey) (DataKey, error) {
	if err := key.Validate(); err != nil {
		return DataKey{}, fmt.Errorf("invalid data key: %w", err)
	}
	if key.Group == "" || key.Resource == "" || key.Namespace == "" || key.Name == "" {
		return DataKey{}, fmt.Errorf("group, resource, namespace or name is empty")
	}
	prefix := key.Prefix()
	for key, err := range d.kv.Keys(ctx, dataSection, ListOptions{
		StartKey: prefix,
		EndKey:   PrefixRangeEnd(prefix),
		Limit:    1,
		Sort:     SortOrderDesc,
	}) {
		if err != nil {
			return DataKey{}, err
		}
		return ParseKey(key)
	}
	return DataKey{}, ErrNotFound
}

func (d *dataStore) Get(ctx context.Context, key DataKey) (io.ReadCloser, error) {
	if err := key.Validate(); err != nil {
		return nil, fmt.Errorf("invalid data key: %w", err)
	}

	return d.kv.Get(ctx, dataSection, key.String())
}

func (d *dataStore) Save(ctx context.Context, key DataKey, value io.Reader) error {
	if err := key.Validate(); err != nil {
		return fmt.Errorf("invalid data key: %w", err)
	}

	writer, err := d.kv.Save(ctx, dataSection, key.String())
	if err != nil {
		return err
	}
	_, err = io.Copy(writer, value)
	if err != nil {
		_ = writer.Close()
		return err
	}

	return writer.Close()
}

func (d *dataStore) Delete(ctx context.Context, key DataKey) error {
	if err := key.Validate(); err != nil {
		return fmt.Errorf("invalid data key: %w", err)
	}

	return d.kv.Delete(ctx, dataSection, key.String())
}

// ParseKey parses a string key into a DataKey struct
func ParseKey(key string) (DataKey, error) {
	parts := strings.Split(key, "/")
	if len(parts) != 5 {
		return DataKey{}, fmt.Errorf("invalid key: %s", key)
	}
	uidActionParts := strings.Split(parts[4], "~")
	if len(uidActionParts) != 2 {
		return DataKey{}, fmt.Errorf("invalid key: %s", key)
	}
	rv, err := strconv.ParseInt(uidActionParts[0], 10, 64)
	if err != nil {
		return DataKey{}, fmt.Errorf("invalid resource version: %s", uidActionParts[0])
	}
	return DataKey{
		Namespace:       parts[0],
		Group:           parts[1],
		Resource:        parts[2],
		Name:            parts[3],
		ResourceVersion: rv,
		Action:          DataAction(uidActionParts[1]),
	}, nil
}
