package load

import (
	"encoding/json"
	"errors"
	"fmt"
	"io/fs"
	"io/ioutil"
	"os"
	"path/filepath"

	"cuelang.org/go/cue"
	"cuelang.org/go/cue/load"
	"github.com/grafana/grafana/pkg/schema"
)

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
		r = x.Value
	}

	return schema.Resource{Value: r}, sch, nil
}

type migrationFunc func(x cue.Value) (cue.Value, schema.VersionedCueSchema, error)

var terminalMigrationFunc = func(x cue.Value) (cue.Value, schema.VersionedCueSchema, error) {
	// TODO send back the input
	return cue.Value{}, nil, nil
}

// Creates a func to perform a "migration" that simply unifies the input
// artifact (which is expected to have already have been validated against an
// earlier schema) with a later schema.
func implicitMigration(v cue.Value, next schema.VersionedCueSchema) migrationFunc {
	return func(x cue.Value) (cue.Value, schema.VersionedCueSchema, error) {
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
	majiter, _ := famval.Lookup("seqs").List()
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
				// TODO Verify that this schema is backwards compat with prior.
				// Create an implicit migration operation on the prior schema.
				lastgvs.migration = implicitMigration(gvs.actual, gvs)
			} else if major != 0 {
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
		}
		fam.Seqs = append(fam.Seqs, seq)
	}

	return fam, nil
}

type panelFamily struct {
	typ string
	fam *schema.Family
}

// DistPanels loads up generic Families representing the set of possible
// schemata for panel plugin configuration. The returned map is keyed
// by plugin id.
func DistPanels(p BaseLoadPaths) (map[string]panelFamily, error) {
	// First, load up the base dashboard schema. We need the base panel
	// definition from it.
	dirCfg := &load.Config{
		Dir:     filepath.Join(p.BaseCueFS, "data"),
		Package: "grafanaschema",
	}
	dinst := cue.Build(load.Instances([]string{"."}, dirCfg))[0]
	if !dinst.Value().Exists() {
		return nil, errors.New("Failed to load dashboard cue def")
	}

	// TODO sync.Map?
	all := make(map[string]panelFamily)
	plugindir := filepath.Join(p.DistPluginCueFS, "panel")
	ofs := os.DirFS(plugindir)
	err := fs.WalkDir(ofs, ".", func(path string, d fs.DirEntry, err error) error {
		if err != nil {
			return err
		}

		if d.IsDir() || d.Name() != "plugin.json" {
			return nil
		}

		// For now, skip plugins without a models.cue
		_, err = ofs.Open(filepath.Join(filepath.Dir(path), "models.cue"))
		if err != nil {
			return nil
		}

		fi, err := ofs.Open(path)
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
			Dir:     filepath.Dir(filepath.Join(plugindir, path)),
			Package: "grafanaschema",
			// Overlay: map[string]load.Source{
			// 	"plugin.json"
			// }
		}

		// TODO rely on schemata.cue defined in central location
		li := load.Instances([]string{"models.cue", "schemata.cue"}, cfg)
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
		if err := pmf.Subsume(pmod); err != nil {
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
