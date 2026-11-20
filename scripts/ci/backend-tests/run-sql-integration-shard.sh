#!/usr/bin/env bash
set -euo pipefail

sqlite=0
if [[ ${1:-} == --sqlite ]]; then
    sqlite=1
    shift
fi
shard=${1:?Usage: run-sql-integration-shard.sh [--sqlite] <shard> [enterprise checkout]}
enterprise_dir=${2:-}
script_dir=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
discover="$script_dir/pkgs-with-tests-named.sh"

test_flags=(-timeout=12m)
if (( ! sqlite )); then
    test_flags=(-p=1 "${test_flags[@]}")
elif [[ -n "$enterprise_dir" ]]; then
    test_flags=(-timeout=16m)
fi

grafana_packages=$("$discover" -b TestIntegration -i)
enterprise_packages=""
build_tags=()
if [[ -n "$enterprise_dir" ]]; then
    build_tags=(-tags=enterprise)
    # Keep the SAML exclusion in sync with the Enterprise root-module job.
    enterprise_packages=$(cd "$enterprise_dir" &&
        "$discover" -b TestIntegration -i -d ./pkg/... |
        awk '$0 != "github.com/grafana/grafana-enterprise/pkg/saml"')
fi

# The two module runs share the same CI job, so their weights must be added together.
packages=$(printf '%s\n' "$grafana_packages" "$enterprise_packages" |
    "$script_dir/shard.sh" -N "$shard" -d - -w "$script_dir/sql-integration-weights.txt")
grafana_shard=()
enterprise_shard=()
while IFS= read -r package; do
    case "$package" in
        github.com/grafana/grafana-enterprise/*) enterprise_shard+=("$package") ;;
        ?*) grafana_shard+=("$package") ;;
    esac
done <<< "$packages"

run_compiled_tests() {
    local binaries package_dirs go_root pkg dir started status=0
    binaries=$(mktemp -d "${RUNNER_TEMP:-${TMPDIR:-/tmp}}/sql-integration.XXXXXXXX")
    package_dirs=$(CGO_ENABLED=0 go list "${build_tags[@]}" -f '{{.ImportPath}}{{"\t"}}{{.Dir}}' "$@")
    go_root=$(go env GOROOT)

    echo "Compiling test binaries"
    CGO_ENABLED=0 go test -vet=off "${build_tags[@]}" -c -o "$binaries/" "$@"
    echo "Running compiled tests"
    while IFS=$'\t' read -r pkg dir; do
        started=$SECONDS
        if (
            cd "$dir" &&
                PATH="$go_root/bin:$PATH" CGO_ENABLED=0 "$binaries/${pkg##*/}.test" -test.paniconexit0 -test.timeout=12m -test.run '^TestIntegration'
        ) > "$binaries/test.log" 2>&1; then
            printf 'ok\t%s\t%ss\n' "$pkg" "$((SECONDS - started))"
        else
            cat "$binaries/test.log"
            printf 'FAIL\t%s\t%ss\n' "$pkg" "$((SECONDS - started))"
            status=1
        fi
    done <<< "$package_dirs"
    return "$status"
}

run_tests() {
    if (( $# == 0 )); then
        echo "No packages in this shard for $PWD"
        return
    fi

    echo "Testing packages in $PWD"
    if (( ! sqlite )); then
        if [[ "${GRAFANA_CI_COMPILE_ONCE:-}" == "true" ]]; then
            run_compiled_tests "$@"
            return
        fi
        echo "Precompiling, no tests will be run"
        CGO_ENABLED=0 go test -vet=off "${build_tags[@]}" -run='^$' "$@"
    fi
    echo "Running tests now"
    CGO_ENABLED=0 go test -vet=off "${build_tags[@]}" "${test_flags[@]}" -run '^TestIntegration' "$@"
}

run_tests "${grafana_shard[@]}"
if [[ -n "$enterprise_dir" ]]; then
    (cd "$enterprise_dir" && run_tests "${enterprise_shard[@]}")
fi
