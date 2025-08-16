package sql

import (
	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/storage/unified/sql/db"
)

var _ resource.ListIterator = (*listDeltaIter)(nil)

type listDeltaIter struct {
	rows db.Rows

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
	action    int
}

// ContinueToken implements resource.ListIterator.
func (l *listDeltaIter) ContinueToken() string {
	// Do we care about pagination for this?
	return "not implemented"
}

func (l *listDeltaIter) Error() error {
	return l.err
}

func (l *listDeltaIter) Name() string {
	return l.name
}

func (l *listDeltaIter) Namespace() string {
	return l.namespace
}

func (l *listDeltaIter) Folder() string {
	return l.folder
}

// ResourceVersion implements resource.ListIterator.
func (l *listDeltaIter) ResourceVersion() int64 {
	return l.rv
}

// Value implements resource.ListIterator.
func (l *listDeltaIter) Value() []byte {
	return l.value
}

// Next implements resource.ListIterator.
func (l *listDeltaIter) Next() bool {
	if l.rows.Next() {
		l.err = l.rows.Scan(&l.guid, &l.rv, &l.namespace, &l.group, &l.resource, &l.name, &l.folder, &l.value, &l.action)

		return true
	}
	return false
}
