#!/usr/bin/env bash
#
# Deletes every tarball in the artifacts folder whose name@version is already on the npm
# registry, so the validate and publish scripts only see packages that still need publishing.
# Fails on prerelease versions because the publish workflow always uses the latest dist-tag.
#
# Usage: select-unpublished-npm-packages.sh [artifacts-dir] [registry]

set -euo pipefail

ARTIFACTS_DIR="${1:-./npm-artifacts}"
REGISTRY="${2:-https://registry.npmjs.org/}"

shopt -s nullglob
for file in "$ARTIFACTS_DIR"/*.tgz; do
  manifest=$(tar -xzOf "$file" package/package.json)
  name=$(jq -r .name <<<"$manifest")
  version=$(jq -r .version <<<"$manifest")

  if [[ "$version" == *-* ]]; then
    echo "::error::$name@$version is a prerelease, but this workflow publishes stable versions to the latest dist-tag only."
    exit 1
  fi

  if output=$(npm view "$name@$version" version --registry "$REGISTRY" 2>&1); then
    echo "$name@$version is already published, skipping."
    rm "$file"
  elif grep -q 'E404' <<<"$output"; then
    echo "$name@$version is not published yet."
  else
    echo "::error::Could not check whether $name@$version is published:"
    echo "$output"
    exit 1
  fi
done
