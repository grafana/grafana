#!/usr/bin/env bash
set -euo pipefail

usage() {
    {
        echo "pkgs-with-tests-named.sh: Find packages with tests in them, filtered by the test names."
        echo "usage: $0 [-h] [-d <directory>] [-t <tags>] -b <beginning_with> [-i] [-s]"
        echo
        echo "  -h: Show this help message."
        echo "  -b: Tests beginning with this name will be included."
        echo "      Can only be used once. If not specified, all directories will be included."
        echo "  -d: The directory to find packages with tests in."
        echo "      Can be a path or a /... style pattern."
        echo "      Can be repeated to specify multiple directories."
        echo "      Default: ./..."
        echo "  -t: Build tags to resolve packages with."
        echo "      A /... pattern only expands to packages that build under these tags, so"
        echo "      this must match the tags the tests will be run with."
        echo "  -i: Print discovered package import paths instead of directories."
        echo "  -s: Split final package list with spaces rather than newlines."
    } >&2
}

beginningWith=""
dirs=()
tags=""
s=0
import_paths=0
while getopts ":hb:c:d:ist:" opt; do
    case $opt in
        h)
            usage
            exit 0
            ;;
        b)
            beginningWith="$OPTARG"
            ;;
        d)
            dirs+=("$OPTARG")
            ;;
        i)
            import_paths=1
            ;;
        s)
            s=1
            ;;
        t)
            tags="$OPTARG"
            ;;
        *)
            usage
            exit 1
            ;;
    esac
done
shift $((OPTIND - 1))

if [[ ${#dirs[@]} -eq 0 ]]; then
    readarray -t dirs <<< "$(find . -type f -name 'go.mod' -exec dirname '{}' ';' | awk '{ print $1 "/..."; }')"
fi
if [ -z "$beginningWith" ]; then
    for pkg in "${dirs[@]}"; do
        if [ $s -eq 1 ]; then
            printf "%s " "$pkg"
        else
            printf "%s\n" "$pkg"
        fi
    done
    exit 0
fi

GO_LIST_ARGS=(-f '{{.ImportPath}}{{"\t"}}{{.Dir}}' -e)
if [ -n "$tags" ]; then
    GO_LIST_ARGS+=(-tags "$tags")
fi

packages=$(go list "${GO_LIST_ARGS[@]}" "${dirs[@]}")
while IFS=$'\t' read -r import_path dir; do
    if [[ -z "$dir" ]]; then
        continue
    fi

    readarray -t test_files <<< "$(find "$dir" -maxdepth 1 -type f -name '*_test.go')"
    if [[ -z "${test_files[0]:-}" ]] || ! grep -q "^func $beginningWith" "${test_files[@]}"; then
        continue
    fi

    pkg=$dir
    if (( import_paths )); then
        pkg=$import_path
    fi
    if [ $s -eq 1 ]; then
        printf "%s " "$pkg"
    else
        printf "%s\n" "$pkg"
    fi
done <<< "$packages"
