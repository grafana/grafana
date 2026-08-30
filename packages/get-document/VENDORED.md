# Vendored package

This package was vendored from an upstream open-source repo to avoid using
`github:` resolutions in the root `package.json` (a supply-chain risk).

## Source

- Upstream: https://github.com/webmodules/get-document
- Commit: `a04ccb499d6e0433a368c3bb150b4899b698461f`

## Why vendored

`get-document` is pulled in transitively by `get-window@1.1.2`, which
declares `npm:1`. The registry tarball ships without a LICENSE file (the
upstream LICENSE was added in the very commit we vendor from), which
previously motivated a `github:` resolution. To remove the `github:`
indirection, we vendor the source here and serve it via a `workspace:*`
resolution.

Upstream is effectively abandoned, no commits since 2017 (the LICENSE commit we vendor here is the latest on `master`) and no npm publish since `1.0.0` in January 2015.

## Syncing from upstream

If/when upstream releases a relevant fix:

1. `git clone https://github.com/webmodules/get-document.git && git checkout <new-sha>`
2. Diff against this directory; apply matching changes.
3. Bump `version` in `package.json` (e.g. `1.0.0-grafana.1`).
4. Update the commit SHA above.
5. Run `rm -rf node_modules && yarn install`, then `yarn typecheck:tsgo`
   and `yarn jest --no-watch --testPathPattern='public/app/features/explore'`
   to confirm the consumer (`get-window` via slate-era editor code)
   still works.
