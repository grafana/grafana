package cachekvstore

// StoreKeyGetter returns the key used to store the value.
// It can be used to dynamically determine transform a key before passing it to the underlying store.
type StoreKeyGetter interface {
	GetStoreKey(k string) string
}

// StoreKeyGetterFunc is a function that implements StoreKeyGetter.
// It can be used for simple key transformations.
type StoreKeyGetterFunc func(k string) string

// GetStoreKey calls the function.
func (f StoreKeyGetterFunc) GetStoreKey(k string) string {
	return f(k)
}
