#!/usr/bin/env bash
set -euo pipefail

usage() {
    {
        echo "pkgs-with-tests-named.sh: Find packages with tests in them, filtered by the test names."
        echo "usage: $0 [-h] [-d <directory>] -b <beginning_with> [-s]"
        echo
        echo "  -h: Show this help message."
        echo "  -b: Tests beginning with this name will be included."
        echo "      Can only be used once. If not specified, all directories will be included."
        echo "  -d: The directory to find packages with tests in."
        echo "      Can be a path or a /... style pattern."
        echo "      Can be repeated to specify multiple directories."
        echo "      Default: ./..."
        echo "  -s: Split final package list with spaces rather than newlines."
    } >&2
}

beginningWith=""
dirs=()
s=0
while getopts ":hb:c:d:s" opt; do
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
        s)
            s=1
            ;;
        *)
            usage
            exit 1
            ;;
    esac
done
shift $((OPTIND - 1))

if [[ ${#dirs[@]} -eq 0 ]]; then
    dirs+=("./...")
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

readarray -t PACKAGES <<< "$(go list -f '{{.Dir}}' -e "${dirs[@]}")"

for i in "${!PACKAGES[@]}"; do
    readarray -t PKG_FILES <<< "$(find "${PACKAGES[$i]}" -type f -name '*_test.go')"
    if [ ${#PKG_FILES[@]} -eq 0 ] || [ ${#PKG_FILES[@]} -eq 1 ] && [ -z "${PKG_FILES[0]}" ]; then
        unset "PACKAGES[$i]"
        continue
    fi
    if ! grep -q "^func $beginningWith" "${PKG_FILES[@]}"; then
        unset "PACKAGES[$i]"
    fi
done

for pkg in "${PACKAGES[@]}"; do
    if [ $s -eq 1 ]; then
        printf "%s " "$pkg"
    else
        printf "%s\n" "$pkg"
    fi
done
