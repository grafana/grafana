package load

import (
	"errors"
	"fmt"
	"reflect"

	"cuelang.org/go/cue"
	"cuelang.org/go/cue/load"
	"github.com/grafana/grafana/pkg/schema"
)

var panelSubpath cue.Path = cue.MakePath(cue.Def("#Panel"))

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

func BaseDashboardScuemata(p BaseLoadPaths) (schema.Fam, error) {
	overlay, err := defaultOverlay(p)
	if err != nil {
		return nil, err
	}

	cfg := &load.Config{Overlay: overlay}
	inst, err := rt.Build(load.Instances([]string{"/cue/data/gen.cue"}, cfg)[0])
	if err != nil {
		return nil, err
	}

	famval := inst.Lookup("dashboardFamily")
	if !famval.Exists() {
		return nil, errors.New("dashboard schema family did not exist at expected path in expected file")
	}

	return buildGenericScuemata(famval)
}

func DistDashboardScuemata(p BaseLoadPaths) (schema.Fam, error) {
	base, err := BaseDashboardScuemata(p)
	if err != nil {
		return nil, err
	}
	scuemap, err := readPanelModels(p)
	if err != nil {
		return nil, err
	}

	dj, err := disjunctPanelScuemata(scuemap)

	// Stick this into a dummy struct so that we can unify it into place, as
	// Value.Fill() can't target definitions. (Need new method based on
	// cue.Path; there's a CL pending -
	// https://cue-review.googlesource.com/c/cue/+/9162 - and it should be in
	// next release of CUE.)
	dummy, _ := rt.Compile("mergeStruct", `
	obj: {}
	dummy: {
		#Panel: obj
	}
	`)
	filled := dummy.Value().Fill(dj, "obj")
	ddj := filled.LookupPath(cue.MakePath(cue.Str("dummy")))

	var prev *compositeDashboardSchema
	scuem, sch := &scuemata{}, base.First()
	for !reflect.ValueOf(sch).IsNil() {
		cds := &compositeDashboardSchema{
			base:      sch,
			actual:    sch.CUE().Unify(ddj),
			panelFams: scuemap,
			// TODO migrations
			migration: terminalMigrationFunc,
		}

		if prev == nil {
			scuem.first = cds
		} else {
			prev.next = cds
		}
		prev = cds
		sch = sch.Successor()
	}

	return scuem, nil
}

type compositeDashboardSchema struct {
	// The base/root dashboard schema
	base      schema.VersionedCueSchema
	actual    cue.Value
	next      *compositeDashboardSchema
	migration migrationFunc
	panelFams map[string]schema.Fam
}

// Validate checks that the resource is correct with respect to the schema.
func (cds *compositeDashboardSchema) Validate(r schema.Resource) error {
	rv, err := rt.Compile("resource", r.Value)
	if err != nil {
		return err
	}
	return cds.actual.Unify(rv.Value()).Validate(cue.Concrete(true))
}

// ApplyDefaults returns a new, concrete copy of the Resource with all paths
// that are 1) missing in the Resource AND 2) specified by the schema,
// filled with default values specified by the schema.
func (cds *compositeDashboardSchema) ApplyDefaults(_ schema.Resource) (schema.Resource, error) {
	panic("not implemented") // TODO: Implement
}

// TrimDefaults returns a new, concrete copy of the Resource where all paths
// in the  where the values at those paths are the same as the default value
// given in the schema.
func (cds *compositeDashboardSchema) TrimDefaults(_ schema.Resource) (schema.Resource, error) {
	panic("not implemented") // TODO: Implement
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
	fam, has := cds.panelFams[id]
	if !has {
		// TODO typed errors
		return nil, fmt.Errorf("unknown panel plugin type %q", id)
	}

	latest, err := schema.Find(fam.First(), schema.Latest())
	if err != nil {
		return nil, err
	}

	sch := &genericVersionedSchema{
		actual: cds.base.CUE().LookupPath(panelSubpath).Unify(mapPanelModel(id, latest)),
	}
	sch.major, sch.minor = latest.Version()

	return sch, nil
}

func (cds *compositeDashboardSchema) basePanelValue() cue.Value {
	v := cds.base.CUE().LookupPath(panelSubpath)
	if !v.Exists() {
		panic("could not find Panel object in dashboard schema")
	}
	return v
}

// One-off special interface for dashboard composite schema, until the composite
// dashboard schema pattern is fully generalized.
//
// NOTE: THIS IS A TEMPORARY TYPE. IT WILL BE REPLACED WITH A GENERIC INTERFACE
// TO REPRESENT COMPOSITIONAL SCHEMA FAMILY PRIOR TO GRAFANA 8. UPDATING WILL
// SHOULD BE TRIVIAL, BUT IT WILL CAUSE BREAKAGES.
type CompositeDashboardSchema interface {
	LatestPanelSchemaFor(id string) (schema.VersionedCueSchema, error)
}
