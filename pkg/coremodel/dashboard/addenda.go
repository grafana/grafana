package dashboard

// HandoffSchemaVersion is the minimum schemaVersion for dashboards at which the
// Thema-based dashboard schema is possibly valid
//
// schemaVersion is the original version numbering system for dashboards. If a
// dashboard is below this schemaVersion, it is necessary for the frontend
// typescript dashboard migration logic to first run and get it past this
// number, after which Thema can take over.
const HandoffSchemaVersion = 36
