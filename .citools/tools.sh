#!/bin/bash
# Usage:
#   ./.citools/tools.sh <tool_name> [args...]
#   ./.citools/tools.sh install <import_path>@<version>

set -e
set -o xtrace
set -euo pipefail

TOOLZ_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Create temporary directory
TMP_DIR=$(mktemp -d)
TMP_RUNNER=${TMP_DIR}/runner

# Ensure cleanup on exit or error
cleanup() {
  rm -rf "$TMP_DIR"
}
trap cleanup EXIT

# Example usage
echo "Temporary directory: $TMP_DIR"

echo "running command: $@"
echo "BASH SOURCE: ${BASH_SOURCE[0]}"
echo "TOOL DIR $TOOLZ_DIR"

cp -r .citools/runner "$TMP_RUNNER"
ls "$TMP_RUNNER"

cd "$TMP_RUNNER"


function install_tool() {
  IMPORT_PATH_WITH_VER="$1"

  if [[ "$IMPORT_PATH_WITH_VER" != *"@"* ]]; then
    echo "Error: tool version must be specified (e.g., github.com/foo/bar@v1.2.3)"
    exit 1
  fi

  TOOL_PATH="${IMPORT_PATH_WITH_VER%@*}"
  TOOL_NAME="${TOOL_PATH##*/}"

  TOOL_DIR="$TOOLZ_DIR/$TOOL_NAME"
  MOD_FILE="$TOOL_DIR/go.mod"

  mkdir -p "$TOOL_DIR"
  cd "$TOOL_DIR"

  # Create a new module if go.mod doesn't exist
  if [ ! -f go.mod ]; then
    go mod init "$TOOL_NAME"
  fi

  go get -tool --modfile="$MOD_FILE" "$IMPORT_PATH_WITH_VER"
  echo "Installed $TOOL_NAME into $TOOL_DIR"
}

function run_tool() {
  TOOL_NAME="$1"
  shift

  TOOL_DIR="$TOOLZ_DIR/$TOOL_NAME"

  MOD_FILE="$TOOL_DIR/go.mod"

  if [ ! -f "$MOD_FILE" ]; then
    echo "Error: go.mod not found in $TOOL_NAME"
    exit 1
  fi

#  cd "$TOOL_DIR"

  echo "@@@@@@@@@@"
  pwd
  go tool -modfile=$MOD_FILE -n
  echo "@@@@@@@@@@"

  # Run the Go tool with the specific modfile
  go tool -modfile="$MOD_FILE" "$TOOL_NAME" "$@"
}

if [ "$1" == "install" ]; then
  shift
  install_tool "$@"
  exit 0
fi

run_tool "$@"
