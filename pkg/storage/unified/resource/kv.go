package resource

import (
	"context"
	"errors"
	"fmt"
	"iter"
	"time"

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
	// Keys returns all the keys in the store
	Keys(ctx context.Context, section string, opt ListOptions) iter.Seq2[string, error]

	// Get retrieves keys.
	Get(ctx context.Context, section string, key string, opts ...GetOptions) (KVObject, error)

	// Save a new value
	Save(ctx context.Context, section string, key string, value []byte) error

	// Delete a value
	Delete(ctx context.Context, section string, key string) error

	// List: list all the data in the store. Maybe. Not sure yet.
	// List(ctx context.Context, section string, opt ListOptions) iter.Seq2[KVObject, error]

	// TimeUTC return the DB time in UTC.
	// This is used to ensure the server and client are not too far apart in time.
	TimeUTC(ctx context.Context) (time.Time, error)
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

func (k *badgerKV) Get(ctx context.Context, section string, key string, opts ...GetOptions) (KVObject, error) {
	txn := k.db.NewTransaction(false)
	defer txn.Discard()

	if section == "" {
		return KVObject{}, fmt.Errorf("section is required")
	}

	key = section + "/" + key

	item, err := txn.Get([]byte(key))
	if err != nil {
		if errors.Is(err, badger.ErrKeyNotFound) {
			return KVObject{}, ErrNotFound
		}
		return KVObject{}, err
	}
	out := KVObject{
		Key:   string(item.Key())[len(section)+1:],
		Value: []byte{},
	}
	item.Value(func(val []byte) error {
		out.Value = make([]byte, len(val))
		copy(out.Value, val)
		return nil
	})
	return out, nil
}

func (k *badgerKV) Save(ctx context.Context, section string, key string, value []byte) error {
	if section == "" {
		return fmt.Errorf("section is required")
	}

	txn := k.db.NewTransaction(true)
	defer txn.Discard()

	key = section + "/" + key

	err := txn.Set([]byte(key), value)
	if err != nil {
		return err
	}
	return txn.Commit()
}

func (k *badgerKV) Delete(ctx context.Context, section string, key string) error {
	if section == "" {
		return fmt.Errorf("section is required")
	}

	txn := k.db.NewTransaction(true)
	defer txn.Discard()

	key = section + "/" + key

	err := txn.Delete([]byte(key))
	if err != nil {
		return err
	}
	return txn.Commit()
}

func (k *badgerKV) Keys(ctx context.Context, section string, opt ListOptions) iter.Seq2[string, error] {
	if section == "" {
		return func(yield func(string, error) bool) {
			yield("", fmt.Errorf("section is required"))
			return
		}
	}

	txn := k.db.NewTransaction(false)
	defer txn.Discard()

	opts := badger.DefaultIteratorOptions
	opts.PrefetchValues = false
	opts.PrefetchSize = 100
	start := section + "/" + opt.StartKey
	end := section + "/" + opt.EndKey
	if opt.EndKey == "" {
		end = PrefixRangeEnd(section + "/")
	}
	if opt.Sort == SortOrderDesc {
		start, end = end, start
		opts.Reverse = true
	}
	isEnd := func(item *badger.Item) bool {
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
			if !yield(string(item.Key())[len(section)+1:], nil) {
				break
			}
			count++
		}
	}
}

func (k *badgerKV) TimeUTC(ctx context.Context) (time.Time, error) {
	return time.Now().UTC(), nil
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
