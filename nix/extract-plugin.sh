#!/usr/bin/env bash
set -euo pipefail

id="$1"
archive="$2"
plugins_dir="$3"

staging=$(mktemp -d)
bsdtar --no-same-owner --no-same-permissions -xf "$archive" -C "$staging"

shopt -s dotglob nullglob
entries=("$staging"/*)
plugin="$staging/$id"
if [[ ${#entries[@]} -ne 1 || "${entries[0]}" != "$plugin" || ! -d "$plugin" ]]; then
  echo "Invalid archive: expected exactly one top-level directory named $id" >&2
  exit 1
fi

unsafe_entry=$(find "$plugin" \( ! -type d ! -type f -o -type f -links +1 \) -print -quit)
if [[ -n "$unsafe_entry" ]]; then
  echo "Invalid $id archive: expected only regular files and directories" >&2
  exit 1
fi

if ! jq -es --arg id "$id" 'length == 1 and .[0].id == $id' "$plugin/plugin.json" >/dev/null; then
  echo "Invalid archive: plugin.json must declare the ID $id" >&2
  exit 1
fi

mv "$plugin" "$plugins_dir/$id"
