package common

LogsSortOrder:     "Descending" | "Ascending"                 @cuetsy(kind="enum")
LogsDedupStrategy: "none" | "exact" | "numbers" | "signature" @cuetsy(kind="enum",memberNames="none|exact|numbers|signature")
