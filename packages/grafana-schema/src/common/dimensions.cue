package common

BaseDimensionConfig: {
  field?: string
  // fixed: T -- will be added by each element
}@cuetsy(kind="interface")

ScaleDimensionMode: "linear" | "quad" @cuetsy(kind="enum")

ScaleDimensionConfig: {
  BaseDimensionConfig
  min: number
  max: number
  fixed?: number
  mode?: ScaleDimensionMode // | *"linear"
}@cuetsy(kind="interface")

ColorDimensionConfig: {
  BaseDimensionConfig
  fixed?: string // color value
}@cuetsy(kind="interface")

ScalarDimensionMode: "mod" | "clamped" @cuetsy(kind="enum")

ScalarDimensionConfig: {
  BaseDimensionConfig
  min: number
  max: number
  fixed?: number
  mode?: ScalarDimensionMode
}@cuetsy(kind="interface")

TextDimensionMode: "fixed" | "field" | "template" @cuetsy(kind="enum")

TextDimensionConfig: {
  BaseDimensionConfig
  mode: TextDimensionMode
  fixed?: string
}@cuetsy(kind="interface")

ResourceDimensionMode: "fixed" | "field" | "mapping" @cuetsy(kind="enum")

// Links to a resource (image/svg path)
ResourceDimensionConfig: {
  BaseDimensionConfig
  mode: ResourceDimensionMode
  fixed?: string
}@cuetsy(kind="interface")

ConnectionDirection: "forward" | "reverse" | "both" | "none" @cuetsy(kind="enum", memberNames="Forward|Reverse|Both|None")

DirectionDimensionMode: "fixed" | "field" @cuetsy(kind="enum")

DirectionDimensionConfig: {
	BaseDimensionConfig
	mode: DirectionDimensionMode
	fixed?: ConnectionDirection
}@cuetsy(kind="interface")
