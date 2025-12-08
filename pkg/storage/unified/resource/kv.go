package resource

import (
	"bytes"
	"context"
	"errors"
	"fmt"
	"io"
	"iter"
	"regexp"
	"time"

	badger "github.com/dgraph-io/badger/v4"
)

var ErrNotFound = errors.New("key not found")

// KeyValue represents a key-value pair returned by BatchGet
type KeyValue struct {
	Key   string
	Value io.ReadCloser
}

type SortOrder int

const (
	SortOrderAsc SortOrder = iota
	SortOrderDesc
)

type ListOptions struct {
	Sort     SortOrder // sort order of the results. Default is SortOrderAsc.
	StartKey string    // lower bound of the range, included in the results
	EndKey   string    // upper bound of the range, excluded from the results
	Limit    int64     // maximum number of results to return. 0 means no limit.
}

// CompareTarget specifies what to compare in a transaction
type CompareTarget int

const (
	CompareExists CompareTarget = iota // Check if key exists (Value: bool)
	CompareValue                       // Compare actual value (Value: []byte)
)

// CompareResult specifies the comparison operator
type CompareResult int

const (
	CompareEqual CompareResult = iota
	CompareNotEqual
	CompareGreater
	CompareLess
)

// Compare represents a single comparison in a transaction.
// Use the constructor functions CompareKeyExists, CompareKeyNotExists, and CompareKeyValue to create comparisons.
type Compare struct {
	Key    string
	Target CompareTarget
	Result CompareResult // Only used for CompareValue
	Exists bool          // Used when Target == CompareExists
	Value  []byte        // Used when Target == CompareValue
}

// CompareKeyExists creates a comparison that succeeds if the key exists.
func CompareKeyExists(key string) Compare {
	return Compare{Key: key, Target: CompareExists, Exists: true}
}

// CompareKeyNotExists creates a comparison that succeeds if the key does not exist.
func CompareKeyNotExists(key string) Compare {
	return Compare{Key: key, Target: CompareExists, Exists: false}
}

// CompareKeyValue creates a comparison that compares the value of a key.
// The comparison succeeds if the stored value matches the expected value according to the result operator.
func CompareKeyValue(key string, result CompareResult, value []byte) Compare {
	return Compare{Key: key, Target: CompareValue, Result: result, Value: value}
}

// TxnOpType specifies the type of operation in a transaction
type TxnOpType int

const (
	TxnOpPut TxnOpType = iota
	TxnOpDelete
	TxnOpTxn // Nested transaction
)

// TxnOp represents an operation in a transaction.
// Use the constructor functions TxnPut, TxnDelete, and TxnNested to create operations.
type TxnOp struct {
	Type  TxnOpType
	Key   string
	Value []byte // For Put operations

	// For nested transactions (Type == TxnOpTxn)
	Compares   []Compare
	SuccessOps []TxnOp
	FailureOps []TxnOp
}

// TxnPut creates a Put operation that stores a value at the given key.
func TxnPut(key string, value []byte) TxnOp {
	return TxnOp{Type: TxnOpPut, Key: key, Value: value}
}

// TxnDelete creates a Delete operation that removes the given key.
func TxnDelete(key string) TxnOp {
	return TxnOp{Type: TxnOpDelete, Key: key}
}

// TxnNested creates a nested transaction operation.
func TxnNested(compares []Compare, successOps []TxnOp, failureOps []TxnOp) TxnOp {
	return TxnOp{
		Type:       TxnOpTxn,
		Compares:   compares,
		SuccessOps: successOps,
		FailureOps: failureOps,
	}
}

// TxnResponse contains the result of a transaction
type TxnResponse struct {
	// Succeeded indicates whether the comparisons passed (true) or failed (false)
	Succeeded bool
}

// Maximum limits for transaction operations
const (
	MaxTxnCompares  = 8
	MaxTxnOps       = 8
	MaxTxnTotalSize = 1 * 1024 * 1024 // 1MB total payload
	MaxTxnDepth     = 3               // Maximum nesting depth for transactions
)

// ValidateTxnRequest validates the transaction request parameters.
func ValidateTxnRequest(section string, cmps []Compare, successOps []TxnOp, failureOps []TxnOp) error {
	// First validate structure
	if err := validateTxnRequestWithDepth(section, cmps, successOps, failureOps, 1); err != nil {
		return err
	}

	// Then check total payload size
	totalSize := calculateTxnTotalSize(cmps, successOps, failureOps)
	if totalSize > MaxTxnTotalSize {
		return fmt.Errorf("total transaction payload too large: %d > %d", totalSize, MaxTxnTotalSize)
	}

	return nil
}

