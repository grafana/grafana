package resource

import (
	"bytes"
	"fmt"
	"strconv"
	"strings"
)

type KeyConversions interface {
	KeyToPath(k *ResourceKey, rv int64) (string, error)
	PathToKey(p string) (k *ResourceKey, rv int64, err error)
	PathPrefix(k *ResourceKey) string
}

var _ KeyConversions = &simpleConverter{}

// group/resource/namespace/name
type simpleConverter struct{}

// KeyToPath implements KeyConversions.
func (s *simpleConverter) KeyToPath(x *ResourceKey, rv int64) (string, error) {
	var buffer bytes.Buffer

	if x.Group == "" {
		return "", fmt.Errorf("missing group")
	}
	buffer.WriteString(x.Group)
	buffer.WriteString("/")

	if x.Resource == "" {
		return "", fmt.Errorf("missing resource")
	}
	buffer.WriteString(x.Resource)
	buffer.WriteString("/")

	if x.Namespace == "" {
		buffer.WriteString("__cluster__")
	} else {
		buffer.WriteString(x.Namespace)
	}

	if x.Name == "" {
		return buffer.String(), nil
	}
	buffer.WriteString("/")
	buffer.WriteString(x.Name)

	if rv > 0 {
		buffer.WriteString("/")
		buffer.WriteString(fmt.Sprintf("%.20d", rv))
	}

	return buffer.String(), nil
}

// KeyToPath implements KeyConversions.
func (s *simpleConverter) PathPrefix(x *ResourceKey) string {
	var buffer bytes.Buffer
	if x.Group == "" {
		return ""
	}
	buffer.WriteString(x.Group)

	if x.Resource == "" {
		return buffer.String()
	}
	buffer.WriteString("/")
	buffer.WriteString(x.Resource)

	if x.Namespace == "" {
		if x.Name == "" {
			return buffer.String()
		}
		buffer.WriteString("/__cluster__")
	} else {
		buffer.WriteString("/")
		buffer.WriteString(x.Namespace)
	}

	if x.Name == "" {
		return buffer.String()
	}
	buffer.WriteString("/")
	buffer.WriteString(x.Name)
	return buffer.String()
}

// PathToKey implements KeyConversions.
func (s *simpleConverter) PathToKey(p string) (k *ResourceKey, rv int64, err error) {
	key := &ResourceKey{}
	parts := strings.Split(p, "/")
	if len(parts) < 2 {
		return nil, 0, fmt.Errorf("expecting at least group/resource")
	}
	key.Group = parts[0]
	key.Resource = parts[1]
	if len(parts) > 2 {
		key.Namespace = parts[2]
	}
	if len(parts) > 3 {
		key.Name = parts[3]
	}
	if len(parts) > 4 {
		parts = strings.Split(parts[4], ".")
		rv, err = strconv.ParseInt(parts[0], 10, 64)
	}
	return key, rv, err
}
