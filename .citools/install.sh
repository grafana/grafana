#!/bin/bash
# Usage:
#   ./.citools/tools.sh <tool_name> [args...]
#   ./.citools/tools.sh install <import_path>@<version>

set -e
set -o xtrace
set -euo pipefail

TOOLS_BASE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TOOLS_SRC_DIR="$TOOLS_BASE_DIR/src"


# Ensure cleanup on exit or error
cleanup() {
  rm -rf "$TMP_DIR"
}
trap cleanup EXIT

echo "Running command: $@"
echo "TOOL DIR $TOOLS_SRC_DIR/src"

IMPORT_PATH_WITH_VERSION="$1"

if [[ "$IMPORT_PATH_WITH_VERSION" != *"@"* ]]; then
  echo "Error: tool version must be specified (e.g., github.com/foo/bar@v1.2.3)"
  exit 1
fi

TOOL_PATH="${IMPORT_PATH_WITH_VERSION%@*}"
TOOL_NAME="${TOOL_PATH##*/}"

TOOL_DIR="$TOOLS_SRC_DIR/$TOOL_NAME"
MOD_FILE="$TOOL_DIR/go.mod"

mkdir -p "$TOOL_DIR"
cd "$TOOL_DIR"

  # Create a new module if go.mod doesn't exist
if [ ! -f go.mod ]; then
  go mod init "$TOOL_NAME"
fi

go get -tool --modfile="$MOD_FILE" "$IMPORT_PATH_WITH_VERSION"
echo "Installed $TOOL_NAME into $TOOL_DIR"

exec "$TOOLS_BASE_DIR/generate.sh"
