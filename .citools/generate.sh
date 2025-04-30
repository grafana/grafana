#!/bin/bash
set -euo pipefail

TOOLS_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

TOOL_CACHE="$TOOLS_DIR/.tool-cache"
TOOLS_MK="$TOOLS_DIR/Variables.mk"

mkdir -p "$TOOL_CACHE"

echo "# Generated tool paths" > "$TOOLS_MK"

for tooldir in "$TOOLS_DIR"/src/*; do
  [ -d "$tooldir" ] || continue
  tool=$(basename "$tooldir")
  fqtn=$(awk '/^tool / { print $2 }' "$tooldir/go.mod")
  cache_file="$TOOL_CACHE/${tool}.path"

  cat <<EOF >> "$TOOLS_MK"

# Tool: $tool
${tool} = \$(shell \\
  if [ ! -f $cache_file ]; then \\
    (cd $tooldir && GOWORK=off go tool -n $fqtn > $cache_file); \\
  fi; \\
  cat $cache_file \\
)
EOF
done

