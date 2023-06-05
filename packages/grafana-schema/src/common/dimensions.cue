package common

BaseDimensionConfig: {
  field?: string
  fixed: string | number
}@cuetsy(kind="interface")

ScaleDimensionConfig: {
  BaseDimensionConfig
  min: int32
  max: int32
}@cuetsy(kind="interface")

// This is actually an empty interface used mainly for naming?
ColorDimensionConfig: {
  BaseDimensionConfig
  _empty: _
}@cuetsy(kind="interface")

TextDimensionMode: "fixed" | "field" | "template" @cuetsy(kind="enum")

TextDimensionConfig: {
  BaseDimensionConfig
  mode: TextDimensionMode
}@cuetsy(kind="interface")
