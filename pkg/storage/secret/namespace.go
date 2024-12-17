package secret

// Namespace is a newtype of string that improves type safety.
type Namespace string

func (n Namespace) String() string {
	return string(n)
}

// NamespacedName is a tuple of name and namespace, often used by K8s resources for uniqueness.
type NamespacedName struct {
	Name      string
	Namespace Namespace
}