// calculateTxnTotalSize calculates the total size of all values in the transaction.
func calculateTxnTotalSize(cmps []Compare, successOps []TxnOp, failureOps []TxnOp) int {
	total := 0

	for _, cmp := range cmps {
		total += len(cmp.Value)
	}

	total += calculateOpsTotalSize(successOps)
	total += calculateOpsTotalSize(failureOps)

	return total
}

// calculateOpsTotalSize calculates the total size of values in operations, including nested transactions.
func calculateOpsTotalSize(ops []TxnOp) int {
	total := 0
	for _, op := range ops {
		total += len(op.Value)
		if op.Type == TxnOpTxn {
			total += calculateTxnTotalSize(op.Compares, op.SuccessOps, op.FailureOps)
		}
	}
	return total
}

// validateTxnRequestWithDepth validates the transaction request with depth tracking.
func validateTxnRequestWithDepth(section string, cmps []Compare, successOps []TxnOp, failureOps []TxnOp, depth int) error {
	if depth > MaxTxnDepth {
		return fmt.Errorf("transaction nesting too deep: %d > %d", depth, MaxTxnDepth)
	}

	if section == "" {
		return fmt.Errorf("section is required")
	}

	if len(cmps) > MaxTxnCompares {
		return fmt.Errorf("too many comparisons: %d > %d", len(cmps), MaxTxnCompares)
	}

	if len(successOps) > MaxTxnOps {
		return fmt.Errorf("too many success operations: %d > %d", len(successOps), MaxTxnOps)
	}

	if len(failureOps) > MaxTxnOps {
		return fmt.Errorf("too many failure operations: %d > %d", len(failureOps), MaxTxnOps)
	}

	if err := validateOpsWithDepth(successOps, "success", section, depth); err != nil {
		return err
	}

	if err := validateOpsWithDepth(failureOps, "failure", section, depth); err != nil {
		return err
	}

	return nil
}

// validateOpsWithDepth validates operations including nested transactions.
func validateOpsWithDepth(ops []TxnOp, opType string, section string, depth int) error {
	for i, op := range ops {
		if op.Type == TxnOpTxn {
			if err := validateTxnRequestWithDepth(section, op.Compares, op.SuccessOps, op.FailureOps, depth+1); err != nil {
				return fmt.Errorf("%s operation %d nested txn: %w", opType, i, err)
			}
		}
	}
	return nil
}

type KV interface {
	// Keys returns all the keys in the store
	Keys(ctx context.Context, section string, opt ListOptions) iter.Seq2[string, error]

	// Get retrieves the value for a key from the store
	Get(ctx context.Context, section string, key string) (io.ReadCloser, error)

	// BatchGet retrieves multiple values for the given keys from the store.
	// Non-existent entries will not appear in the result.
	// The order of the keys is retained in the result.
	BatchGet(ctx context.Context, section string, keys []string) iter.Seq2[KeyValue, error]

	// Save a new value - returns a WriteCloser to write the value to
	Save(ctx context.Context, section string, key string) (io.WriteCloser, error)

	// Delete a value
	Delete(ctx context.Context, section string, key string) error

	// BatchDelete removes multiple keys from the store.
	// Non-existent keys will be skipped silently without error.
	BatchDelete(ctx context.Context, section string, keys []string) error

	// UnixTimestamp returns the current time in seconds since Epoch.
	// This is used to ensure the server and client are not too far apart in time.
	UnixTimestamp(ctx context.Context) (int64, error)

	// Txn executes a transaction with compare-and-swap semantics.
	// If all comparisons succeed, successOps are executed; otherwise failureOps are executed.
	// Limited to MaxTxnCompares comparisons and MaxTxnOps operations each for success/failure.
	Txn(ctx context.Context, section string, cmps []Compare, successOps []TxnOp, failureOps []TxnOp) (*TxnResponse, error)
}

var _ KV = &badgerKV{}

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

func (k *badgerKV) Get(ctx context.Context, section string, key string) (io.ReadCloser, error) {
	if k.db.IsClosed() {
		return nil, fmt.Errorf("database is closed")
	}

	txn := k.db.NewTransaction(false)
	defer txn.Discard()

	if section == "" {
		return nil, fmt.Errorf("section is required")
	}

	key = section + "/" + key

	item, err := txn.Get([]byte(key))
	if err != nil {
		if errors.Is(err, badger.ErrKeyNotFound) {
			return nil, ErrNotFound
		}
		return nil, err
	}

	// Get the value and create a reader from it
	value, err := item.ValueCopy(nil)
	if err != nil {
		return nil, err
	}

	return io.NopCloser(bytes.NewReader(value)), nil
}

