#!/bin/bash
set -eo pipefail

# For every package with a file with integration tag
# Integration tests must be run in serial
time for d in $(grep -l -R  '\+build integration' pkg/ | xargs dirname); do
  go test -tags=integration "./${d}/..."
done
