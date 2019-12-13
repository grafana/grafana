#!/bin/bash

# shellcheck source=./scripts/helpers/exit-if-fail.sh
source "$(dirname "$0")/helpers/exit-if-fail.sh"

export GRAFANA_TEST_DB=mysql

time for d in $(go list ./pkg/...); do
  exit_if_fail go test -tags=integration "$d"
done
