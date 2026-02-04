package resource

import (
	"github.com/grafana/grafana/pkg/storage/unified/resource/kv"
)

type KV = kv.KV

type SortOrder = kv.SortOrder

const (
	SortOrderAsc  = kv.SortOrderAsc
	SortOrderDesc = kv.SortOrderDesc
)

type ListOptions = kv.ListOptions
type KeyValue = kv.KeyValue
type BatchOp = kv.BatchOp

var (
	ErrNotFound    = kv.ErrNotFound
	PrefixRangeEnd = kv.PrefixRangeEnd
	NewBadgerKV    = kv.NewBadgerKV
)
