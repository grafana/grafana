package load

import (
	"errors"
	"fmt"

	"cuelang.org/go/cue"
	"cuelang.org/go/cue/load"
	"github.com/grafana/grafana/pkg/schema"
)

var panelSubpath = cue.MakePath(cue.Def("#Panel"))

func defaultOverlay(p BaseLoadPaths) (map[string]load.Source, error) {
	overlay := make(map[string]load.Source)
	if err := toOverlay("/", p.BaseCueFS, overlay); err != nil {
		return nil, err
	}
	if err := toOverlay("/", p.DistPluginCueFS, overlay); err != nil {
		return nil, err
	}

	return overlay, nil
}

// BaseDashboardFamily loads the family of schema representing the "Base" variant of
// a Grafana dashboard: the core-defined dashboard schema that applies universally to
// all dashboards, independent of any plugins.
//
// The returned VersionedCueSchema will always be the oldest schema in the
// family: the 0.0 schema. schema.Find() provides easy traversal to newer schema
// versions.
func BaseDashboardFamily(p BaseLoadPaths) (schema.VersionedCueSchema, error) {
	overlay, err := defaultOverlay(p)
	if err != nil {
		return nil, err
	}

	cfg := &load.Config{Overlay: overlay}
	inst, err := rt.Build(load.Instances([]string{"/cue/data/gen.cue"}, cfg)[0])
	if err != nil {
		cueError := schema.WrapCUEError(err)
		if err != nil {
			return nil, cueError
		}
	}

	famval := inst.Value().LookupPath(cue.MakePath(cue.Str("Family")))
	if !famval.Exists() {
		return nil, errors.New("dashboard schema family did not exist at expected path in expected file")
	}

	return buildGenericScuemata(famval)
}

// DistDashboardFamily loads the family of schema representing the "Dist"
// variant of a Grafana dashboard: the "Base" variant (see
// BaseDashboardFamily()), but constrained such that all substructures (e.g.
// panels) must be valid with respect to the schemas provided by the core
// plugins that ship with Grafana.
//
// The returned VersionedCueSchema will always be the oldest schema in the
// family: the 0.0 schema. schema.Find() provides easy traversal to newer schema
// versions.
func DistDashboardFamily(p BaseLoadPaths) (schema.VersionedCueSchema, error) {
	head, err := BaseDashboardFamily(p)
	if err != nil {
		return nil, err
	}
	scuemap, err := readPanelModels(p)
	if err != nil {
		return nil, err
	}

	dj, err := disjunctPanelScuemata(scuemap)
	if err != nil {
		return nil, err
	}

	// Stick this into a dummy struct so that we can unify it into place, as
	// Value.Fill() can't target definitions. Need new method based on cue.Path;
	// a CL has been merged that creates FillPath and will be in the next
	// release of CUE.
	dummy, _ := rt.Compile("mergeStruct", `
	obj: {}
	dummy: {
		#Panel: obj
	}
	`)

	filled := dummy.Value().FillPath(cue.MakePath(cue.Str("obj")), dj)
	ddj := filled.LookupPath(cue.MakePath(cue.Str("dummy")))

	var first, prev *compositeDashboardSchema
	for head != nil {
		cds := &compositeDashboardSchema{
			base:      head,
			actual:    head.CUE().Unify(ddj),
			panelFams: scuemap,
			// TODO migrations
			migration: terminalMigrationFunc,
		}

		if prev == nil {
			first = cds
		} else {
			prev.next = cds
		}

		prev = cds
		head = head.Successor()
	}

	return first, nil
}

type compositeDashboardSchema struct {
	// The base/root dashboard schema
	base      schema.VersionedCueSchema
	actual    cue.Value
	next      *compositeDashboardSchema
	migration migrationFunc
	panelFams map[string]schema.VersionedCueSchema
}

// Validate checks that the resource is correct with respect to the schema.
func (cds *compositeDashboardSchema) Validate(r schema.Resource) error {
	rv, err := rt.Compile("resource", r.Value)
	if err != nil {
		return err
	}
	return cds.actual.Unify(rv.Value()).Validate(cue.Concrete(true))
}

// CUE returns the cue.Value representing the actual schema.
func (cds *compositeDashboardSchema) CUE() cue.Value {
	return cds.actual
}

// Version reports the major and minor versions of the schema.
func (cds *compositeDashboardSchema) Version() (major int, minor int) {
	return cds.base.Version()
}

// Returns the next VersionedCueSchema
func (cds *compositeDashboardSchema) Successor() schema.VersionedCueSchema {
	if cds.next == nil {
		// Untyped nil, allows `<sch> == nil` checks to work as people expect
		return nil
	}
	return cds.next
}

func (cds *compositeDashboardSchema) Migrate(x schema.Resource) (schema.Resource, schema.VersionedCueSchema, error) { // TODO restrict input/return type to concrete
	r, sch, err := cds.migration(x.Value)
	if err != nil || sch == nil {
		// TODO fix sloppy types
		r = x.Value.(cue.Value)
	}

	return schema.Resource{Value: r}, sch, nil
}

func (cds *compositeDashboardSchema) LatestPanelSchemaFor(id string) (schema.VersionedCueSchema, error) {
	// So much slop rn, but it's OK because i FINALLY know where this is going!
	psch, has := cds.panelFams[id]
	if !has {
		// TODO typed errors
		return nil, fmt.Errorf("unknown panel plugin type %q", id)
	}

	latest := schema.Find(psch, schema.Latest())
	sch := &genericVersionedSchema{
		actual: cds.base.CUE().LookupPath(panelSubpath).Unify(mapPanelModel(id, latest)),
	}
	sch.major, sch.minor = latest.Version()

	return sch, nil
}

// One-off special interface for dashboard composite schema, until the composite
// dashboard schema pattern is fully generalized.
//
// NOTE: THIS IS A TEMPORARY TYPE. IT WILL BE REPLACED WITH A GENERIC INTERFACE
// TO REPRESENT COMPOSITIONAL SCHEMA FAMILY PRIOR TO GRAFANA 8. UPDATING WILL
// SHOULD BE TRIVIAL, BUT IT WILL CAUSE BREAKAGES.
type CompositeDashboardSchema interface {
	schema.VersionedCueSchema
	LatestPanelSchemaFor(id string) (schema.VersionedCueSchema, error)
}
