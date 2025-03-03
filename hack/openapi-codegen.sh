# SPDX-License-Identifier: AGPL-3.0-only
# Provenance-includes-location: https://github.com/kubernetes/code-generator/blob/master/kube_codegen.sh
# Provenance-includes-license: Apache-2.0
# Provenance-includes-copyright: The Kubernetes Authors.

## NOTE: The following is a fork of the original gen_openapi helper in k8s.io/code-generator
## It allows us to generate separate openapi packages per api group.

# Generate openapi code
#
# Args:
#
#   --input-pkg-single <string>
#     The root directory of a single grafana API Group.
#
#   --output-base <string>
#     The root directory under which to emit code.  The concatenation of
#     <output-base> + <input-pkg-single> must be valid.
#
#   --report-filename <string = "/dev/null">
#     The filename of the API violations report in the input pkg directory.
#
#   --update-report
#     If specified, update the report file in place, rather than diffing it.
#
#   --boilerplate <string = path_to_kube_codegen_boilerplate>
#     An optional override for the header file to insert into generated files.

set -o errexit
set -o nounset
set -o pipefail

KUBE_CODEGEN_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"

source "${CODEGEN_PKG}/kube_codegen.sh"
#
function grafana::codegen::gen_openapi() {
    local in_pkg_single=""
    local out_base=""
    local report="/dev/null"
    local update_report=""
    local include_common_input_dirs=""
    local boilerplate="${KUBE_CODEGEN_ROOT}/hack/boilerplate.go.txt"
    local v="${KUBE_VERBOSE:-0}"

    while [ "$#" -gt 0 ]; do
        case "$1" in
        "--input-pkg-single")
            in_pkg_single="$2"
            shift 2
            ;;
        "--include-common-input-dirs")
            if [ "$2" == "true" ]; then
                COMMON_INPUT_DIRS='k8s.io/apimachinery/pkg/apis/meta/v1 k8s.io/apimachinery/pkg/runtime k8s.io/apimachinery/pkg/version'
            else
                COMMON_INPUT_DIRS=""
            fi
            shift 2
            ;;
        "--output-base")
            out_base="$2"
            shift 2
            ;;
        "--report-filename")
            report="$2"
            shift 2
            ;;
        "--update-report")
            update_report="true"
            shift
            ;;
        "--boilerplate")
            boilerplate="$2"
            shift 2
            ;;
        *)
            echo "unknown argument: $1" >&2
            return 1
            ;;
        esac
    done

    if [ -z "${in_pkg_single}" ]; then
        echo "--input-pkg-single is required" >&2
        return 1
    fi

    if [ -z "${report}" ]; then
        echo "--report-filename is required" >&2
        return 1
    fi

    if [ -z "${out_base}" ]; then
        echo "--output-base is required" >&2
        return 1
    fi

    (
        # To support running this from anywhere, first cd into this directory,
        # and then install with forced module mode on and fully qualified name.
        cd "${KUBE_CODEGEN_ROOT}"
        GO111MODULE=on go mod download
        BINS=(
            openapi-gen
        )
        # shellcheck disable=2046 # printf word-splitting is intentional
        GO111MODULE=on go install $(printf "k8s.io/kube-openapi/cmd/%s " "${BINS[@]}")
    )
    # Go installs in $GOBIN if defined, and $GOPATH/bin otherwise
    gobin="${GOBIN:-$(go env GOPATH)/bin}"

    # These tools all assume out-dir == in-dir.
    root="${in_pkg_single}"
    mkdir -p "${root}"

    local input_pkgs=()
    while read -r dir; do
        pkg="$(cd "${dir}" && GO111MODULE=on go list -find .)"
        input_pkgs+=("${pkg}")
    done < <(
        (
            kube::codegen::internal::grep -l --null \
                -e '+k8s:openapi-gen=' \
                -r "${root}" \
                --include '*.go' ||
                true
        ) | while read -r -d $'\0' F; do dirname "${F}"; done |
            LC_ALL=C sort -u
    )

    local new_report=""
    if [ "${#input_pkgs[@]}" == 0 ]; then
        return 0
    fi
    echo "Generating openapi code for ${#input_pkgs[@]} targets"

    kube::codegen::internal::findz \
        "${root}" \
        -type f \
        -name zz_generated.openapi.go \
        | xargs -0 rm -f

    local new_report
    new_report="$(mktemp -t "$(basename "$0").api_violations.XXXXXX")"
    if [ -n "${update_report}" ]; then
        new_report="${root}/${report}"
    fi

    "${gobin}/openapi-gen" \
        -v "${v}" \
        --output-file zz_generated.openapi.go \
        --go-header-file "${boilerplate}" \
        --output-dir "${root}" \
        --output-pkg "github.com/grafana/grafana/${in_pkg_single}" \
        --report-filename "${new_report}" \
        ${COMMON_INPUT_DIRS} \
        "${input_pkgs[@]}"

    touch "${root}/${report}" # in case it doesn't exist yet
    if [[ -z "${new_report}" ]]; then
        return 0
    fi
    if ! diff -u "${root}/${report}" "${new_report}"; then
        echo -e "ERROR:"
        echo -e "\tAPI rule check failed for ${root}/${report}: new reported violations"
        echo -e "\tPlease read api/api-rules/README.md"
        return 1
    fi

    # if all goes well, remove the temporary reports
    if [ -z "${update_report}" ]; then
        rm -f "${new_report}"
    fi
}
