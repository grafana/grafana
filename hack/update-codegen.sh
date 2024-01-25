#!/usr/bin/env bash

# Copyright 2017 The Kubernetes Authors.
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#     http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

set -o errexit
set -o nounset
set -o pipefail

SCRIPT_ROOT=$(dirname "${BASH_SOURCE[0]}")/..
CODEGEN_PKG=${CODEGEN_PKG:-$(cd "${SCRIPT_ROOT}"; ls -d -1 ./vendor/k8s.io/code-generator 2>/dev/null || echo $GOPATH/pkg/mod/k8s.io/code-generator@v0.29.1)}

OUTDIR="${HOME}/go/src"

source "${CODEGEN_PKG}/kube_codegen.sh"
source "$(dirname "${BASH_SOURCE[0]}")/openapi-codegen.sh"

kube::codegen::gen_helpers \
    --input-pkg-root github.com/grafana/grafana/pkg/apis \
    --output-base "${OUTDIR}" \
    --boilerplate "${SCRIPT_ROOT}/hack/boilerplate.go.txt"


if [[ "${UPDATE_API_KNOWN_VIOLATIONS:-}" == "true" ]]; then
    update_report="--update-report"
fi

for api_pkg in $(ls ./pkg/apis); do
  for pkg_version in $(ls ./pkg/apis/${api_pkg}); do
    echo "Generating openapi package for ${api_pkg}, version=${pkg_version} ..."
    grafana::codegen::gen_openapi \
      --input-pkg-single github.com/grafana/grafana/pkg/apis/${api_pkg}/${pkg_version} \
      --output-base "${OUTDIR}" \
      --report-filename "openapi_violation_exceptions.list" \
      ${update_report:+"${update_report}"} \
      --boilerplate "${SCRIPT_ROOT}/hack/boilerplate.go.txt"
  done
done

kube::codegen::gen_client \
    --with-watch \
    --with-applyconfig \
    --input-pkg-root github.com/grafana/grafana/pkg/apis \
    --output-pkg-root github.com/grafana/grafana/pkg/generated \
    --output-base "${OUTDIR}" \
    --boilerplate "${SCRIPT_ROOT}/hack/boilerplate.go.txt"
