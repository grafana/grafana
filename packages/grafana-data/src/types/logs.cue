package grafanaschema

LogsSortOrder: {
  Descending: "Descending",
  Ascending: "Ascending",
} @cuetsy(targetType="enum")


LogsDedupStrategy: {
  none: "none",
  exact: "exact",
  numbers: "numbers",
  signature: "signature",
} @cuetsy(targetType="enum")

