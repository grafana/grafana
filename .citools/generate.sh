
#!/bin/bash
set -euo pipefail

TOOLS_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

TOOLS_CACHE_DIR="$TOOLS_DIR/.tool-cache"
TOOLS_SRC_DIR="$TOOLS_DIR/src"
TOOLS_MK="$TOOLS_DIR/Variables.mk"

mkdir -p "$TOOLS_CACHE_DIR"
echo "# Generated tool paths" > "$TOOLS_MK"

cat <<'EOL' >> "$TOOLS_MK"
tools_dir := $(shell cd $(dir $(lastword $(MAKEFILE_LIST))) && pwd)
tools_cache_dir := $(tools_dir)/.tool-cache
src_dir := $(tools_dir)/src

define compile_tool
$(shell \
  if [ ! -d $(tools_cache_dir) ]; then \
    mkdir -p $(tools_cache_dir); \
  fi; \
  if [ ! -f $(tools_cache_dir)/$(1).path ]; then \
    (cd $(src_dir)/$(1) && GOWORK=off go tool -n $(2) > $(tools_cache_dir)/$(1).path); \
  fi; \
  cat $(tools_cache_dir)/$(1).path | sed 's/^[[:space:]]*//g' \
)
endef

EOL

for tooldir in "$TOOLS_SRC_DIR"/*; do
  [ -d "$tooldir" ] || continue
  tool=$(basename "$tooldir")
  fqtn=$(awk '/^tool / { print $2 }' "$tooldir/go.mod")

  cat <<EOL >> $TOOLS_MK

# Tool: "$tool"
${tool} = "\$(call compile_tool,${tool},${fqtn})"
EOL
done
