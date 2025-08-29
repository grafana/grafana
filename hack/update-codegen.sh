#!/usr/bin/env bash

# SPDX-License-Identifier: AGPL-3.0-only
# Provenance-includes-location: https://github.com/kubernetes/sample-apiserver/blob/master/hack/update-codegen.sh
# Provenance-includes-license: Apache-2.0
# Provenance-includes-copyright: The Kubernetes Authors.

set -o errexit
set -o nounset
set -o pipefail

SCRIPT_ROOT=$(dirname "${BASH_SOURCE[0]}")/..
pushd "${SCRIPT_ROOT}/hack" && GO111MODULE=on go mod tidy && popd
CODEGEN_PKG=${CODEGEN_PKG:-$(cd "${SCRIPT_ROOT}"; ls -d -1 ./vendor/k8s.io/code-generator 2>/dev/null || echo $(go env GOPATH)/pkg/mod/k8s.io/code-generator@v0.33.1)}

OUTDIR="${HOME}/go/src"
OPENAPI_VIOLATION_EXCEPTIONS_FILENAME="zz_generated.openapi_violation_exceptions.list"

source "${CODEGEN_PKG}/kube_codegen.sh"
source "$(dirname "${BASH_SOURCE[0]}")/openapi-codegen.sh"

selected_pkg="${1-}"

grafana::codegen:run() {
  local generate_root=$1
  local skipped="true"
  for api_pkg in $(grafana:codegen:lsdirs ./${generate_root}/apis); do
    if [[ "${selected_pkg}" != "" && ${api_pkg} != $selected_pkg ]]; then
      continue
    fi
    echo "Generating code for ${generate_root}/apis/${api_pkg}..."
    echo "============================================="
    skipped="false"
    include_common_input_dirs=$([[ ${api_pkg} == "common" ]] && echo "true" || echo "false")

    kube::codegen::gen_helpers \
      --boilerplate "${SCRIPT_ROOT}/hack/boilerplate.go.txt" \
      ${generate_root}/apis/${api_pkg}

   for pkg_version in $(grafana:codegen:lsdirs ./${generate_root}/apis/${api_pkg}); do
      grafana::codegen::gen_openapi \
        --input-pkg-single ${generate_root}/apis/${api_pkg}/${pkg_version} \
        --output-base "${OUTDIR}" \
        --report-filename "${OPENAPI_VIOLATION_EXCEPTIONS_FILENAME}" \
        --update-report \
        --boilerplate "${SCRIPT_ROOT}/hack/boilerplate.go.txt" \
        --include-common-input-dirs ${include_common_input_dirs}

      violations_file="${generate_root}/apis/${api_pkg}/${pkg_version}/${OPENAPI_VIOLATION_EXCEPTIONS_FILENAME}"
      if [ ! -f "${violations_file}" ]; then
          continue
      fi
      # delete violation exceptions file, if empty
      if ! grep -q . "${violations_file}"; then
          echo "Deleting ${violations_file} since it is empty"
          rm ${violations_file}
      fi
      echo ""
    done
  done

  if [[ "${skipped}" == "true" ]]; then
    echo "no apis matching ${selected_pkg}. skipping..."
    echo
    return 0
  fi

  echo "Generating client code..."
  echo "-------------------------"

  kube::codegen::gen_client \
    --with-watch \
    --with-applyconfig \
    --output-dir ${generate_root}/generated \
    --output-pkg github.com/grafana/grafana/${generate_root}/generated \
    --boilerplate "${SCRIPT_ROOT}/hack/boilerplate.go.txt" \
    ${generate_root}/apis

  echo ""
}

grafana:codegen:lsdirs() {
  ls -d $1/*/ | xargs basename -a
}

grafana::codegen:run pkg
grafana::codegen:run pkg/apimachinery
grafana::codegen:run pkg/aggregator
grafana::codegen:run apps/dashboard/pkg
grafana::codegen:run apps/provisioning/pkg
grafana::codegen:run apps/folder/pkg
grafana::codegen:run apps/preferences/pkg

if [ -d "pkg/extensions/apis" ]; then
  grafana::codegen:run pkg/extensions
fi

echo "done."
