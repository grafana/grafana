package common

MapLayerOptions: {
		type: string
		// configured unique display name
		name: string
		// Custom options depending on the type
  	config?: _
		// Common method to define geometry fields
		location?: FrameGeometrySource
		// Defines which data query refId is associated with the layer
		filterData?: _
		// Common properties:
		// https://openlayers.org/en/latest/apidoc/module-ol_layer_Base-BaseLayer.html
		// Layer opacity (0-1)
		opacity?: int64
		// Check tooltip (defaults to true)
		tooltip?: bool
} @cuetsy(kind="interface") @grafana(TSVeneer="type")

FrameGeometrySourceMode: "auto" | "geohash" |"coords" | "lookup" @cuetsy(kind="enum",memberNames="Auto|Geohash|Coords|Lookup")

FrameGeometrySource: {
		mode: FrameGeometrySourceMode
		// Field mappings
		geohash?: string
		latitude?: string
		longitude?: string
		h3?: string
		wkt?: string
		lookup?: string
		// Path to Gazetteer
		gazetteer?: string
} @cuetsy(kind="interface")
