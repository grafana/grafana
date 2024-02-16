// Code generated - EDITING IS FUTILE. DO NOT EDIT.
//
// Using jennies:
//     GoVariantsPlugins

package cogvariants

type PanelcfgConfig struct {
	Identifier             string
	OptionsUnmarshaler     func(raw []byte) (any, error)
	FieldConfigUnmarshaler func(raw []byte) (any, error)
}

type DataqueryConfig struct {
	Identifier           string
	DataqueryUnmarshaler func(raw []byte) (Dataquery, error)
}

type Dataquery interface {
	ImplementsDataqueryVariant()
}

type Panelcfg interface {
	ImplementsPanelcfgVariant()
}

type UnknownDataquery map[string]any

func (unknown UnknownDataquery) ImplementsDataqueryVariant() {

}
