package resource

import (
	"context"
	"errors"
	"iter"

	badger "github.com/dgraph-io/badger/v4"
)

var ErrNotFound = errors.New("key not found")

type SortOrder int

const (
	SortOrderAsc SortOrder = iota
	SortOrderDesc
)

type ListOptions struct {
	Sort     SortOrder
	StartKey string
	EndKey   string
	Limit    int64
	// WithValues bool // Question: Should we always return the values? Or maybe never ?
}

type GetOptions struct{}

type KVObject struct {
	Key   string
	Value []byte
}

type KV interface {
	// List all keys in the store
	List(ctx context.Context, opt ListOptions) iter.Seq2[string, error]

	// Get retrieves keys.
	Get(ctx context.Context, key string, opts ...GetOptions) (KVObject, error)

	// Save a new value
	Save(ctx context.Context, key string, value []byte) error

	// Delete a value
	Delete(ctx context.Context, key string) error

	// Time return the DB time. This is used to ensure the server and client are not too far apart in time.
	// Are we within 5 minutes  of the server ?
	// Time(ctx context.Context) (time.Time, error)
}

// Reference implementation of the KV interface using BadgerDB
// This is only used for testing purposes, and will not work HA
type badgerKV struct {
	db *badger.DB
}

func NewBadgerKV(db *badger.DB) *badgerKV {
	return &badgerKV{
		db: db,
	}
}

func (k *badgerKV) Get(ctx context.Context, key string, opts ...GetOptions) (KVObject, error) {
	txn := k.db.NewTransaction(false)
	defer txn.Discard()

	item, err := txn.Get([]byte(key))
	if err != nil {
		if errors.Is(err, badger.ErrKeyNotFound) {
			return KVObject{}, ErrNotFound
		}
		return KVObject{}, err
	}
	out := KVObject{
		Key:   string(key),
		Value: []byte{},
	}
	item.Value(func(val []byte) error {
		out.Value = val
		return nil
	})
	return out, nil
}

func (k *badgerKV) Save(ctx context.Context, key string, value []byte) error {
	txn := k.db.NewTransaction(true)
	defer txn.Discard()

	err := txn.Set([]byte(key), value)
	if err != nil {
		return err
	}
	return txn.Commit()
}

func (k *badgerKV) Delete(ctx context.Context, key string) error {
	txn := k.db.NewTransaction(true)
	defer txn.Discard()

	err := txn.Delete([]byte(key))
	if err != nil {
		return err
	}
	return txn.Commit()
}

func (k *badgerKV) List(ctx context.Context, opt ListOptions) iter.Seq2[string, error] {
	txn := k.db.NewTransaction(false)
	defer txn.Discard()

	opts := badger.DefaultIteratorOptions
	opts.PrefetchValues = false
	opts.PrefetchSize = 100
	start := opt.StartKey
	end := opt.EndKey
	if opt.Sort == SortOrderDesc {
		start, end = end, start
		opts.Reverse = true
	}
	isEnd := func(item *badger.Item) bool {
		if end == "" {
			return false
		}
		if opt.Sort == SortOrderDesc {
			return string(item.Key()) <= end
		}
		return string(item.Key()) >= end
	}
	iter := txn.NewIterator(opts)
	defer iter.Close()
	count := int64(0)
	return func(yield func(string, error) bool) {
		for iter.Seek([]byte(start)); iter.Valid(); iter.Next() {
			item := iter.Item()

			if opt.Limit > 0 && count >= opt.Limit {
				break
			}
			if isEnd(item) {
				break
			}
			yield(string(item.Key()), nil)
			count++
		}
	}
}

// PrefixRangeEnd returns the end key for the given prefix
func PrefixRangeEnd(prefix string) string {
	key := []byte(prefix)
	end := make([]byte, len(key))
	copy(end, key)
	for i := len(end) - 1; i >= 0; i-- {
		if end[i] < 0xff {
			end[i] = end[i] + 1
			end = end[:i+1]
			return string(end)
		}
	}
	return string(end)
}
