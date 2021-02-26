package grafanaschema

import fieldConfig "github.com/grafana/grafana/packages/grafana-data/src/types/fieldConfig:grafanaschema"


PanelGridPos: {
    // Panel height.
    h: int > 0 | *9
    // Panel width.
    w: int > 0 <= 24 | *12
    // Panel x position.
    x: int >= 0 < 24 | *0
    // Panel y position.
    y: int >= 0 | *0
    // true if fixed
    static?: bool
}

BasePanelModel: {
	// The panel plugin type id. 
	type: string | *"" // empty is actually invalid!

	// Panel title.
	title?: string
	// Description.
	description?: string
	// Whether to display the panel without a background.
	transparent: bool | *false
	// Name of default datasource.
	datasource?: string
	// Grid position.
	gridPos?: PanelGridPos
	// Panel links.
	// links?: [..._panelLink]
	// Name of template variable to repeat for.
	repeat?: string
	// Direction to repeat in if 'repeat' is set.
	// "h" for horizontal, "v" for vertical.
	repeatDirection: *"h" | "v"
	// Panel targets - speciic values depend on the datasource
	targets?: [...{}]

    // The values depend on panel type
    options: {}

    fieldConfig: fieldConfig.FieldConfigSource // < also generic
}
