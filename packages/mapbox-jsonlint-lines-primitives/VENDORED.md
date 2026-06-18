# Vendored package

This package was vendored from an upstream open-source repo to avoid using
`github:` resolutions in the root `package.json` (a supply-chain risk).

## Source

- Upstream: https://github.com/mapbox/jsonlint
- Commit: `e31b7289baedf3e1000d7ae7edd42268212c9954`

## Why vendored

`@mapbox/jsonlint-lines-primitives` is pulled in transitively by
`@maplibre/maplibre-gl-style-spec`, which declares `~2.0.2`. The npm
registry tarball for `2.0.2` (published August 2018) ships without a
`LICENSE` file and without a `license` field in `package.json`, which
previously motivated a `github:` resolution. To remove the `github:`
indirection, we vendor the source here and serve it via a `workspace:*`
resolution.

There's been no new npm publish in 8 years, so the registry artefact
isn't moving. The upstream GitHub repo was dormant from 2018 until
March 2026 when mapbox revived it on a new default branch
`release-mapbox-scoped` (toolchain modernization, a `LICENSE` file,
and a `license` field in `package.json`) — but those commits post-date
the last npm publish and aren't reachable through the maplibre
dependency chain.

The upstream repo has no `LICENSE` file at the pinned commit — the MIT
terms appear only inside `README.md`. Our `LICENSE` reproduces those
MIT terms with the upstream copyright holder (`Zachary Carter, 2012`).
By coincidence the synthesized text matches the LICENSE upstream
eventually added in March 2026 (same MIT wording, same copyright
holder; only the `(c)` vs `(C)` casing differs).

## Syncing from upstream

Only relevant if `@maplibre/...` ever bumps past `~2.0.2` and a new
matching release is published. Until then, this package is frozen at
the pinned commit. To sync:

1. `git clone https://github.com/mapbox/jsonlint.git && git checkout <new-sha>`
2. Diff against this directory; apply matching changes under `lib/`.
3. Bump `version` in `package.json` (e.g. `2.0.2-grafana.1`).
4. Update the commit SHA above.
5. Run `rm -rf node_modules && pnpm install`, then `yarn typecheck:tsgo`
   and `pnpm exec jest --no-watch --testPathPattern='public/app/plugins/panel/geomap'`
   to confirm the consumer (`@maplibre/maplibre-gl-style-spec`) still works.
