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

# generate the code with:
# --output-base    because this script should also be able to run inside the vendor dir of
#                  k8s.io/kubernetes. The output-base is needed for the generators to output into the vendor dir
#                  instead of the $GOPATH directly. For normal projects this can be dropped.

kube::codegen::gen_helpers \
    --input-pkg-root github.com/grafana/grafana/pkg/apis \
    --output-base "${OUTDIR}" \
    --boilerplate "${SCRIPT_ROOT}/hack/boilerplate.go.txt"


if [[ -n "${API_KNOWN_VIOLATIONS_DIR:-}" ]]; then
    report_filename="${API_KNOWN_VIOLATIONS_DIR}/grafana_grafana_violation_exceptions.list"
    if [[ "${UPDATE_API_KNOWN_VIOLATIONS:-}" == "true" ]]; then
        update_report="--update-report"
    fi
fi

for api_pkg in $(ls ./pkg/apis); do
  for pkg_version in $(ls ./pkg/apis/${api_pkg}); do
    ## NOTE: we name the packages after the pkg_version, so that they match the expectations on being moved
    ## In the intermediate directory, it looks like a nested path - omitted/paths/${pkg_version}/${pkg_version}
    ## This is a necessary albeit unintuitive path but we can live with it, since its in a temporary dir structure
    echo "Generating openapi package for ${api_pkg}, version=${pkg_version} ..."
    kube::codegen::gen_openapi \
      --input-pkg-root github.com/grafana/grafana/pkg/apis/${api_pkg}/${pkg_version} \
      --output-pkg-root github.com/grafana/grafana/pkg/generated/${api_pkg}/${pkg_version} \
      --openapi-name ${pkg_version} \
      --output-base "${OUTDIR}" \
      --report-filename "${report_filename:-"/dev/null"}" \
      ${update_report:+"${update_report}"} \
      --boilerplate "${SCRIPT_ROOT}/hack/boilerplate.go.txt"
    mv pkg/generated/${api_pkg}/${pkg_version}/${pkg_version}/zz_generated.openapi.go  pkg/apis/${api_pkg}/${pkg_version}/
  done
done

exit 1

kube::codegen::gen_client \
    --with-watch \
    --with-applyconfig \
    --input-pkg-root github.com/grafana/grafana/pkg/apis \
    --output-pkg-root github.com/grafana/grafana/pkg/generated \
    --output-base "${OUTDIR}" \
    --boilerplate "${SCRIPT_ROOT}/hack/boilerplate.go.txt"
