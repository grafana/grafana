package load

import (
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"io/fs"
	"io/ioutil"
	"os"
	"path/filepath"
	"reflect"

	"cuelang.org/go/cue"
	cuerr "cuelang.org/go/cue/errors"
	"cuelang.org/go/cue/load"
	"github.com/grafana/grafana/pkg/schema"
)

// Families can have variants, where more typing information narrows the
// possible values for certain keys in schemas. These are a meta-property
// of the schema, effectively encoded in these loaders.
//
// We can generally define three variants:
//  - "Base": strictly core schema files, no plugins. (go:embed-able)
//  - "Dist": "Base" + plugins that ship with vanilla Grafana (go:embed-able)
//  - "Instance": "Dist" + the non-core plugins available in an actual, running Grafana

// BaseLoadPaths contains the configuration for loading a DistDashboard
type BaseLoadPaths struct {
	// BaseCueFS should be rooted at a directory containing the filesystem layout
	// expected to exist at github.com/grafana/grafana/cue.
	BaseCueFS fs.FS

	// DistPluginCueFS should point to some fs path (TBD) under which all core
	// plugins live.
	DistPluginCueFS fs.FS

	// InstanceCueFS should point to a root dir in which non-core plugins live.
	// Normal case will be that this only happens when an actual Grafana
	// instance is making the call, and has a plugin dir to offer - though
	// external tools could always create their own dirs shaped like a Grafana
	// plugin dir, and point to those.
	InstanceCueFS fs.FS
}

type compositeDashboardSchema struct {
	actual    cue.Value
	scratch   cue.Value
	major     int
	minor     int
	next      *compositeDashboardSchema
	migration migrationFunc
}

