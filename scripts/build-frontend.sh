#!/usr/bin/env bash
# Builds the frontend and assembles everything Grafana serves from its static
# root into dist/frontend. Packaging copies that directory to public/ as is, so
# the result must not depend on anything else in the checkout.
set -euo pipefail

cd "$(dirname "${BASH_SOURCE[0]}")/.."

BUILD_SCRIPT="${FRONTEND_BUILD_SCRIPT:-build}"

fail() {
  echo "error: $*" >&2
  exit 1
}

# Nx builds the themes, every decoupled plugin, then the app, swagger and boot bundles.
rm -rf public/build public/build-swagger
pnpm run "$BUILD_SCRIPT"

# Assemble in a scratch directory and publish it only once it is complete.
mkdir -p dist
STAGE="$(mktemp -d dist/.frontend.XXXXXX)"
trap 'rm -rf "$STAGE"' EXIT

cp -RL public/build public/build-swagger public/views public/emails public/fonts public/img public/maps public/gazetteer public/dashboards "$STAGE/"
cp public/robots.txt public/openapi3.json public/api-merged.json "$STAGE/"

# The server discovers plugins by walking public/app/plugins/{datasource,panel}
# for plugin.json files and serves each plugin directory at public/plugins/<id>/.
#
# Core plugins are compiled into public/build. Only plugin.json and the files it
# refers to (logos, README, bundled dashboards) are served from their directory.
#
# Decoupled plugins have a package.json and compile to dist/, which already
# contains plugin.json and its resources. The server uses dist/ when present.
for plugin in public/app/plugins/*/*/; do
  [ -f "$plugin/plugin.json" ] || continue

  dest="$STAGE/app/plugins/${plugin#public/app/plugins/}"
  mkdir -p "$dest"

  if [ -f "$plugin/package.json" ]; then
    cp -RL "$plugin/dist" "$dest/dist"

    # `make build-plugin-go` writes per-architecture backend binaries (`executable` in
    # plugin.json is gpx_<name>) and the SDK build manifest into dist/. Not frontend assets.
    rm -f "$dest"/dist/gpx_* "$dest"/dist/go_plugin_build_manifest

    if [ ! -s "$dest/dist/module.js" ] || [ ! -s "$dest/dist/plugin.json" ]; then
      fail "$plugin did not build a complete dist/"
    fi
  else
    for file in plugin.json README.md img dashboards; do
      if [ -e "$plugin/$file" ]; then
        cp -RL "$plugin/$file" "$dest/"
      fi
    done
  fi
done

for required in build/boot.js build/assets-manifest.json build-swagger/assets-manifest.json; do
  [ -s "$STAGE/$required" ] || fail "frontend build did not produce $required"
done

rm -rf dist/frontend
mv "$STAGE" dist/frontend
trap - EXIT
echo "frontend assembled in dist/frontend"
