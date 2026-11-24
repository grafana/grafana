package legacyannotations

import (
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	"github.com/grafana/grafana/pkg/apimachinery/utils"
)

// annotationColumn, managerKindColumn and managerIdentityColumn are the column names
// a table adopting this package adds. They are fixed rather than configurable: the
// migration, the xorm tags on Columns and the write rule all have to agree, and three
// places agreeing by convention is how they stop agreeing.
const (
	annotationColumn      = "annotations"
	managerKindColumn     = "manager_kind"
	managerIdentityColumn = "manager_identity"
)

// Columns is the storage side of this package, embedded in a legacy SQL row and in
// the command that creates one:
//
//	type DataSource struct {
//		// ...
//		legacyannotations.Columns `xorm:"extends"`
//	}
//
// The manager has columns of its own so that "everything this manager owns" is
// answerable in SQL; everything else the table does not model goes in the blob. A
// Policy decides which annotations are which, and the two helpers below move them
// between an API object and these fields so a service never handles the split itself.
type Columns struct {
	// swagger:ignore
	Annotations map[string]string `json:"-" xorm:"annotations"`
	// swagger:ignore
	ManagerKind string `json:"-" xorm:"manager_kind"`
	// swagger:ignore
	ManagerIdentity string `json:"-" xorm:"manager_identity"`
}

// Read fills c from obj: the manager into its columns, everything the policy does not
// derive or drop into the blob.
func (c *Columns) Read(p Policy, obj metav1.Object) {
	annotations := obj.GetAnnotations()
	c.Annotations = p.ToStore(obj)
	c.ManagerKind = annotations[utils.AnnoKeyManagerKind]
	c.ManagerIdentity = annotations[utils.AnnoKeyManagerIdentity]
}

// Write puts c back onto obj, the manager first so Policy.Apply cannot overwrite it
// with a stale copy from a row written before the columns existed.
func (c Columns) Write(p Policy, obj metav1.Object) {
	if c.ManagerKind != "" {
		annotations := obj.GetAnnotations()
		if annotations == nil {
			annotations = make(map[string]string, 2)
		}
		annotations[utils.AnnoKeyManagerKind] = c.ManagerKind
		if c.ManagerIdentity != "" {
			annotations[utils.AnnoKeyManagerIdentity] = c.ManagerIdentity
		}
		obj.SetAnnotations(annotations)
	}
	p.Apply(obj, c.Annotations)
}

// UpdateColumns is embedded in the command that updates a row, adding the one thing a
// create does not need: whether the caller is authoritative for these columns.
type UpdateColumns struct {
	Columns `xorm:"extends"`

	// UpdateAnnotations marks the caller as the source of truth for the columns above:
	// they are written as given, including cleared. A caller that leaves it false keeps
	// whatever is stored, so a writer that knows nothing about annotations -- a legacy
	// HTTP API, a targeted column update -- cannot release a provisioned resource by
	// omission.
	//
	// swagger:ignore
	UpdateAnnotations bool `json:"-" xorm:"-"`
}

// ColumnsToWrite returns the columns xorm must write even when their Go values are
// zero, which is how an authoritative caller clears them. Spread it into MustCols:
//
//	sess.MustCols(cmd.ColumnsToWrite()...)
//
// It returns nothing for a non-authoritative caller, where MustCols is then a no-op
// and xorm's zero-value skip leaves the stored columns alone. Relying on that skip is
// the whole mechanism, and is_prunable shows the cost of getting it wrong: it is
// UseBool'd and never set by pkg/api/datasources.go, so every legacy data source edit
// silently zeroes it.
func (u UpdateColumns) ColumnsToWrite() []string {
	if !u.UpdateAnnotations {
		return nil
	}
	return []string{annotationColumn, managerKindColumn, managerIdentityColumn}
}
