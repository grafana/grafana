package kv

import (
	"fmt"
	"strconv"
	"strings"
)

// TODO move everything in this file into datastore.go once backwards compatibility with sql/backend is not necessary
// anymore

type DataAction string

const (
	DataActionCreated DataAction = "created"
	DataActionUpdated DataAction = "updated"
	DataActionDeleted DataAction = "deleted"
)

// LegacyActionValue maps the datastore action to the temporary integer encoding
// still used by sql/backend compatibility columns.
// Remove once sqlkv no longer needs to mirror those legacy columns.
func LegacyActionValue(action DataAction) (int64, error) {
	switch action {
	case DataActionCreated:
		return 1, nil
	case DataActionUpdated:
		return 2, nil
	case DataActionDeleted:
		return 3, nil
	default:
		return 0, fmt.Errorf("unknown data action: %q", action)
	}
}

type DataKey struct {
	Namespace       string
	Group           string
	Resource        string
	Name            string
	ResourceVersion int64
	Action          DataAction
	Folder          string

	// needed to maintain backwards compatibility with unified/sql
	GUID string
}

// EncodeKeyName escapes characters in a resource name that aren't safe in a KV
// key. Grafana resource names allow ':' (e.g. user-storage names of the form
// "service:user-uid"), but the unified storage KV layer's validKeyRegex does
// not — so any unsafe byte is rewritten to "~XX" (lowercase hex). '~' itself
// is encoded so escapes stay unambiguous.
func EncodeKeyName(name string) string {
	if !needsKeyNameEncoding(name) {
		return name
	}
	var sb strings.Builder
	sb.Grow(len(name) + 8)
	for i := 0; i < len(name); i++ {
		c := name[i]
		if isKeyNameSafe(c) {
			sb.WriteByte(c)
			continue
		}
		sb.WriteByte('~')
		sb.WriteByte(hexLower[c>>4])
		sb.WriteByte(hexLower[c&0x0f])
	}
	return sb.String()
}

// DecodeKeyName reverses EncodeKeyName. It returns an error on truncated or
// non-hex escapes so a malformed on-disk key surfaces loudly instead of
// silently producing the wrong Name.
func DecodeKeyName(name string) (string, error) {
	if !strings.ContainsRune(name, '~') {
		return name, nil
	}
	var sb strings.Builder
	sb.Grow(len(name))
	for i := 0; i < len(name); i++ {
		c := name[i]
		if c != '~' {
			sb.WriteByte(c)
			continue
		}
		if i+2 >= len(name) {
			return "", fmt.Errorf("invalid key name escape: truncated '~' at end of %q", name)
		}
		hi, hiOk := unhex(name[i+1])
		lo, loOk := unhex(name[i+2])
		if !hiOk || !loOk {
			return "", fmt.Errorf("invalid key name escape: '~%s' in %q is not two hex digits", name[i+1:i+3], name)
		}
		sb.WriteByte(hi<<4 | lo)
		i += 2
	}
	return sb.String(), nil
}

const hexLower = "0123456789abcdef"

func unhex(c byte) (byte, bool) {
	switch {
	case c >= '0' && c <= '9':
		return c - '0', true
	case c >= 'a' && c <= 'f':
		return c - 'a' + 10, true
	case c >= 'A' && c <= 'F':
		return c - 'A' + 10, true
	}
	return 0, false
}

// isKeyNameSafe reports whether b can appear in a Name segment of a KV key
// without encoding. The set is the intersection of the grafana resource name
// regex and the KV validKeyRegex, minus '~' (the escape marker).
func isKeyNameSafe(b byte) bool {
	switch {
	case b >= 'a' && b <= 'z':
		return true
	case b >= 'A' && b <= 'Z':
		return true
	case b >= '0' && b <= '9':
		return true
	case b == '.' || b == '_' || b == '-':
		return true
	}
	return false
}

func needsKeyNameEncoding(s string) bool {
	for i := 0; i < len(s); i++ {
		if !isKeyNameSafe(s[i]) {
			return true
		}
	}
	return false
}

