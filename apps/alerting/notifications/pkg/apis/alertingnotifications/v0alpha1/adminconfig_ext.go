package v0alpha1

// AdminConfigSingletonName is the only allowed name for an AdminConfig
// resource. AdminConfig is a per-org singleton, so it always lives at this
// name within the org's namespace. The admission validator rejects any other
// name, and the sync worker reads/writes the resource at this name.
const AdminConfigSingletonName = "default"
