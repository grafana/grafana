package sql

import (
	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/storage/unified/sql/db"
)

var _ resource.ListIterator = (*listIter)(nil)

type listIter struct {
	rows         db.Rows
	offset       int64
	listRV       int64
	sortAsc      bool
	useCurrentRV bool

	// any error
	err error

	// The row
	guid      string
	rv        int64
	value     []byte
	namespace string
	resource  string
	group     string
	name      string
	folder    string
}

// ContinueToken implements resource.ListIterator.
func (l *listIter) ContinueToken() string {
	if l.useCurrentRV {
		return resource.ContinueToken{ResourceVersion: l.rv, StartOffset: l.offset, SortAscending: l.sortAsc}.String()
	}
	return resource.ContinueToken{ResourceVersion: l.listRV, StartOffset: l.offset, SortAscending: l.sortAsc}.String()
}

func (l *listIter) Error() error {
	return l.err
}

func (l *listIter) Name() string {
	return l.name
}

func (l *listIter) Namespace() string {
	return l.namespace
}

func (l *listIter) Folder() string {
	return l.folder
}

// ResourceVersion implements resource.ListIterator.
func (l *listIter) ResourceVersion() int64 {
	return l.rv
}

// Value implements resource.ListIterator.
func (l *listIter) Value() []byte {
	return l.value
}

// Next implements resource.ListIterator.
func (l *listIter) Next() bool {
	if l.rows.Next() {
		l.offset++
		l.err = l.rows.Scan(&l.guid, &l.rv, &l.namespace, &l.group, &l.resource, &l.name, &l.folder, &l.value)
		return true
	}
	return false
}
