package load

import (
	"encoding/json"
	"errors"
	"fmt"
	"io/fs"
	"io/ioutil"
	"path/filepath"

	"cuelang.org/go/cue"
	"cuelang.org/go/cue/load"
	"github.com/grafana/grafana/pkg/schema"
)

// Returns a disjunction of structs representing each panel schema version
// (post-mapping from on-disk #PanelModel form) from each scuemata in the map.
func disjunctPanelScuemata(scuemap map[string]schema.VersionedCueSchema) (cue.Value, error) {
	partsi, err := rt.Compile("panelDisjunction", `
	allPanels: [Name=_]: {}
	parts: or([for v in allPanels { v }])
	`)
	if err != nil {
		return cue.Value{}, err
	}

	parts := partsi.Value()
	for id, sch := range scuemap {
		for sch != nil {
			cv := mapPanelModel(id, sch)

			mjv, miv := sch.Version()
			parts = parts.FillPath(cue.MakePath(cue.Str("allPanels"), cue.Str(fmt.Sprintf("%s@%v.%v", id, mjv, miv))), cv)
			sch = sch.Successor()
		}
	}

	return parts.LookupPath(cue.MakePath(cue.Str("parts"))), nil
}

// mapPanelModel maps a schema from the #PanelModel form in which it's declared
// in a plugin's model.cue to the structure in which it actually appears in the
// dashboard schema.
func mapPanelModel(id string, vcs schema.VersionedCueSchema) cue.Value {
	maj, min := vcs.Version()
	// Ignore err return, this can't fail to compile
	inter, _ := rt.Compile("typedPanel", fmt.Sprintf(`
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
		fieldConfig: defaults: custom: {}
		if in.model.PanelFieldConfig != _|_ {
			fieldConfig: defaults: custom: in.model.PanelFieldConfig
		}
	}
	`, id, maj, min))

	// TODO validate, especially with #PanelModel
	return inter.Value().FillPath(cue.MakePath(cue.Str("in"), cue.Str("model")), vcs.CUE()).LookupPath(cue.MakePath(cue.Str(("result"))))
}

func readPanelModels(p BaseLoadPaths) (map[string]schema.VersionedCueSchema, error) {
	overlay := make(map[string]load.Source)

	if err := toOverlay(prefix, p.BaseCueFS, overlay); err != nil {
		return nil, err
	}
	if err := toOverlay(prefix, p.DistPluginCueFS, overlay); err != nil {
		return nil, err
	}

	base, err := getBaseScuemata(p)
	if err != nil {
		return nil, err
	}

	pmf := base.Value().LookupPath(cue.MakePath(cue.Def("#PanelFamily")))
	if !pmf.Exists() {
		return nil, errors.New("could not locate #PanelFamily definition")
	}

	all := make(map[string]schema.VersionedCueSchema)
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
		err = json.Unmarshal(b, &jmap)
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

		// Get the Family declaration in the models.cue file...
		pmod := imod.Value().LookupPath(cue.MakePath(cue.Str("Family")))
		if !pmod.Exists() {
			return fmt.Errorf("%s does not contain a declaration of its models at path 'Family'", path)
		}

		// Ensure the declared value is subsumed by/correct wrt #PanelFamily
		// TODO not actually sure that Final is what we want here.
		if err := pmf.Subsume(pmod, cue.Final()); err != nil {
			return err
		}

		// Create a generic schema family to represent the whole of the
		fam, err := buildGenericScuemata(pmod)
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
