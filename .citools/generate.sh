#!/bin/bash
set -euo pipefail

TOOLS_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

TOOL_CACHE="$TOOLS_DIR/.tool-cache"
TOOLS_MK="$TOOLS_DIR/Variables.mk"

mkdir -p "$TOOL_CACHE"

# Write dynamic Makefile variables
cat <<'EOF' > "$TOOLS_MK"
TOOLS_DIR := $(shell cd $(dir $(lastword $(MAKEFILE_LIST))) && pwd)
TOOL_SRC_DIR := $(TOOLS_DIR)/src
TOOL_CACHE := $(TOOLS_DIR)/.tool-cache
EOF

echo "# Generated tool paths" >> "$TOOLS_MK"

for tooldir in "$TOOLS_DIR"/src/*; do
  [ -d "$tooldir" ] || continue
  tool=$(basename "$tooldir")
  fqtn=$(awk '/^tool / { print $2 }' "$tooldir/go.mod")

  cat <<EOF >> "$TOOLS_MK"

# Tool: $tool
${tool} = \$(shell \\
  if [ ! -f \$(TOOL_CACHE)/${tool}.path ]; then \\
    (cd \$(TOOL_SRC_DIR)/${tool} && GOWORK=off go tool -n ${fqtn} > \$(TOOL_CACHE)/${tool}.path); \\
  fi; \\
  cat \$(TOOL_CACHE)/${tool}.path \\
)
EOF
done