func (k *badgerKV) BatchGet(ctx context.Context, section string, keys []string) iter.Seq2[KeyValue, error] {
	if k.db.IsClosed() {
		return func(yield func(KeyValue, error) bool) {
			yield(KeyValue{}, fmt.Errorf("database is closed"))
		}
	}

	if section == "" {
		return func(yield func(KeyValue, error) bool) {
			yield(KeyValue{}, fmt.Errorf("section is required"))
		}
	}

	return func(yield func(KeyValue, error) bool) {
		txn := k.db.NewTransaction(false)
		defer txn.Discard()

		for _, key := range keys {
			keyWithSection := section + "/" + key

			item, err := txn.Get([]byte(keyWithSection))
			if err != nil {
				if errors.Is(err, badger.ErrKeyNotFound) {
					// Skip non-existent keys as per the requirement
					continue
				}
				// For other errors, yield the error and stop
				yield(KeyValue{}, err)
				return
			}

			// Get the value and create a reader from it
			value, err := item.ValueCopy(nil)
			if err != nil {
				yield(KeyValue{}, err)
				return
			}

			kv := KeyValue{
				Key:   key,
				Value: io.NopCloser(bytes.NewReader(value)),
			}

			if !yield(kv, nil) {
				return
			}
		}
	}
}

// badgerWriteCloser implements io.WriteCloser for badgerKV
type badgerWriteCloser struct {
	db             *badger.DB
	keyWithSection string
	buf            *bytes.Buffer
	closed         bool
}

// Write implements io.Writer
func (w *badgerWriteCloser) Write(p []byte) (int, error) {
	if w.closed {
		return 0, fmt.Errorf("write to closed writer")
	}
	return w.buf.Write(p)
}

// Close implements io.Closer - stores the buffered data in BadgerDB
func (w *badgerWriteCloser) Close() error {
	if w.closed {
		return nil
	}
	w.closed = true

	if w.db.IsClosed() {
		return fmt.Errorf("database is closed")
	}

	data := w.buf.Bytes()

	txn := w.db.NewTransaction(true)
	defer txn.Discard()

	err := txn.Set([]byte(w.keyWithSection), data)
	if err != nil {
		return err
	}
	return txn.Commit()
}

func (k *badgerKV) Save(ctx context.Context, section string, key string) (io.WriteCloser, error) {
	if k.db.IsClosed() {
		return nil, fmt.Errorf("database is closed")
	}

	if section == "" {
		return nil, fmt.Errorf("section is required")
	}

	if key == "" {
		return nil, fmt.Errorf("key is required")
	}

	return &badgerWriteCloser{
		db:             k.db,
		keyWithSection: section + "/" + key,
		buf:            &bytes.Buffer{},
		closed:         false,
	}, nil
}

func (k *badgerKV) Delete(ctx context.Context, section string, key string) error {
	if k.db.IsClosed() {
		return fmt.Errorf("database is closed")
	}

	if section == "" {
		return fmt.Errorf("section is required")
	}

	txn := k.db.NewTransaction(true)
	defer txn.Discard()

	key = section + "/" + key

	// Check if key exists before deleting
	_, err := txn.Get([]byte(key))
	if err != nil {
		if errors.Is(err, badger.ErrKeyNotFound) {
			return ErrNotFound
		}
		return err
	}

	err = txn.Delete([]byte(key))
	if err != nil {
		return err
	}
	return txn.Commit()
}

