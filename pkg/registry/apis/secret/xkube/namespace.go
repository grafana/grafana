package xkube

// Namespace is a newtype of string that improves type safety.
type Namespace string

func (n Namespace) String() string {
	return string(n)
}
