#!/usr/bin/env bash
# Regenerate the committed plugin artifacts from scratch: scaffold three plugins
# with @grafana/create-plugin (defaults kept), install, build, package each into
# zips/<id>.zip, and copy each plugin's real plugin.json to meta/<id>.json. Only
# zips/ and meta/ are committed — the scaffolded sources are transient, and the
# server reads catalog metadata from meta/ (no zip parsing).
#
# Requires network. Everything runs in a throwaway temp dir OUTSIDE the monorepo:
# running yarn inside the repo tree makes it resolve — and rewrite — the repo-root
# .yarnrc.yml (stripping its security comments, adding approvedGitRepositories).
set -euo pipefail

here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
zips_dir="$here/zips"
meta_dir="$here/meta"

# name:type pairs. @grafana/create-plugin derives the id as grafana-<name>-<type>
# and strips a trailing "app"/"panel" from the name (pocapp -> grafana-poc-app).
specs=("pocapp:app" "pocpanel:panel" "pocds:datasource")

work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT

mkdir -p "$zips_dir" "$meta_dir"
rm -f "$zips_dir"/*.zip "$meta_dir"/*.json

for spec in "${specs[@]}"; do
  name="${spec%%:*}"
  type="${spec##*:}"
  echo "==> scaffolding grafana-$name-$type"

  # Scaffold into an empty parent; create-plugin makes a single subdir named
  # after the derived plugin id. npx runs the generator without depending on the
  # repo's yarn resolution (we are outside the repo tree here on purpose).
  parent="$work/$name"
  mkdir -p "$parent"
  (cd "$parent" && npx -y @grafana/create-plugin@latest \
    --plugin-name="$name" --org-name='grafana' --plugin-type="$type" --no-backend)

  plugin_dir="$(find "$parent" -mindepth 1 -maxdepth 1 -type d | head -1)"
  id="$(basename "$plugin_dir")"
  echo "    building $id"

  (
    cd "$plugin_dir"
    # Own lockfile + own rc so any settings yarn writes land here (thrown away),
    # never in a shared config. The plugin's package.json pins the yarn version.
    : >yarn.lock
    [ -f .yarnrc.yml ] || printf 'nodeLinker: node-modules\n' >.yarnrc.yml
    yarn install
    yarn build
  )

  # Grafana's installer expects the archive to contain a single top-level dir
  # named after the plugin id (grafana.com convention); it rewrites the first
  # path segment to the id on extract (pkg/plugins/storage/fs.go).
  stage="$work/$id-zip"
  mkdir -p "$stage"
  cp -R "$plugin_dir/dist" "$stage/$id"
  (cd "$stage" && zip -qr "$zips_dir/$id.zip" "$id")

  # Extract the real, unmodified plugin.json for the server to read as metadata.
  cp "$plugin_dir/dist/plugin.json" "$meta_dir/$id.json"
  echo "    wrote zips/$id.zip + meta/$id.json"
done

echo "done — $(ls "$zips_dir"/*.zip | wc -l | tr -d ' ') plugins"