func (k *badgerKV) Keys(ctx context.Context, section string, opt ListOptions) iter.Seq2[string, error] {
	if k.db.IsClosed() {
		return func(yield func(string, error) bool) {
			yield("", fmt.Errorf("database is closed"))
		}
	}
	if section == "" {
		return func(yield func(string, error) bool) {
			yield("", fmt.Errorf("section is required"))
		}
	}

	opts := badger.DefaultIteratorOptions
	opts.PrefetchValues = false

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

	count := int64(0)

	return func(yield func(string, error) bool) {
		txn := k.db.NewTransaction(false)
		iter := txn.NewIterator(opts)
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

var (
	// validKeyRegex validates keys used in the unified storage
	// Keys can contain alphanumeric characters (both upper and lowercase), '-', '.', '/', and '~'
	// Any combination of these characters is allowed as long as the key is not empty
	validKeyRegex = regexp.MustCompile(`^[a-zA-Z0-9./~_-]+$`)
)

func IsValidKey(key string) bool {
	if key == "" {
		return false
	}
	return validKeyRegex.MatchString(key)
}

func (k *badgerKV) BatchDelete(ctx context.Context, section string, keys []string) error {
	if k.db.IsClosed() {
		return fmt.Errorf("database is closed")
	}

	if section == "" {
		return fmt.Errorf("section is required")
	}

	txn := k.db.NewTransaction(true)
	defer txn.Discard()

	for _, key := range keys {
		keyWithSection := section + "/" + key

		// Delete the key (BadgerDB's Delete is idempotent - succeeds even if key doesn't exist)
		err := txn.Delete([]byte(keyWithSection))
		if err != nil {
			return err
		}
	}

	return txn.Commit()
}

func (k *badgerKV) Txn(ctx context.Context, section string, cmps []Compare, successOps []TxnOp, failureOps []TxnOp) (*TxnResponse, error) {
	if k.db.IsClosed() {
		return nil, fmt.Errorf("database is closed")
	}

	if err := ValidateTxnRequest(section, cmps, successOps, failureOps); err != nil {
		return nil, err
	}

	txn := k.db.NewTransaction(true)
	defer txn.Discard()

	// Execute the transaction (potentially with nested transactions)
	succeeded, err := k.executeTxnOps(txn, section, cmps, successOps, failureOps)
	if err != nil {
		return nil, err
	}

	if err := txn.Commit(); err != nil {
		return nil, err
	}

	return &TxnResponse{Succeeded: succeeded}, nil
}

// executeTxnOps evaluates comparisons and executes operations, supporting nested transactions.
// Returns whether the comparisons succeeded and any error encountered.
func (k *badgerKV) executeTxnOps(txn *badger.Txn, section string, cmps []Compare, successOps []TxnOp, failureOps []TxnOp) (bool, error) {
	// Evaluate all comparisons
	succeeded := true
	for _, cmp := range cmps {
		keyWithSection := section + "/" + cmp.Key
		item, err := txn.Get([]byte(keyWithSection))
		keyExists := err == nil
		if err != nil && !errors.Is(err, badger.ErrKeyNotFound) {
			return false, err
		}

		switch cmp.Target {
		case CompareExists:
			if keyExists != cmp.Exists {
				succeeded = false
			}

		case CompareValue:
			if !keyExists {
				// Key doesn't exist, comparison fails unless comparing for not-equal
				if cmp.Result != CompareNotEqual {
					succeeded = false
				}
			} else {
				itemValue, err := item.ValueCopy(nil)
				if err != nil {
					return false, err
				}
				if !compareBytes(itemValue, cmp.Value, cmp.Result) {
					succeeded = false
				}
			}

		default:
			return false, fmt.Errorf("unknown compare target: %d", cmp.Target)
		}

		if !succeeded {
			break
		}
	}

	// Execute the appropriate operations
	ops := successOps
	if !succeeded {
		ops = failureOps
	}

	for _, op := range ops {
		switch op.Type {
		case TxnOpPut:
			keyWithSection := section + "/" + op.Key
			if err := txn.Set([]byte(keyWithSection), op.Value); err != nil {
				return false, err
			}
		case TxnOpDelete:
			keyWithSection := section + "/" + op.Key
			if err := txn.Delete([]byte(keyWithSection)); err != nil {
				return false, err
			}
		case TxnOpTxn:
			// Execute nested transaction
			_, err := k.executeTxnOps(txn, section, op.Compares, op.SuccessOps, op.FailureOps)
			if err != nil {
				return false, err
			}
			// Note: nested transaction's succeeded status doesn't affect parent's succeeded status
		default:
			return false, fmt.Errorf("unknown operation type: %d", op.Type)
		}
	}

	return succeeded, nil
}

// compareBytes compares two byte slices based on the comparison result type
func compareBytes(a, b []byte, result CompareResult) bool {
	cmp := bytes.Compare(a, b)
	switch result {
	case CompareEqual:
		return cmp == 0
	case CompareNotEqual:
		return cmp != 0
	case CompareGreater:
		return cmp > 0
	case CompareLess:
		return cmp < 0
	default:
		return false
	}
}
