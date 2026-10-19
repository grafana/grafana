#!/usr/bin/env bash
set -euo pipefail

usage() {
    {
        echo "test-exclusions.sh: Print a regex matching the tests listed in .github/test-exclusions.json."
        echo "usage: $0 [-h] [-f <file>] <go|jest|playwright>"
        echo
        echo "  -h: Show this help message."
        echo "  -f: The exclusions file. Default: .github/test-exclusions.json"
        echo
        echo "Prints nothing when no tests are excluded for the given type."
        echo "  go:         pass as -skip. Names are top-level test functions."
        echo "  jest:       pass as --testNamePattern. Names are the full test name."
        echo "  playwright: pass as --grep-invert. Names are the full test title."
    } >&2
}

file="$(dirname "$0")/../../.github/test-exclusions.json"
while getopts ":hf:" opt; do
    case $opt in
        h)
            usage
            exit 0
            ;;
        f) file="$OPTARG" ;;
        *)
            usage
            exit 1
            ;;
    esac
done
shift $((OPTIND - 1))

type="${1:-}"
case "$type" in
    go | jest | playwright) ;;
    *)
        usage
        exit 1
        ;;
esac

# The names are escaped so that an entry can only ever match the test it names.
jq -er --arg type "$type" '
    def esc: gsub("(?<c>[\\\\.*+?^${}()|\\[\\]])"; "\\\(.c)");
    [.[] | select(.type == $type) | .test | esc] as $names
    | if ($names | length) == 0 then ""
      elif $type == "go" then "^(" + ($names | join("|")) + ")$"
      elif $type == "jest" then "^(?!(?:" + ($names | join("|")) + ")$)"
      else "(?:^| )(?:" + ($names | join("|")) + ")$"
      end
' "$file"