// Validate checks that the resource is correct with respect to the schema.
func (cds *compositeDashboardSchema) Validate(r schema.Resource) error {
	rv := cds.scratch.Fill(r.Value)
	// fmt.Printf("%v\n", rv)
	// fmt.Printf("%v\n", cds.actual)
	// return cds.actual.Subsume(rv)
	v := cds.actual.Unify(rv)
	// fmt.Printf("%v\n", v)
	errs := v.Validate(cue.Concrete(true))
	cuerr.Print(os.Stderr, errs, nil)
	return errs
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
	return cds.major, cds.minor
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

// toOverlay converts all .cue files in the fs.FS into Source entries in an
// overlay map, as expected by load.Config.
//
// Each entry is placed in the map with the provided prefix - which must be an
// absolute path - ahead of the actual path of the added file within the fs.FS.
//
// The function writes into the provided overlay map, to facilitate the
// construction of a single overlay map from multiple fs.FS.
//
// All files reachable by walking the provided fs.FS are added to the overlay
// map, on the premise that control over the FS is sufficient to allow any
// desired filtering.
func toOverlay(prefix string, vfs fs.FS, overlay map[string]load.Source) error {
	if !filepath.IsAbs(prefix) {
		return fmt.Errorf("must provide absolute path prefix when generating cue overlay, got %q", prefix)
	}

	err := fs.WalkDir(vfs, ".", (func(path string, d fs.DirEntry, err error) error {
		if err != nil {
			return err
		}

		if d.IsDir() {
			return nil
		}

		f, err := vfs.Open(path)
		if err != nil {
			return err
		}

		b, err := io.ReadAll(f)
		if err != nil {
			return err
		}

		overlay[filepath.Join(prefix, path)] = load.FromBytes(b)
		return nil
	}))

	if err != nil {
		return err
	}

	return nil
}

func DistDashboardFamily(p BaseLoadPaths) (*schema.Family, error) {
	overlay := make(map[string]load.Source)
	if err := toOverlay("/", p.BaseCueFS, overlay); err != nil {
		return nil, err
	}
	if err := toOverlay("/", p.DistPluginCueFS, overlay); err != nil {
		return nil, err
	}

	cfg := &load.Config{Overlay: overlay}
	inst := cue.Build(load.Instances([]string{"/cue/data/gen.cue"}, cfg))[0]

	distpanels, err := rawDistPanels(p)
	if err != nil {
		return nil, err
	}

	// TODO Sucks that these are not a hidden field rn, but FieldByName doesn't
	// seem to be working?
	dp := inst.Lookup("discriminatedPanel")
	if !dp.Exists() {
		return nil, errors.New("discriminatedPanel did not exist")
	}

	// f, err := inst.Value().FieldByName("_parts", true)
	// if err != nil {
	// 	return nil, err
	// }

	for id, pfam := range distpanels {
		cur := pfam.fam.Seqs[0][0]

		// TODO lol, be better
		for !reflect.ValueOf(cur).IsNil() {
			cv := cur.CUE()
			mjv, miv := cur.Version()
			pv := dp.Fill(cv, "arg", "model").
				Fill(id, "arg", "type").
				Fill(mjv, "arg", "v", "maj").
				Fill(miv, "arg", "v", "min")

			fmt.Printf("%v\n", pv)

			inst, err = inst.Fill(pv, "allPanels", fmt.Sprintf("%s%v%v", id, mjv, miv))
			if err != nil {
				return nil, err
			}
			cur = cur.Successor()
		}
	}

	allp := inst.Lookup("allPanels")
	if !allp.Exists() {
		return nil, errors.New("allPanels did not exist")
	}
	fmt.Printf("%v\n", allp)

	parts := inst.Lookup("parts")
	if !parts.Exists() {
		return nil, errors.New("parts did not exist")
	}

	scratch := inst.Lookup("scratch")
	if !scratch.Exists() {
		return nil, errors.New("scratch did not exist")
	}

	famval := inst.Lookup("dashboardFamily")
	if !famval.Exists() {
		return nil, errors.New("dashboard schema family did not exist at expected path in expected file")
	}

	return buildDistDashboardFamily(famval, parts, scratch)
}

func buildDistDashboardFamily(famval, parts, scratch cue.Value) (*schema.Family, error) {
	// TODO verify subsumption by #SchemaFamily; renders many
	// error checks below unnecessary
	majiter, err := famval.Lookup("seqs").List()
	if err != nil {
		return nil, err
	}
	// TODO for now we do nothing with parts, relying on the cue file to unify
	// because filling hidden fields is still crappy
	var major int
	var lastcds *compositeDashboardSchema
	fam := &schema.Family{}
	for majiter.Next() {
		var minor int
		miniter, _ := majiter.Value().List()
		var seq schema.Seq
		for miniter.Next() {
			cds := &compositeDashboardSchema{
				actual:  miniter.Value(),
				scratch: scratch,
				major:   major,
				minor:   minor,
				// This gets overwritten on all but the very final schema
				migration: terminalMigrationFunc,
			}

			if minor != 0 {
				lastcds.next = cds
				// TODO Verify that this schema is backwards compat with prior.
				// Create an implicit migration operation on the prior schema.
				lastcds.migration = implicitMigration(cds.actual, cds)
			} else if major != 0 {
				lastcds.next = cds
				// x.0. There should exist an explicit migration definition;
				// load it up and ready it for use, and place it on the final
				// schema in the prior sequence.
				//
				// Also...should at least try to make sure it's pointing at the
				// expected schema, to maintain our invariants?

				// TODO impl
			}
			seq = append(seq, cds)
		}
		fam.Seqs = append(fam.Seqs, seq)
	}

	return fam, nil
}

type genericVersionedSchema struct {
	actual    cue.Value
	major     int
	minor     int
	next      *genericVersionedSchema
	migration migrationFunc
}

// Validate checks that the resource is correct with respect to the schema.
func (gvs *genericVersionedSchema) Validate(_ schema.Resource) error {
	panic("not implemented") // TODO: Implement
}

// ApplyDefaults returns a new, concrete copy of the Resource with all paths
// that are 1) missing in the Resource AND 2) specified by the schema,
// filled with default values specified by the schema.
func (gvs *genericVersionedSchema) ApplyDefaults(_ schema.Resource) (schema.Resource, error) {
	panic("not implemented") // TODO: Implement
}

// TrimDefaults returns a new, concrete copy of the Resource where all paths
// in the  where the values at those paths are the same as the default value
// given in the schema.
func (gvs *genericVersionedSchema) TrimDefaults(_ schema.Resource) (schema.Resource, error) {
	panic("not implemented") // TODO: Implement
}

// CUE returns the cue.Value representing the actual schema.
func (gvs *genericVersionedSchema) CUE() cue.Value {
	return gvs.actual
}

// Version reports the major and minor versions of the schema.
func (gvs *genericVersionedSchema) Version() (major int, minor int) {
	return gvs.major, gvs.minor
}

// Returns the next VersionedCueSchema
func (gvs *genericVersionedSchema) Successor() schema.VersionedCueSchema {
	return gvs.next
}

// Migrate transforms a resource into a new Resource that is correct with
// respect to its Successor schema.
func (gvs *genericVersionedSchema) Migrate(x schema.Resource) (schema.Resource, schema.VersionedCueSchema, error) { // TODO restrict input/return type to concrete
	r, sch, err := gvs.migration(x.Value)
	if err != nil || sch == nil {
		r = x.Value.(cue.Value)
	}

	return schema.Resource{Value: r}, sch, nil
}

type migrationFunc func(x interface{}) (cue.Value, schema.VersionedCueSchema, error)

var terminalMigrationFunc = func(x interface{}) (cue.Value, schema.VersionedCueSchema, error) {
	// TODO send back the input
	return cue.Value{}, nil, nil
}

// Creates a func to perform a "migration" that simply unifies the input
// artifact (which is expected to have already have been validated against an
// earlier schema) with a later schema.
func implicitMigration(v cue.Value, next schema.VersionedCueSchema) migrationFunc {
	return func(x interface{}) (cue.Value, schema.VersionedCueSchema, error) {
		w := v.Fill(x)
		// TODO is it possible that migration would be successful, but there
		// still exists some error here? Need to better understand internal CUE
		// erroring rules? seems like incomplete cue.Value may always an Err()?
		//
		// TODO should check concreteness here? Or can we guarantee a priori it
		// can be made concrete simply by looking at the schema, before
		// implicitMigration() is called to create this function?
		if w.Err() != nil {
			return w, nil, w.Err()
		}
		return w, next, w.Err()
	}
}

func buildSchemaFamily(famval cue.Value) (*schema.Family, error) {
	// TODO verify subsumption by #SchemaFamily; renders many
	// error checks below unnecessary
	majiter, err := famval.Lookup("seqs").List()
	if err != nil {
		return nil, err
	}
	var major int
	var lastgvs *genericVersionedSchema
	fam := &schema.Family{}
	for majiter.Next() {
		var minor int
		miniter, _ := majiter.Value().List()
		var seq schema.Seq
		for miniter.Next() {
			gvs := &genericVersionedSchema{
				actual: miniter.Value(),
				major:  major,
				minor:  minor,
				// This gets overwritten on all but the very final schema
				migration: terminalMigrationFunc,
			}

			if minor != 0 {
				lastgvs.next = gvs
				// TODO Verify that this schema is backwards compat with prior.
				// Create an implicit migration operation on the prior schema.
				lastgvs.migration = implicitMigration(gvs.actual, gvs)
			} else if major != 0 {
				lastgvs.next = gvs
				// x.0. There should exist an explicit migration definition;
				// load it up and ready it for use, and place it on the final
				// schema in the prior sequence.
				//
				// Also...should at least try to make sure it's pointing at the
				// expected schema, to maintain our invariants?

				// TODO impl
			}
			lastgvs = gvs
			seq = append(seq, gvs)
			minor++
		}
		major++
		fam.Seqs = append(fam.Seqs, seq)
	}

	// TODO stupid pointers not being references, fixme
	for o, seq := range fam.Seqs {
		for i, gen := range seq {
			var next *genericVersionedSchema
			if len(seq) == i+1 {
				if len(fam.Seqs) == o+1 {
					continue
				}
				next = fam.Seqs[o+1][0].(*genericVersionedSchema)
			} else {
				next = seq[i+1].(*genericVersionedSchema)
			}
			gvs := gen.(*genericVersionedSchema)
			gvs.next = next
			fam.Seqs[o][i] = gvs
		}
	}

	return fam, nil
}

type panelFamily struct {
	typ string
	fam *schema.Family
}

// rawDistPanels loads up generic Families representing the set of possible
// schemata for panel plugin configuration. It does not remap them onto the
// dashboard-declared panel type.
//
// The returned map is keyed by plugin id.
func rawDistPanels(p BaseLoadPaths) (map[string]panelFamily, error) {
	overlay := make(map[string]load.Source)
	if err := toOverlay("/", p.BaseCueFS, overlay); err != nil {
		return nil, err
	}
	if err := toOverlay("/", p.DistPluginCueFS, overlay); err != nil {
		return nil, err
	}

	// TODO sync.Map?
	all := make(map[string]panelFamily)
	err := fs.WalkDir(p.DistPluginCueFS, ".", func(path string, d fs.DirEntry, err error) error {
		if err != nil {
			return err
		}

		if d.IsDir() || d.Name() != "plugin.json" {
			return nil
		}

		dpath := filepath.Dir(path)
		// For now, skip plugins without a models.cue
		_, err = p.DistPluginCueFS.Open(filepath.Join(dpath, "models.cue"))
		if err != nil {
			return nil
		}

		fi, err := p.DistPluginCueFS.Open(path)
		if err != nil {
			return err
		}
		b, err := ioutil.ReadAll(fi)
		if err != nil {
			return err
		}

		jmap := make(map[string]interface{})
		json.Unmarshal(b, &jmap)
		if err != nil {
			return err
		}
		iid, has := jmap["id"]
		if !has || jmap["type"] != "panel" {
			return errors.New("no type field in plugin.json or not a panel type plugin")
		}
		id := iid.(string)

		cfg := &load.Config{
			// Dir:     filepath.Dir(filepath.Join(plugindir, path)),
			Package: "grafanaschema",
			Overlay: overlay,
		}
		// TODO rely on schemata.cue defined in central location
		paths := []string{"models.cue", "schemata.cue"}
		for k, p := range paths {
			paths[k] = filepath.Join("/", dpath, p)
		}
		li := load.Instances(paths, cfg)
		built := cue.Build(li)
		// TODO this is a silly check...right?
		if len(built) != 1 {
			return fmt.Errorf("expected exactly one instance, got %v", len(built))
		}
		imod := built[0]

		// Verify that there exists a Model declaration in the models.cue file...
		// TODO Best (?) ergonomics for entire models.cue file to emit a struct
		// compliant with #PanelModelFamily
		pmod := imod.Lookup("Model")
		if !pmod.Exists() {
			return fmt.Errorf("%s does not contain a declaration of its models at path 'Model'", path)
		}

		// TODO this has to come from a generic/central location - but what does
		// that mean for being able to specify it in the models.cue file? Do we want
		// that to be part of the ergonomics of models.cue?
		pmf := imod.LookupDef("#PanelModelFamily")
		if !pmf.Exists() {
			return errors.New("could not locate #PanelModelFamily definition")
		}

		// Ensure the declared value is subsumed by/correct wrt #PanelModelFamily
		// if err := pmf.Subsume(pmod); err != nil {
		// 	return err
		// }
		if err := pmf.Unify(pmod).Validate(cue.Concrete(true)); err != nil {
			return err
		}

		// Create a generic schema family to represent the whole of the
		fam, err := buildSchemaFamily(pmod)
		if err != nil {
			return err
		}

		all[id] = panelFamily{
			typ: id,
			fam: fam,
		}
		return nil
	})
	if err != nil {
		return nil, err
	}

	return all, nil
}

func pr(v interface{}) {
	switch t := v.(type) {
	case *cue.Instance:
		fmt.Printf("%v\n", t.Value())
	case cue.Value:
		fmt.Printf("%v\n", t)
	default:
		panic("unsupported helpy printer")
	}
}
