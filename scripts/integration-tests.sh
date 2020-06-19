#!/bin/bash
set -eo pipefail

# Integration tests must be run in serial
time for d in $(go list ./pkg/...); do
  go test -tags=integration "$d"
done
