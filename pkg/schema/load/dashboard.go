package load

import (
	"errors"
	"fmt"
	"path/filepath"

	"cuelang.org/go/cue"
	"cuelang.org/go/cue/load"
	"github.com/grafana/grafana/pkg/schema"
)

var panelSubpath = cue.MakePath(cue.Def("#Panel"))

var dashboardDir = filepath.Join("packages", "grafana-schema", "src", "scuemata", "dashboard")

func defaultOverlay(p BaseLoadPaths) (map[string]load.Source, error) {
	overlay := make(map[string]load.Source)

	if err := toOverlay(prefix, p.BaseCueFS, overlay); err != nil {
		return nil, err
	}

	if err := toOverlay(prefix, p.DistPluginCueFS, overlay); err != nil {
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
	v, err := baseDashboardFamily(p)
	if err != nil {
		return nil, err
	}
	return buildGenericScuemata(v)
}

// Helper that gets the entire scuemata family, for reuse by Dist/Instance callers.
func baseDashboardFamily(p BaseLoadPaths) (cue.Value, error) {
	overlay, err := defaultOverlay(p)
	if err != nil {
		return cue.Value{}, err
	}

	cfg := &load.Config{
		Overlay:    overlay,
		ModuleRoot: prefix,
		Module:     "github.com/grafana/grafana",
		Dir:        filepath.Join(prefix, dashboardDir),
	}
	inst := ctx.BuildInstance(load.Instances(nil, cfg)[0])
	if inst.Err() != nil {
		cueError := schema.WrapCUEError(inst.Err())
		if inst.Err() != nil {
			return cue.Value{}, cueError
		}
	}

	famval := inst.LookupPath(cue.MakePath(cue.Str("Family")))
	if !famval.Exists() {
		return cue.Value{}, errors.New("dashboard schema family did not exist at expected path in expected file")
	}

	return famval, nil
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
	famval, err := baseDashboardFamily(p)
	if err != nil {
		return nil, err
	}
	scuemap, err := loadPanelScuemata(p)
	if err != nil {
		return nil, err
	}

	// TODO see if unifying into the expected form in a loop, then unifying that
	// consolidated form improves performance
	for typ, fam := range scuemap {
		famval = famval.FillPath(cue.MakePath(cue.Str("compose"), cue.Str("Panel"), cue.Str(typ)), fam)
	}
	head, err := buildGenericScuemata(famval)
	if err != nil {
		return nil, err
	}

	// TODO sloppy duplicate logic of what's in readPanelModels(), for now
	all := make(map[string]schema.VersionedCueSchema)
	for id, val := range scuemap {
		fam, err := buildGenericScuemata(val)
		if err != nil {
			return nil, err
		}
		all[id] = fam
	}

	var first, prev *compositeDashboardSchema
	for head != nil {
		cds := &compositeDashboardSchema{
			base:      head,
			actual:    head.CUE(),
			panelFams: all,
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
	name := r.Name
	if name == "" {
		name = "resource"
	}
	rv := ctx.CompileString(r.Value.(string), cue.Filename(name))
	if rv.Err() != nil {
		return rv.Err()
	}
	return cds.actual.Unify(rv).Validate(cue.Concrete(true))
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
	// FIXME this relies on old sloppiness
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
