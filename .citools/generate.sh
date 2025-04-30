#!/bin/bash
set -e

TOOLS_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "$TOOLS_DIR"

TOOL_CACHE="$TOOLS_DIR/.tool-cache"
TOOLS_MK="$TOOLS_DIR/Variables.mk"

mkdir -p "$TOOL_CACHE"

echo "# Generated tool paths" > "$TOOLS_MK"

for tooldir in $TOOLS_DIR/src/*; do
  [ -d "$tooldir" ] || continue
  tool=$(basename "$tooldir")
  fqtn=$(awk '/^tool / { print $2 }' "$tooldir/go.mod")
  cache_file="$TOOL_CACHE/${tool}.path"

  echo "" >> "$TOOLS_MK"
  echo "# Tool: $tool" >> "$TOOLS_MK"
  echo "${tool} := \$(shell \\" >> "$TOOLS_MK"
  echo "  if [ ! -f $cache_file ]; then \\" >> "$TOOLS_MK"
  echo "    (cd $tooldir && GOWORK=off go tool -n $fqtn > $cache_file); \\" >> "$TOOLS_MK"
  echo "  fi; \\" >> "$TOOLS_MK"
  echo "  cat $cache_file \\" >> "$TOOLS_MK"
  echo ")" >> "$TOOLS_MK"
done
