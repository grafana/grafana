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
	Sort     SortOrder // sort order of the results. Default is SortOrderAsc.
	StartKey string    // lower bound of the range, included in the results
	EndKey   string    // upper bound of the range, excluded from the results
	Limit    int64     // maximum number of results to return
}

type KVObject struct {
	Key   string
	Value []byte
}

type KV interface {
	// Keys returns all the keys in the store
	Keys(ctx context.Context, section string, opt ListOptions) iter.Seq2[string, error]

	// Get retrieves a key-value pair from the store
	Get(ctx context.Context, section string, key string) (KVObject, error)

	// List returns all the key-value pairs in the store
	List(ctx context.Context, section string, opt ListOptions) iter.Seq2[KVObject, error]

	// Save a new value
	Save(ctx context.Context, section string, key string, value []byte) error

	// Delete a value
	Delete(ctx context.Context, section string, key string) error

	// UnixTimestamp returns the current time in seconds since Epoch.
	// This is used to ensure the server and client are not too far apart in time.
	UnixTimestamp(ctx context.Context) (int64, error)
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

func (k *badgerKV) Get(ctx context.Context, section string, key string) (KVObject, error) {
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
	err = item.Value(func(val []byte) error {
		out.Value = make([]byte, len(val))
		copy(out.Value, val)
		return nil
	})
	if err != nil {
		return KVObject{}, err
	}
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
		}
	}

	txn := k.db.NewTransaction(false)

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
	count := int64(0)

	return func(yield func(string, error) bool) {
		defer txn.Discard()
		defer iter.Close()

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

func (k *badgerKV) List(ctx context.Context, section string, opt ListOptions) iter.Seq2[KVObject, error] {
	if section == "" {
		return func(yield func(KVObject, error) bool) {
			yield(KVObject{}, fmt.Errorf("section is required"))
		}
	}

	txn := k.db.NewTransaction(false)

	opts := badger.DefaultIteratorOptions
	opts.PrefetchValues = true
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
	count := int64(0)

	return func(yield func(KVObject, error) bool) {
		defer txn.Discard()
		defer iter.Close()

		for iter.Seek([]byte(start)); iter.Valid(); iter.Next() {
			item := iter.Item()
			if opt.Limit > 0 && count >= opt.Limit {
				break
			}
			if isEnd(item) {
				break
			}

			obj := KVObject{
				Key:   string(item.Key())[len(section)+1:],
				Value: []byte{},
			}

			err := item.Value(func(val []byte) error {
				obj.Value = make([]byte, len(val))
				copy(obj.Value, val)
				return nil
			})

			if err != nil {
				if !yield(KVObject{}, err) {
					break
				}
				continue
			}

			if !yield(obj, nil) {
				break
			}
			count++
		}
	}
}

func (k *badgerKV) UnixTimestamp(ctx context.Context) (int64, error) {
	return time.Now().Unix(), nil
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
