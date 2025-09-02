package search

import (
	"bytes"
	"errors"
	"fmt"

	"github.com/blevesearch/bleve/v2/registry"
	store "github.com/blevesearch/upsidedown_store_api"
	badger "github.com/dgraph-io/badger/v4"
)

func init() {
	_ = registry.RegisterKVStore("badger", newBadgerKVStore)
}

func newBadgerKVStore(mo store.MergeOperator, config map[string]interface{}) (store.KVStore, error) {
	// Configure Badger for in-memory mode
	opts := badger.DefaultOptions("").WithInMemory(true)
	opts.Logger = nil
	db, err := badger.Open(opts)
	if err != nil {
		return nil, fmt.Errorf("failed to open badger db: %w", err)
	}

	return &badgerKVStore{
		db: db,
		mo: mo,
	}, nil
}

var _ store.KVStore = &badgerKVStore{}
var _ store.KVReader = &badgerKVReader{}
var _ store.KVWriter = &badgerKVWriter{}

// badgerKVStore implements the KVStore interface for Bleve using Badger
type badgerKVStore struct {
	db *badger.DB
	mo store.MergeOperator
}

// Close closes the Badger database
func (s *badgerKVStore) Close() error {
	return s.db.Close()
}

// Reader returns a new KVReader
func (s *badgerKVStore) Reader() (store.KVReader, error) {
	return &badgerKVReader{
		txn: s.db.NewTransaction(false),
	}, nil
}

// Writer returns a new KVWriter
func (s *badgerKVStore) Writer() (store.KVWriter, error) {
	return &badgerKVWriter{
		db: s.db,
		mo: s.mo,
	}, nil
}

// badgerKVReader implements the KVReader interface
type badgerKVReader struct {
	txn *badger.Txn
}

// Get retrieves a value for a given key
func (r *badgerKVReader) Get(key []byte) ([]byte, error) {
	var val []byte
	item, err := r.txn.Get(key)
	if errors.Is(err, badger.ErrKeyNotFound) {
		return nil, nil
	} else if err != nil {
		return nil, err
	}
	val, err = item.ValueCopy(nil)
	return val, err
}

// Close closes the reader
func (r *badgerKVReader) Close() error {
	r.txn.Discard()
	return nil
}

// MultiGet implements the MultiGet method for KVReader.
func (r *badgerKVReader) MultiGet(keys [][]byte) ([][]byte, error) {
	results := make([][]byte, len(keys))
	for i, key := range keys {
		item, err := r.txn.Get(key)
		if errors.Is(err, badger.ErrKeyNotFound) {
			results[i] = nil
			continue
		} else if err != nil {
			return nil, err
		}
		val, err := item.ValueCopy(nil)
		if err != nil {
			return nil, err
		}
		results[i] = val
	}
	return results, nil
}

// PrefixIterator implements the PrefixIterator method for KVReader.
func (r *badgerKVReader) PrefixIterator(prefix []byte) store.KVIterator {
	opts := badger.DefaultIteratorOptions
	opts.Prefix = prefix
	it := &BadgerKVIterator{
		iter:   r.txn.NewIterator(opts),
		prefix: prefix,
		start:  prefix,
		end:    []byte{prefix[0] + 1},
	}
	it.iter.Seek(prefix)
	return it
}

// RangeIterator implements the RangeIterator method for KVReader.
func (r *badgerKVReader) RangeIterator(start, end []byte) store.KVIterator {
	it := r.txn.NewIterator(badger.DefaultIteratorOptions)
	it.Seek(start)
	return &BadgerKVIterator{
		iter:  it,
		start: start,
		end:   end,
	}
}

// badgerKVWriter implements the KVWriter interface
type badgerKVWriter struct {
	db *badger.DB
	mo store.MergeOperator
}

// NewBatch returns a KVBatch for performing batch operations
func (w *badgerKVWriter) NewBatch() store.KVBatch {
	return store.NewEmulatedBatch(w.mo)
}

// NewBatchEx returns a KVBatch and an associated byte array
func (w *badgerKVWriter) NewBatchEx(opts store.KVBatchOptions) ([]byte, store.KVBatch, error) {
	return make([]byte, opts.TotalBytes), w.NewBatch(), nil
}

// Close closes the writer
func (w *badgerKVWriter) Close() error {
	// No persistent transaction to commit since we handle transactions per operation
	return nil
}

// ExecuteBatch implements the ExecuteBatch method for KVWriter.
func (w *badgerKVWriter) ExecuteBatch(b store.KVBatch) error {
	emulatedBatch, ok := b.(*store.EmulatedBatch)
	if !ok {
		return fmt.Errorf("wrong type of batch")
	}

	txn := w.db.NewTransaction(true)
	defer txn.Discard()

	for k, mergeOps := range emulatedBatch.Merger.Merges {
		kb := []byte(k)
		var existingVal []byte
		existingItem, err := txn.Get(kb)
		if errors.Is(err, badger.ErrKeyNotFound) {
			existingVal = nil
		} else if err != nil {
			return err
		} else {
			existingVal, err = existingItem.ValueCopy(nil)
			if err != nil {
				return err
			}
		}
		mergedVal, fullMergeOk := w.mo.FullMerge(kb, existingVal, mergeOps)
		if !fullMergeOk {
			return fmt.Errorf("merge operator returned failure")
		}
		err = txn.Set(kb, mergedVal)
		if err != nil {
			return err
		}
	}

	for _, op := range emulatedBatch.Ops {
		var err error
		if op.V != nil {
			err = txn.Set(op.K, op.V)
		} else {
			err = txn.Delete(op.K)
		}
		if err != nil {
			return err
		}
	}
	return txn.Commit()
}

// BadgerKVIterator implements the KVIterator interface
type BadgerKVIterator struct {
	iter   *badger.Iterator
	prefix []byte
	start  []byte
	end    []byte
}

// Next advances the iterator to the next key
func (i *BadgerKVIterator) Next() {
	i.iter.Next()
}

// Seek advances the iterator to the specified key
func (i *BadgerKVIterator) Seek(key []byte) {
	k := key
	if i.start != nil {
		// if lower than start, start at start
		if bytes.Compare(key, i.start) < 0 {
			k = i.start
		}
	}
	if i.end != nil {
		// if greater than end, end at end
		if bytes.Compare(key, i.end) > 0 {
			k = i.end
		}
	}
	i.iter.Seek(k)
}

// Key returns the current key
func (i *BadgerKVIterator) Key() []byte {
	return i.iter.Item().Key()
}

// Value returns the current value
func (i *BadgerKVIterator) Value() []byte {
	val, err := i.iter.Item().ValueCopy(nil)
	if err != nil {
		return nil
	}
	return val
}

// Valid returns whether the iterator is valid
func (i *BadgerKVIterator) Valid() bool {
	if i.prefix != nil {
		return i.iter.ValidForPrefix(i.prefix)
	}
	if !i.iter.Valid() {
		return false
	}
	if i.end != nil {
		return bytes.Compare(i.iter.Item().Key(), i.end) < 0
	}
	return true
}

// Close closes the iterator
func (i *BadgerKVIterator) Close() error {
	i.iter.Close()
	return nil
}

// Current implements the Current method for KVIterator.
func (i *BadgerKVIterator) Current() ([]byte, []byte, bool) {
	if !i.Valid() {
		return nil, nil, false
	}
	key := i.iter.Item().KeyCopy(nil)
	val, err := i.iter.Item().ValueCopy(nil)
	if err != nil {
		return nil, nil, false
	}
	return key, val, true
}
