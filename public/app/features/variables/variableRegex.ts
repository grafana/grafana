// Kept apart from ./utils, which depends on the store and @grafana/runtime, so code that runs outside
// the browser (the transform sidecar) can use it.
export const variableRegex = /\$(\w+)|\[\[(\w+?)(?::(\w+))?\]\]|\${(\w+)(?:\.([^:^\}]+))?(?::([^\}]+))?}/g;
