#!/usr/bin/env bash

# SPDX-License-Identifier: AGPL-3.0-only
# Provenance-includes-location: https://github.com/kubernetes/sample-apiserver/blob/master/hack/update-codegen.sh
# Provenance-includes-license: Apache-2.0
# Provenance-includes-copyright: The Kubernetes Authors.

set -o errexit
set -o nounset
set -o pipefail

SCRIPT_ROOT=$(dirname "${BASH_SOURCE[0]}")/..
CODEGEN_PKG=${CODEGEN_PKG:-$(cd "${SCRIPT_ROOT}"; ls -d -1 ./vendor/k8s.io/code-generator 2>/dev/null || echo $GOPATH/pkg/mod/k8s.io/code-generator@v0.29.1)}

OUTDIR="${HOME}/go/src"
OPENAPI_VIOLATION_EXCEPTIONS_FILENAME="zz_generated.openapi_violation_exceptions.list"

source "${CODEGEN_PKG}/kube_codegen.sh"
source "$(dirname "${BASH_SOURCE[0]}")/openapi-codegen.sh"


for api_pkg in $(ls ./pkg/apis); do
  if [[ "${1-}" != "" && ${api_pkg} != $1 ]]; then
    continue
  fi
  include_common_input_dirs=$([[ ${api_pkg} == "common" ]] && echo "true" || echo "false")
  for pkg_version in $(ls ./pkg/apis/${api_pkg}); do
    echo "API: ${api_pkg}/${pkg_version}"
    echo "-------------------------------------------"

    kube::codegen::gen_helpers \
      --input-pkg-root github.com/grafana/grafana/pkg/apis/${api_pkg}/${pkg_version} \
      --output-base "${OUTDIR}" \
      --boilerplate "${SCRIPT_ROOT}/hack/boilerplate.go.txt"


    echo "Generating openapi package for ${api_pkg}, version=${pkg_version} ..."

    grafana::codegen::gen_openapi \
      --input-pkg-single github.com/grafana/grafana/pkg/apis/${api_pkg}/${pkg_version} \
      --output-base "${OUTDIR}" \
      --report-filename "${OPENAPI_VIOLATION_EXCEPTIONS_FILENAME}" \
      --update-report \
      --boilerplate "${SCRIPT_ROOT}/hack/boilerplate.go.txt" \
      --include-common-input-dirs ${include_common_input_dirs}

    violations_file="${OUTDIR}/github.com/grafana/grafana/pkg/apis/${api_pkg}/${pkg_version}/${OPENAPI_VIOLATION_EXCEPTIONS_FILENAME}"
    # delete violation exceptions file, if empty
    if ! grep -q . "${violations_file}"; then
        echo "Deleting ${violations_file} since it is empty"
        rm ${violations_file}
    fi
    
    echo ""
  done
done

echo "Generating client code..."
echo "---------------------------"

kube::codegen::gen_client \
    --with-watch \
    --with-applyconfig \
    --input-pkg-root github.com/grafana/grafana/pkg/apis \
    --output-pkg-root github.com/grafana/grafana/pkg/generated \
    --output-base "${OUTDIR}" \
    --boilerplate "${SCRIPT_ROOT}/hack/boilerplate.go.txt"

echo "done."
