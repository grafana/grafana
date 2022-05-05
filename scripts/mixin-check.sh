#!/bin/bash
set -eo pipefail

cd grafana-mixin
go install github.com/monitoring-mixins/mixtool/cmd/mixtool
go install github.com/google/go-jsonnet/cmd/jsonnetfmt
make lint build
