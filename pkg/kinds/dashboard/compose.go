package dashboard

import (
	"encoding/json"
	"fmt"
	"sort"

	"cuelang.org/go/cue"
	cjson "cuelang.org/go/encoding/json"
	"github.com/grafana/kindsys"
)

func (k *Kind) Compose(slot kindsys.Slot, kinds ...kindsys.Composable) (kindsys.Core, error) {
	// TODO remove this whole method once we sufficiently describe slots declaratively, and all of this can be handled generically in kindsys
	// first, check that this kind supports this slot
	if k.Props().(kindsys.CoreProperties).Slots[slot.Name] != slot {
		return nil, &kindsys.ErrNoSlotInKind{
			Slot: slot,
			Kind: k,
		}
	}

	schif, err := kindsys.FindSchemaInterface(slot.SchemaInterface)
	if err != nil {
		panic(fmt.Sprintf("unreachable - slot was for nonexistent schema interface %s which should have been rejected at bind time", slot.SchemaInterface))
	}

	// then check that all provided kinds are implementors of the slot
	for _, kind := range kinds {
		if kind.Implements().Name() != schif.Name() {
			return nil, &kindsys.ErrKindDoesNotImplementInterface{
				Kind:      kind,
				Interface: schif,
			}
		}
	}

	// Inputs look good. Make a copy with our built-up compose map
	com := make(map[string][]kindsys.Composable)
	for k, v := range k.composed {
		com[k] = v
	}

	var all []kindsys.Composable
	copy(all, com[slot.Name])
	all = append(all, kinds...)
	// Sort to ensure deterministic output of validation error messages, etc.
	sort.Slice(all, func(i, j int) bool {
		return all[i].Name() < all[j].Name()
	})
	com[slot.Name] = all

	return &Kind{
		Core:   k.Core,
		lin:    k.lin,
		jcodec: k.jcodec,
		valmux: k.valmux,
	}, nil
}

func (k *Kind) Validate(b []byte, codec kindsys.Decoder) error {
	// TODO remove this whole method once slots are described declaratively and this is all handled generically
	if err := k.Core.Validate(b, codec); err != nil {
		return err
	}

	type pseudoDash struct {
		Panels []struct {
			Type        string          `json:"type"`
			Options     json.RawMessage `json:"options"`
			FieldConfig struct {
				Defaults struct {
					Custom json.RawMessage `json:"custom"`
				} `json:"defaults"`
			} `json:"fieldConfig"`
			Targets []json.RawMessage `json:"targets"`
		} `json:"panels"`
	}

	type pcfg struct {
		Options     json.RawMessage `json:"Options"`
		FieldConfig json.RawMessage `json:"FieldConfig,omitempty"`
	}

	type dqt struct {
		Datasource struct {
			Type string `json:"type"`
		}
	}

	// Base validation succeeded. Now, perform additional validation with composed kinds
	pd := pseudoDash{}
	err := json.Unmarshal(b, &pd)
	if err != nil {
		return fmt.Errorf("error unmarshaling panel into intermediate struct: %w", err)
	}
	cctx := k.lin.Runtime().Context()

	for _, panel := range pd.Panels {
		for _, ckind := range k.composed["panel"] {
			// Only attempt panel type validation if panel is of that kind. If none match,
			// that's ok, we let it fall through
			if ckind.Name() == panel.Type {
				// TODO this is fine until we allow multi-schema
				sch := ckind.Lineage().First()

				pcfgbits := pcfg{
					Options:     panel.Options,
					FieldConfig: panel.FieldConfig.Defaults.Custom,
				}
				cv := cctx.Encode(pcfgbits, cue.NilIsAny(false))
				_, err := sch.Validate(cv)
				if err != nil {
					// TODO check all and combine errs instead of terminating early with one
					return err
				}
			}
		}

		for _, targbyt := range panel.Targets {
			for _, ckind := range k.composed["query"] {
				var targtyp dqt
				err := json.Unmarshal(targbyt, &targtyp)
				if err != nil {
					return fmt.Errorf("err unmarshaling target into intermediate struct: %w", err)
				}
				// Only attempt dataquery validation if query is of that kind. Fall through if none match
				if ckind.Name() == targtyp.Datasource.Type {
					// TODO this is fine until we allow multi-schema
					sch := ckind.Lineage().First()

					ex, err := cjson.Extract(fmt.Sprintf("target-%s.json", ckind.Name()), targbyt)
					cv := cctx.BuildExpr(ex)
					if err != nil {
						return fmt.Errorf("err extracting target into cue value: %w", err)
					}
					_, err = sch.Validate(cv)
					if err != nil {
						// TODO check all and combine errs instead of terminating early with one
						return err
					}
					break
				}
			}
		}
	}

	return nil
}
