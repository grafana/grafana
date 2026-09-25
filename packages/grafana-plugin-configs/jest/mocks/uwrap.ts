// uwrap ships only an ESM "module" entry (no "main"/"exports"), which Jest's
// resolver cannot load. It is only used by TableNG deep in @grafana/ui, so an
// inert stub is enough for plugin tests.
export const varPreLine = () => ({
  count: () => 1,
  each: () => {},
  split: () => [],
  test: () => false,
});
