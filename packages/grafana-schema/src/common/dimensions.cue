package common

BaseDimensionConfig: {
  field?: string
  // fixed: T -- will be added by each element
}@cuetsy(kind="interface")

ScaleDimensionConfig: {
  BaseDimensionConfig
  min: int32
  max: int32
  fixed?: int32
}@cuetsy(kind="interface")

ColorDimensionConfig: {
  BaseDimensionConfig
  fixed?: string // color value
}@cuetsy(kind="interface")

TextDimensionMode: "fixed" | "field" | "template" @cuetsy(kind="enum")

TextDimensionConfig: {
  BaseDimensionConfig
  mode: TextDimensionMode
  fixed?: string 
}@cuetsy(kind="interface")

ResourceDimensionMode: "fixed" | "field" | "template" @cuetsy(kind="enum")

// Links to a resource (image/svg path)
ResourceDimensionConfig: {
  BaseDimensionConfig
  mode: ResourceDimensionMode
  fixed?: string 
}@cuetsy(kind="interface")

