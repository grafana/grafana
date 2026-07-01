#!/usr/bin/env bash
# Estimate the npm packument size for the published @grafana/* packages.
#
# The packument is the single JSON metadata document the registry stores per package
# (GET https://registry.npmjs.org/<pkg>). Its byte size is what hits the registry's
# hard cap, and it grows with every published version. Packages with larger per-version
# package.json (more deps) grow faster and hit the cap at fewer versions.
#
# Usage: scripts/estimate-npm-packument-size.sh [package ...]
#   With no arguments, discovers the non-private packages under ./packages.
set -euo pipefail

pkgs=("$@")
if [ ${#pkgs[@]} -eq 0 ]; then
  # Resolve ./packages relative to this script so it works from any cwd.
  root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
  while IFS= read -r name; do
    pkgs+=("$name")
  done < <(
    for manifest in "$root"/packages/*/package.json; do
      [ -f "$manifest" ] || continue
      # Emit the name only for packages that are not marked private.
      jq -r 'select((.private // false) != true) | .name // empty' "$manifest"
    done | sort
  )
  if [ ${#pkgs[@]} -eq 0 ]; then
    echo "No non-private packages found under $root/packages" >&2
    exit 1
  fi
fi

human() {
  if command -v numfmt >/dev/null 2>&1; then
    numfmt --to=iec "$1"
  else
    echo "${1}B"
  fi
}

{
  printf '%-28s %10s %10s %12s\n' "package" "versions" "size" "avg/ver"
  for pkg in "${pkgs[@]}"; do
    enc=${pkg/\//%2F} # @grafana/ui -> @grafana%2Fui
    # Full packument. Deliberately NOT --compressed: we want the uncompressed document
    # size the registry stores, which is what the cap applies to.
    if ! doc=$(curl -sf "https://registry.npmjs.org/$enc"); then
      printf '%-28s %10s\n' "$pkg" "ERR"
      continue
    fi
    bytes=$(printf '%s' "$doc" | wc -c | tr -d ' ')
    vers=$(printf '%s' "$doc" | jq '.versions | length')
    avg=$(( vers > 0 ? bytes / vers : 0 ))
    printf '%-28s %10s %10s %12s\n' "$pkg" "$vers" "$(human "$bytes")" "$(human "$avg")"
  done
} | (read -r header; echo "$header"; sort -k3 -h -r)
