package xkube

// Namespace is a newtype of string that improves type safety.
type Namespace string

func (n Namespace) String() string {
	return string(n)
}

// NameNamespace is a tuple of name and namespace, often used by K8s resources for uniqueness.
type NameNamespace struct {
	Name      string
	Namespace Namespace
}
