package load

import (
	"encoding/json"
	"errors"
	"fmt"
	"io/fs"
	"io/ioutil"
	"path/filepath"
	"reflect"

	"cuelang.org/go/cue"
	"cuelang.org/go/cue/load"
	"github.com/grafana/grafana/pkg/schema"
)

// TODO a proper approach to this type would probably include responsibility for
// moving between the declared and composed forms of panel plugin schema
type panelSchema struct {
	actual    cue.Value
	major     int
	minor     int
	next      *panelSchema
	migration migrationFunc
}

func (ps *panelSchema) Validate(r schema.Resource) error {
	rv, err := rt.Compile("resource", r.Value)
	if err != nil {
		return err
	}
	return ps.actual.Unify(rv.Value()).Validate(cue.Concrete(true))
}

func (ps *panelSchema) ApplyDefaults(_ schema.Resource) (schema.Resource, error) {
	panic("not implemented") // TODO: Implement
}

func (ps *panelSchema) TrimDefaults(_ schema.Resource) (schema.Resource, error) {
	panic("not implemented") // TODO: Implement
}

func (ps *panelSchema) CUE() cue.Value {
	return ps.actual
}

func (ps *panelSchema) Version() (major int, minor int) {
	return ps.major, ps.minor
}

func (ps *panelSchema) Successor() schema.VersionedCueSchema {
	panic("not implemented")
}

func (ps *panelSchema) Migrate(x schema.Resource) (schema.Resource, schema.VersionedCueSchema, error) {
	panic("not implemented")
}

// Returns a disjunction of structs representing each schema version from each
// scuemata in the map.
func disjunctPanelScuemata(scuemap map[string]schema.Fam) (cue.Value, error) {
	partsi, err := rt.Compile("panelDisjunction", `
	allPanels: [Name=_]: {}
	parts: or([for v in allPanels { v }])
	`)
	if err != nil {
		return cue.Value{}, err
	}

	parts := partsi.Value()
	for id, fam := range scuemap {
		sch := fam.First()

		// TODO lol, be better
		for !reflect.ValueOf(sch).IsNil() {
			cv := panelMapFor(id, sch)

			mjv, miv := sch.Version()
			parts = parts.Fill(cv, "allPanels", fmt.Sprintf("%s@%v.%v", id, mjv, miv))
			sch = sch.Successor()
		}
	}

	return parts.LookupPath(cue.MakePath(cue.Str("parts"))), nil
	// return parts.LookupPath(cue.MakePath(cue.Str("allPanels"))), nil
}

func panelMapFor(id string, vcs schema.VersionedCueSchema) cue.Value {
	maj, min := vcs.Version()
	inter, err := rt.Compile("typedPanel", fmt.Sprintf(`
	in: {
		type: %q
		v: {
			maj: %d
			min: %d
		}
		model: {...}
	}
	result: {
		type: in.type,
		panelSchema: maj: in.v.maj
		panelSchema: min: in.v.min
		options: in.model.PanelOptions
		fieldConfig: defaults: custom: in.model.PanelFieldConfig
	}
	`, id, maj, min))
	if err != nil {
		// The above can't not compile
		panic(err)
	}

	// TODO validate, especially with #PanelModel
	// fmt.Printf("%v\n", inter.Value().Fill(vcs.CUE(), "in", "model").Lookup("result"))
	return inter.Value().Fill(vcs.CUE(), "in", "model").Lookup("result")
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

	parts := inst.Lookup("parts")
	if !parts.Exists() {
		return nil, errors.New("parts did not exist")
	}

	famval := inst.Lookup("dashboardFamily")
	if !famval.Exists() {
		return nil, errors.New("dashboard schema family did not exist at expected path in expected file")
	}

	return buildDistDashboardFamily(famval, parts)
}

func buildDistDashboardFamily(famval, parts cue.Value) (*schema.Family, error) {
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
				actual: miniter.Value(),
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

	cfg := &load.Config{
		Overlay: overlay,
		Package: "scuemata",
	}

	built, err := rt.Build(load.Instances([]string{"/cue/scuemata/scuemata.cue"}, cfg)[0])
	if err != nil {
		return nil, err
	}
	pmf := built.Value().LookupPath(cue.MakePath(cue.Def("#PanelModelFamily")))
	if !pmf.Exists() {
		return nil, errors.New("could not locate #PanelModelFamily definition")
	}

	all := make(map[string]panelFamily)
	err = fs.WalkDir(p.DistPluginCueFS, ".", func(path string, d fs.DirEntry, err error) error {
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
			Package: "grafanaschema",
			Overlay: overlay,
		}

		li := load.Instances([]string{filepath.Join("/", dpath, "models.cue")}, cfg)
		imod, err := rt.Build(li[0])
		if err != nil {
			return err
		}

		// Verify that there exists a Model declaration in the models.cue file...
		// TODO Best (?) ergonomics for entire models.cue file to emit a struct
		// compliant with #PanelModelFamily
		pmod := imod.Lookup("Model")
		if !pmod.Exists() {
			return fmt.Errorf("%s does not contain a declaration of its models at path 'Model'", path)
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

func rawDistPanels2(p BaseLoadPaths) (map[string]schema.Fam, error) {
	overlay := make(map[string]load.Source)
	if err := toOverlay("/", p.BaseCueFS, overlay); err != nil {
		return nil, err
	}
	if err := toOverlay("/", p.DistPluginCueFS, overlay); err != nil {
		return nil, err
	}

	cfg := &load.Config{
		Overlay: overlay,
		Package: "scuemata",
	}

	built, err := rt.Build(load.Instances([]string{"/cue/scuemata/scuemata.cue"}, cfg)[0])
	if err != nil {
		return nil, err
	}
	pmf := built.Value().LookupPath(cue.MakePath(cue.Def("#PanelModelFamily")))
	if !pmf.Exists() {
		return nil, errors.New("could not locate #PanelModelFamily definition")
	}

	all := make(map[string]schema.Fam)
	err = fs.WalkDir(p.DistPluginCueFS, ".", func(path string, d fs.DirEntry, err error) error {
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
			Package: "grafanaschema",
			Overlay: overlay,
		}

		li := load.Instances([]string{filepath.Join("/", dpath, "models.cue")}, cfg)
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

		// Ensure the declared value is subsumed by/correct wrt #PanelModelFamily
		if err := pmf.Subsume(pmod); err != nil {
			return err
		}

		// Create a generic schema family to represent the whole of the
		fam, err := buildGenericFamily(pmod)
		if err != nil {
			return err
		}

		all[id] = fam
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
