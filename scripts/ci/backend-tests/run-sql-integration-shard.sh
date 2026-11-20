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

sqlite_timeout=12m
if [[ -n "$enterprise_dir" ]]; then
    sqlite_timeout=16m
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
    local binaries package_dirs go_root pkg dir has_tests name parent started result_file status=0
    local -a batch=() collisions=()
    local -A seen=() binary_paths=()
    binaries=$(mktemp -d "${RUNNER_TEMP:-${TMPDIR:-/tmp}}/sql-integration.XXXXXXXX")
    package_dirs=$(CGO_ENABLED=0 go list "${build_tags[@]}" -f '{{.ImportPath}}{{"\t"}}{{.Dir}}{{if or .TestGoFiles .XTestGoFiles}}{{"\t"}}tests{{end}}' "$@")
    go_root=$(go env GOROOT)

    # Go names the test binaries in a directory after the final non-version import path element.
    while IFS=$'\t' read -r pkg dir has_tests; do
        if [[ -z "$has_tests" ]]; then
            printf '?\t%s\t[no test files]\n' "$pkg"
            continue
        fi
        name=${pkg##*/}
        if [[ "$name" =~ ^v([2-9]|[1-9][0-9]+)$ && "$pkg" == */* ]]; then
            parent=${pkg%/*}
            name=${parent##*/}
        fi
        if [[ "${seen[$name]:-}" ]]; then
            binary_paths["$pkg"]="$binaries/duplicate.${#collisions[@]}"
            collisions+=("$pkg")
        else
            seen["$name"]=1
            binary_paths["$pkg"]="$binaries/$name.test"
            batch+=("$pkg")
        fi
    done <<< "$package_dirs"
    if (( ${#batch[@]} == 0 )); then
        return
    fi

    echo "Compiling test binaries"
    CGO_ENABLED=0 go test -vet=off "${build_tags[@]}" -c -o "$binaries/" "${batch[@]}"
    for pkg in "${collisions[@]}"; do
        CGO_ENABLED=0 go test -vet=off "${build_tags[@]}" -c -o "${binary_paths[$pkg]}" "$pkg"
    done

    echo "Running compiled tests"
    result_file="$binaries/test.log"
    while IFS=$'\t' read -r pkg dir has_tests; do
        [[ -n "$has_tests" ]] || continue
        started=$SECONDS
        # Give the test binary one extra minute to handle its own test timeout.
        if (
            cd "$dir" &&
                PATH="$go_root/bin:$PATH" CGO_ENABLED=0 timeout -s QUIT -k 5s 13m \
                    "${binary_paths[$pkg]}" -test.paniconexit0 -test.timeout=12m -test.run '^TestIntegration'
        ) > "$result_file" 2>&1; then
            if grep -Fqx 'testing: warning: no tests to run' "$result_file"; then
                printf 'ok  \t%s\t%ss [no tests to run]\n' "$pkg" "$((SECONDS - started))"
            else
                printf 'ok  \t%s\t%ss\n' "$pkg" "$((SECONDS - started))"
            fi
        else
            cat "$result_file"
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
    if (( sqlite )); then
        echo "Running tests now"
        CGO_ENABLED=0 go test -vet=off "${build_tags[@]}" -timeout="$sqlite_timeout" -run '^TestIntegration' "$@"
    else
        run_compiled_tests "$@"
    fi
}

run_tests "${grafana_shard[@]}"
if [[ -n "$enterprise_dir" ]]; then
    (cd "$enterprise_dir" && run_tests "${enterprise_shard[@]}")
fi
