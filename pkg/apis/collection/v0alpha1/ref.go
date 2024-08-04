package v0alpha1

import (
	"errors"
	"strings"
)

type ResourceRef struct {
	// The referenced resource API Group
	Group string `json:"group,omitempty"`
	// The referenced resource type
	Resource string `json:"resource,omitempty"`
	// When not specified on a non-cluster scope resource type,
	// the namespace will default to the same as the reference object
	Namespace string `json:"namespace,omitempty"`
	// The resource identifier
	Name string `json:"name,omitempty"`
}

func (r *ResourceRef) Valid() bool {
	return r.Group != "" && r.Resource != ""
}

func (r *ResourceRef) String() string {
	if !r.Valid() {
		return ""
	}

	var buf strings.Builder
	buf.WriteString(r.Group)
	buf.WriteByte('/')
	buf.WriteString(r.Resource)
	if r.Namespace != "" {
		buf.WriteString("/namespaces/")
		buf.WriteString(r.Namespace)
	}
	if r.Name != "" {
		buf.WriteByte('/')
		buf.WriteString(r.Name)
	}
	return buf.String()
}

// // MarshalJSON serializes the given reference into its JSON representation.
// func (r ResourceRef) MarshalJSON() ([]byte, error) {
// 	return json.Marshal(r.String())
// }

// // UnmarshalJSON reads a reference from its JSON representation.
// func (r *ResourceRef) UnmarshalJSON(b []byte) error {
// 	if len(b) == 0 {
// 		*r = ResourceRef{}
// 		return nil
// 	}
// 	v, err := ParseResourceRef(string(b))
// 	if err == nil {
// 		*r = v
// 	}
// 	return err
// }

var (
	ErrInvalidResourceRef = errors.New("expecting <group>(/namespaces/<namespace>)/<resource>/<name>")
)

func ParseResourceRef(str string) (ResourceRef, error) {
	ref := ResourceRef{}
	parts := strings.Split(str, "/")
	if len(parts) < 2 {
		return ref, ErrInvalidResourceRef
	}
	namespaced := parts[1] == "namespaces"

	for i, part := range parts {
		switch i {
		case 0:
			ref.Group = part
		case 1:
			if !namespaced {
				ref.Resource = part
			}
		case 2:
			if namespaced {
				ref.Namespace = part
			} else {
				ref.Name = part
			}
		case 3:
			if namespaced {
				ref.Resource = part
			} else {
				return ref, ErrInvalidResourceRef
			}
		case 4:
			if namespaced {
				ref.Name = part
			} else {
				return ref, ErrInvalidResourceRef
			}
		default:
			return ref, ErrInvalidResourceRef
		}
	}
	return ref, nil
}
