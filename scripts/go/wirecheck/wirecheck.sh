#!/bin/bash

set -euo pipefail

WIRE_CHECK_DIR="$(dirname "${BASH_SOURCE[0]}")"

pushd "${WIRE_CHECK_DIR}" && GOWORK=off go build -o wirecheck ./cmd/wirechecker && popd

exec "${WIRE_CHECK_DIR}/wirecheck" "$@"