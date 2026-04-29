#!/bin/bash

# Generate app_manifests.go file

set -e

# Use gawk if available, otherwise fall back to awk
if command -v gawk &> /dev/null; then
    AWK=gawk
else
    AWK=awk
fi

OUTPUT_FILE="pkg/storage/unified/resource/app_manifests.go"
TEMP_FILE=$(mktemp)

# Find all paths and store them
find apps -name '*.go' 2>/dev/null | \
  xargs grep -l 'func LocalManifest() app.Manifest' 2>/dev/null | \
  $AWK '{
    path = $1
    sub(/\/[^\/]+\.go$/, "", path)
    if (match(path, /^apps\/(.+)\/pkg/, arr)) {
      print path
    }
  }' | sort > "$TEMP_FILE"

# Start generating the file
cat > "$OUTPUT_FILE" << 'HEADER'
package resource

//go:generate sh -c "cd ../../../.. && bash pkg/storage/unified/resource/generate_manifests.sh"

import (
	"github.com/grafana/grafana-app-sdk/app"

HEADER

# Generate imports with duplicate handling
$AWK '{
  path = $1
  if (match(path, /^apps\/(.+)\/pkg/, arr)) {
    app = arr[1]
    pkg = app
    gsub("/", "_", pkg)

    # Handle duplicates by adding numeric suffix
    if (pkg in seen) {
      suffix = seen[pkg]
      seen[pkg] = suffix + 1
      pkg = pkg suffix
    } else {
      seen[pkg] = 1
    }

    # Store the mapping for later use in function calls
    pkg_map[path] = pkg

    print "\t" pkg " \"github.com/grafana/grafana/" path "\""
  }
}' "$TEMP_FILE" >> "$OUTPUT_FILE"

# Close imports and start function
cat >> "$OUTPUT_FILE" << 'MIDDLE'
)

func AppManifests() []app.Manifest {
	// TODO: don't use hardcoded list of manifests when possible.
	return []app.Manifest{
MIDDLE

# Generate manifest calls with same duplicate handling
$AWK '{
  path = $1
  if (match(path, /^apps\/(.+)\/pkg/, arr)) {
    app = arr[1]
    pkg = app
    gsub("/", "_", pkg)

    # Handle duplicates by adding numeric suffix (same logic as above)
    if (pkg in seen) {
      suffix = seen[pkg]
      seen[pkg] = suffix + 1
      pkg = pkg suffix
    } else {
      seen[pkg] = 1
    }

    print "\t\t" pkg ".LocalManifest(),"
  }
}' "$TEMP_FILE" >> "$OUTPUT_FILE"

# Close function
cat >> "$OUTPUT_FILE" << 'FOOTER'
	}
}
FOOTER

rm -f "$TEMP_FILE"

echo "Generated $OUTPUT_FILE"
