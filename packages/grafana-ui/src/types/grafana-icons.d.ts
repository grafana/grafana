// Ambient types for @grafana/icons' per-icon subpaths.
//
// The package's `exports` map has no `types` condition for its `./*` subpath, so
// TypeScript can't resolve `@grafana/icons/Plus` on its own. Declaring the
// subpaths as re-exporting the barrel's types keeps the generated loaders in
// components/Icon/iconLoaders.gen.ts type-safe without any assertions.
//
// The `./*` subpath itself comes from a local Yarn patch. Both the patch and this
// declaration go away once upstream ships typed per-icon subpath exports.
declare module '@grafana/icons/*' {
  export * from '@grafana/icons';
}