// ParseDataKeyParts parses the common parts of a data key.
// Keys are either 4 parts (cluster-scoped: group/resource/name/rvMeta)
// or 5 parts (namespaced: group/resource/namespace/name/rvMeta).
func ParseDataKeyParts(parts []string) (DataKey, []string, error) {
	var dk DataKey
	var rvMeta string
	var rawName string
	switch len(parts) {
	case 4: // cluster-scoped: group/resource/name/rvMeta
		dk.Group = parts[0]
		dk.Resource = parts[1]
		rawName = parts[2]
		rvMeta = parts[3]
	case 5: // namespaced: group/resource/namespace/name/rvMeta
		dk.Group = parts[0]
		dk.Resource = parts[1]
		dk.Namespace = parts[2]
		rawName = parts[3]
		rvMeta = parts[4]
	default:
		return DataKey{}, nil, fmt.Errorf("invalid key: expected 4 or 5 parts, got %d", len(parts))
	}
	name, err := DecodeKeyName(rawName)
	if err != nil {
		return DataKey{}, nil, err
	}
	dk.Name = name
	rvParts := strings.Split(rvMeta, "~")
	if len(rvParts) < 3 {
		return DataKey{}, nil, fmt.Errorf("invalid resource version metadata: expected at least 3 parts, got %d", len(rvParts))
	}
	rv, err := strconv.ParseInt(rvParts[0], 10, 64)
	if err != nil {
		return DataKey{}, nil, fmt.Errorf("invalid resource version '%s': %w", rvParts[0], err)
	}
	dk.ResourceVersion = rv
	dk.Action = DataAction(rvParts[1])
	dk.Folder = rvParts[2]
	return dk, rvParts, nil
}

// Temporary while we need to support unified/sql/backend compatibility.
// Remove once we stop using RvManager in storage_backend.go
func ParseKeyWithGUID(key string) (DataKey, error) {
	parts := strings.Split(key, "/")
	dk, rvParts, err := ParseDataKeyParts(parts)
	if err != nil {
		return DataKey{}, fmt.Errorf("invalid key: %s: %w", key, err)
	}
	if len(rvParts) != 4 {
		return DataKey{}, fmt.Errorf("invalid key metadata: expected %d tilde-separated parts, got %d", 4, len(rvParts))
	}
	dk.GUID = rvParts[3]
	return dk, nil
}

func (k DataKey) String() string {
	name := EncodeKeyName(k.Name)
	if k.Namespace == "" {
		return fmt.Sprintf("%s/%s/%s/%d~%s~%s", k.Group, k.Resource, name, k.ResourceVersion, k.Action, k.Folder)
	}
	return fmt.Sprintf("%s/%s/%s/%s/%d~%s~%s", k.Group, k.Resource, k.Namespace, name, k.ResourceVersion, k.Action, k.Folder)
}

// Temporary while we need to support unified/sql/backend compatibility
// Remove once we stop using RvManager in storage_backend.go
func (k DataKey) StringWithGUID() string {
	name := EncodeKeyName(k.Name)
	if k.Namespace == "" {
		return fmt.Sprintf("%s/%s/%s/%d~%s~%s~%s", k.Group, k.Resource, name, k.ResourceVersion, k.Action, k.Folder, k.GUID)
	}
	return fmt.Sprintf("%s/%s/%s/%s/%d~%s~%s~%s", k.Group, k.Resource, k.Namespace, name, k.ResourceVersion, k.Action, k.Folder, k.GUID)
}

func (k DataKey) Equals(other DataKey) bool {
	return k.Group == other.Group && k.Resource == other.Resource && k.Namespace == other.Namespace && k.Name == other.Name && k.ResourceVersion == other.ResourceVersion && k.Action == other.Action && k.Folder == other.Folder
}

// SameResource checks if this key represents the same resource as another key.
// It compares the identifying fields: Group, Resource, Namespace, and Name.
// ResourceVersion, Action, and Folder are ignored as they don't identify the resource itself.
func (k DataKey) SameResource(other DataKey) bool {
	return k.Group == other.Group &&
		k.Resource == other.Resource &&
		k.Namespace == other.Namespace &&
		k.Name == other.Name
}
