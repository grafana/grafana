package legacyannotations

import (
	"maps"

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
// The manager has columns of its own so it stays queryable; everything else the table
// does not model goes in the blob. FromObject and ToObject move them between an API object and these fields, so a
// service never handles the split itself.
type Columns struct {
	// swagger:ignore
	Annotations map[string]string `json:"-" xorm:"annotations"`
	// swagger:ignore
	ManagerKind string `json:"-" xorm:"manager_kind"`
	// swagger:ignore
	ManagerIdentity string `json:"-" xorm:"manager_identity"`
}

// FromObject fills c from obj: the manager into its columns, everything the policy does
// not derive or drop into the blob.
func (c *Columns) FromObject(obj metav1.Object) {
	annotations := obj.GetAnnotations()
	c.Annotations = defaultPolicy.toStore(obj)
	c.ManagerKind = annotations[utils.AnnoKeyManagerKind]
	c.ManagerIdentity = annotations[utils.AnnoKeyManagerIdentity]
}

// ToObject puts c back onto obj, the manager first so the blob cannot overwrite it with
// a stale copy from a row written before the columns existed.
func (c Columns) ToObject(obj metav1.Object) {
	if manager := c.manager(); len(manager) > 0 {
		annotations := maps.Clone(obj.GetAnnotations())
		if annotations == nil {
			annotations = make(map[string]string, len(manager))
		}
		maps.Copy(annotations, manager)
		obj.SetAnnotations(annotations)
	}
	defaultPolicy.apply(obj, c.Annotations)
}

// AsAnnotations returns every annotation the row holds -- the manager and the blob --
// for a caller that wants them without an object to put them on.
func (c Columns) AsAnnotations() map[string]string {
	obj := &metav1.ObjectMeta{}
	c.ToObject(obj)
	return obj.Annotations
}

func (c Columns) manager() map[string]string {
	manager := make(map[string]string, 2)
	if c.ManagerKind != "" {
		manager[utils.AnnoKeyManagerKind] = c.ManagerKind
		if c.ManagerIdentity != "" {
			manager[utils.AnnoKeyManagerIdentity] = c.ManagerIdentity
		}
	}
	return manager
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

// FromObject fills the columns from obj, as the caller that is the source of truth for
// them: unlike Columns.FromObject, it marks them to be written as given, including
// cleared.
func (u *UpdateColumns) FromObject(obj metav1.Object) {
	u.Columns.FromObject(obj)
	u.UpdateAnnotations = true
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

// defaultPolicy: the manager lives in columns of its own and the updated timestamp
// comes from one, so none of the three are stored in the blob.
//
// The dropped keys are not optional. A kubectl-managed resource records the manifest it
// applied, and that manifest can carry raw secure values; the blob is unencrypted and
// returned on every read. Attribution is dropped because a legacy table has no trusted
// value for it, so storing what the client sent would let a read report any author.
var defaultPolicy = newPolicy(
	utils.AnnoKeyManagerKind,
	utils.AnnoKeyManagerIdentity,
	utils.AnnoKeyUpdatedTimestamp,
).dropping(
	utils.AnnoKeyKubectlLastAppliedConfig,
	utils.AnnoKeyCreatedBy,
	utils.AnnoKeyUpdatedBy,
)

// FileProvisioned returns the columns for a resource provisioned from a config file. sourceFile is both the manager
// identity and the source path: a provisioning config has no provisioner name of its
// own the way a dashboard config does.
//
// allowsEdits comes from the config, and is the whole reason a file-provisioned
// resource can be editable at all. Leaving it false is what makes Guard refuse writes.
func FileProvisioned(sourceFile string, allowsEdits bool) Columns {
	columns := Columns{
		ManagerKind:     string(utils.ManagerKindFileProvisioning),
		ManagerIdentity: sourceFile,
	}
	annotations := map[string]string{}
	if sourceFile != "" {
		annotations[utils.AnnoKeySourcePath] = sourceFile
	}
	if allowsEdits {
		annotations[utils.AnnoKeyManagerAllowsEdits] = "true"
	}
	if len(annotations) > 0 {
		columns.Annotations = annotations
	}
	return columns
}

// FileProvisionedUpdate is FileProvisioned for an update command. The file is the
// source of truth on every boot, so a provisioner is always authoritative for these
// columns: a renamed or edited config has to rewrite them rather than merge into stale
// ones. Forgetting that is why it is bundled here rather than left to the caller.
func FileProvisionedUpdate(sourceFile string, allowsEdits bool) UpdateColumns {
	return UpdateColumns{
		Columns:           FileProvisioned(sourceFile, allowsEdits),
		UpdateAnnotations: true,
	}
}
