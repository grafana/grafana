#!/bin/bash
# Usage:
#   ./.citools/tool.sh <tool_name> [args...]
#   ./.citools/tool.sh install <import_path>@<version>

set -e
TOOLZ_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

function install_tool() {
  IMPORT_PATH_WITH_VER="$1"

  if [[ "$IMPORT_PATH_WITH_VER" != *"@"* ]]; then
    echo "Error: version must be specified (e.g., github.com/foo/bar@v1.2.3)"
    exit 1
  fi

  TOOL_PATH="${IMPORT_PATH_WITH_VER%@*}"
  TOOL_VERSION="${IMPORT_PATH_WITH_VER##*@}"
  TOOL_NAME="${TOOL_PATH##*/}"


  echo "PATH $TOOL_PATH"
  echo "VER $TOOL_VERSION"
  echo "NAME $TOOL_NAME"

  TOOL_DIR="$TOOLZ_DIR/$TOOL_NAME"
  MOD_FILE="$TOOL_DIR/go.mod"

  mkdir -p "$TOOL_DIR"
  cd "$TOOL_DIR"

  # Create a new module if go.mod doesn't exist
  if [ ! -f go.mod ]; then
    go mod init "$TOOL_NAME"
  fi

  # Install the tool using -tool to avoid adding requirements to your main go.work/go.mod
  go get -tool --modfile="$MOD_FILE" "$IMPORT_PATH_WITH_VER"
  echo "Installed $TOOL_NAME into $TOOL_DIR"
}

# Main logic
if [ "$1" == "install" ]; then
  shift
  install_tool "$@"
  exit 0
fi


TOOL_NAME="$1"
shift

MODFILE="$TOOLZ_DIR/$TOOL_NAME/go.mod"

if [ ! -f "$MODFILE" ]; then
  echo "Error: go.mod not found in $TOOL_NAME"
  exit 1
fi

# Run the Go tool with the specific modfile
GOWORK=off go tool -modfile="$MODFILE" "$TOOL_NAME" "$@"
