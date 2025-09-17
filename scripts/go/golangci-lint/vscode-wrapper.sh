#!/bin/bash

set -euo pipefail

# Change to project root (3 levels up from scripts/go/golangci-lint/)
pushd "$(dirname "$0")/../../.." > /dev/null

# Use the same compile_tool approach as the Makefile
tools_dir=".citools"
src_dir="${tools_dir}/src"

# Compile and get the golangci-lint binary path using the same method as Variables.mk
golangci_lint_binary=$(cd "${src_dir}/golangci-lint" && GOWORK=off go tool -n github.com/grafana/grafana/scripts/go/golangci-lint/cmd/golangci-lint > /dev/null && GOWORK=off go tool -n github.com/grafana/grafana/scripts/go/golangci-lint/cmd/golangci-lint | sed 's/^[[:space:]]*//g')

# change back to the original directory
popd > /dev/null

# Run the custom golangci-lint with VS Code's arguments
# This preserves VS Code's ability to lint specific files/packages
exec "${golangci_lint_binary}" "$@" --enable wirecheck