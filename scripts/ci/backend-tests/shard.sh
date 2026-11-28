#!/usr/bin/env bash
set -euo pipefail

usage() {
    {
        echo "shard.sh: Shard tests for parallel execution in CI."
        echo "usage: $0 [-h] -n <shard> -m <total_shards> [-d <directory>] [-w <weights_file>] [-s]"
        echo
        echo "  -h: Show this help message."
        echo "  -n: The shard number (1-indexed)."
        echo "  -m: The total number of shards. Must be equal to or greater than -n."
        echo "  -N: The shard in shard notation (n/m), corresponding to -n and -m."
        echo "  -d: The directory to find packages with tests in."
        echo "      Can be a path or a /... style pattern."
        echo "      Can be repeated to specify multiple directories."
        echo "      Can be - to read from stdin."
        echo "      Default: ./..."
        echo "  -w: Balance by package weight. Requires package import paths on stdin (-d -)."
        echo "      The file lists an import path and estimated seconds per line."
        echo "  -s: Split final package list with spaces rather than newlines."
    } >&2
}

is_int() {
    # we can't just return the result of the regex match shellcheck is unhappy...
    if [[ "$1" =~ ^[0-9]+$ ]]; then
        return 0
    else
        return 1
    fi
}

weighted_shard() {
    local separator='\n'
    if (( s )); then
        separator=' '
    fi

    # Every runner needs the same weight order and tie-breaking, regardless of discovery order.
    awk '
        FILENAME == ARGV[1] {
            if (!NF || $1 ~ /^#/) next
            if (NF != 2 || $2 !~ /^[1-9][0-9]*$/ || ($1 in weights)) {
                printf "Invalid package weight at %s:%d\n", FILENAME, FNR > "/dev/stderr"
                exit 1
            }
            weights[$1] = $2
            next
        }
        NF && !seen[$1]++ {
            print ($1 in weights ? weights[$1] : 8), $1
        }
    ' "$weights_file" - |
        LC_ALL=C sort -k1,1nr -k2,2 |
        awk -v selected="$n" -v shards="$m" -v separator="$separator" '
            {
                lightest = 1
                for (i = 2; i <= shards; i++) {
                    if (load[i] < load[lightest]) lightest = i
                }
                load[lightest] += $1
                if (lightest == selected) printf "%s%s", $2, separator
            }
        '
}

n=0
m=0
dirs=()
s=0
weights_file=""
while getopts ":hn:m:d:sN:w:" opt; do
    case $opt in
        h)
            usage
            exit 0
            ;;
        n)
            if ! is_int "$OPTARG"; then
                echo "Error: -n must be an integer." >&2
                usage
                exit 1
            fi
            n=$OPTARG
            ;;
        m)
            if ! is_int "$OPTARG"; then
                echo "Error: -m must be an integer." >&2
                usage
                exit 1
            fi
            m=$OPTARG
            ;;
        N)
            if [[ "$OPTARG" =~ ^([0-9]+)/([0-9]+)$ ]]; then
                n="${BASH_REMATCH[1]}"
                m="${BASH_REMATCH[2]}"
            else
                echo "Error: -N must be in the form n/m." >&2
                usage
                exit 1
            fi
            ;;
        d)
            dirs+=("$OPTARG")
            ;;
            w)
                weights_file=$OPTARG
                ;;
        s)
            s=1
            ;;
        \?)
            echo "Invalid option: -$OPTARG" >&2
            usage
            exit 1
            ;;
        :)
            echo "Option -$OPTARG requires an argument." >&2
            usage
            exit 1
            ;;
    esac
done
shift $((OPTIND - 1))

if [[ $n -eq 0 || $m -eq 0 ]]; then
    echo "Error: -n and -m are required." >&2
    usage
    exit 1
fi
if [[ $n -lt 1 || $m -lt 1 ]]; then
    echo "Error: -n and -m must be greater than 0." >&2
    usage
    exit 1
fi
if [[ $n -gt $m ]]; then
    echo "Error: -n must be less than or equal to -m." >&2
    usage
    exit 1
fi
if [[ -n "$weights_file" ]]; then
    if [[ ${#dirs[@]} -ne 1 || ${dirs[0]} != "-" ]]; then
        echo "Error: -w requires package import paths on stdin (-d -)." >&2
        exit 1
    fi
    weighted_shard
    exit 0
fi

if [[ ${#dirs[@]} -eq 0 ]]; then
    readarray -t dirs <<< "$(find . -type f -name 'go.mod' -exec dirname '{}' ';' | awk '{ print $1 "/..."; }')"
fi
# If dirs is just ("-"), read from stdin instead.
if [[ ${#dirs[@]} -eq 1 && "${dirs[0]}" == "-" ]]; then
    dirs=()
    while IFS= read -r line; do
        dirs+=("$line")
    done
fi
if [[ $n -eq 1 && $m -eq 1 ]]; then
    # If there is only one shard, just return all packages.
    for pkg in "${dirs[@]}"; do
        if [ $s -eq 1 ]; then
            printf "%s " "$pkg"
        else
            printf "%s\n" "$pkg"
        fi
    done
    exit 0
fi

# Each runner must assign the same package to the same shard.
readarray -t PACKAGES <<< "$(go list -f '{{.Dir}}' -e "${dirs[@]}" | LC_ALL=C sort -u)"
if [[ ${#PACKAGES[@]} -eq 0 ]]; then
    echo "No packages found in directories: ${dirs[*]}" >&2
    exit 1
fi

for i in "${!PACKAGES[@]}"; do
    if [ -z "$(find "${PACKAGES[i]}" -maxdepth 1 -type f -name '*_test.go' -print -quit)" ]; then
        # There are no test files in this package.
        unset 'PACKAGES[i]'
    fi
done

for i in "${!PACKAGES[@]}"; do
    if (( (i % m) + 1 != n )); then
        unset 'PACKAGES[i]'
    fi
done

for pkg in "${PACKAGES[@]}"; do
    if [ $s -eq 1 ]; then
        printf "%s " "$pkg"
    else
        printf "%s\n" "$pkg"
    fi
done
