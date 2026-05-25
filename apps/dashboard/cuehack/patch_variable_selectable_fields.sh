#!/usr/bin/env bash
set -euo pipefail

manifest_path="${1:-./pkg/apis/dashboard_manifest.go}"

tmp_file="$(mktemp)"
trap 'rm -f "$tmp_file"' EXIT

awk '
BEGIN { patched = 0 }
{
  print $0

  if (!patched && $0 ~ /Schema: &versionSchemaVariablev2beta1,/) {
    if (getline nextline > 0) {
      if (nextline ~ /^[[:space:]]*SelectableFields: \[\]string\{/) {
        print nextline
      } else {
        print "\t\t\t\t\tSelectableFields: []string{"
        print "\t\t\t\t\t\t\"spec.spec.name\","
        print "\t\t\t\t\t},"
        print nextline
      }
      patched = 1
    }
  }
}
' "$manifest_path" > "$tmp_file"

mv "$tmp_file" "$manifest_path"
