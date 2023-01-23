package common

// The JSON transfer object for DataFrames. Values are stored in simple JSON
DataFrameJSON: {
   // The schema defines the field type and configuration.
  schema?: DataFrameSchema
   // The field data
  data?: DataFrameData
} @cuetsy(kind="interface")

FieldValues: [...] @cuetsy(kind="type")

DataFrameData: {
   // A columnar store that matches fields defined by schema.
  values: [...FieldValues]

   // Since JSON cannot encode NaN, Inf, -Inf, and undefined, these entities
   // are decoded after JSON.parse() using this struct
   // TODO | null
  entities?: [...FieldValueEntityLookup]

   // Holds value bases per field so we can encode numbers from fixed points
   // e.g. [1612900958, 1612900959, 1612900960] -> 1612900958 + [0, 1, 2]
  bases?: [...int64]

   // Holds value multipliers per field so we can encode large numbers concisely
   // e.g. [4900000000, 35000000000] -> 1e9 + [4.9, 35]
  factors?: [...int64]

   // Holds enums per field so we can encode recurring string values as ints
   // e.g. ["foo", "foo", "baz", "foo"] -> ["foo", "baz"] + [0,0,1,0]
   // NOTE: currently only decoding is implemented
   // TODO | null
  enums?: [...[...string]]
} @cuetsy(kind="interface")

// Since JSON cannot encode NaN, Inf, -Inf, and undefined, the locations
// of these entities in field value arrays are stored here for restoration
// after JSON.parse()
FieldValueEntityLookup: {
  NaN?: [...int64]
  // Missing because of absence or join
  Undef?: [...int64]
  Inf?: [...int64]
  NegInf?: [...int64]
} @cuetsy(kind="interface")

DataFrameSchema: {
  // Matches the query target refId
  refId?: string
  // Initial response global metadata
  meta?: QueryResultMeta
  // Frame name
  name?: string
  // Field definition without any metadata
  fields: [...FieldSchema]
} @cuetsy(kind="interface")

FieldSchema: {
	// The column name
  name: string
  type?: FieldType
  config?: FieldConfig
  labels?: Labels
} @cuetsy(kind="interface")
