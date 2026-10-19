#!/usr/bin/env bash
set -euo pipefail

file="${1:-$(dirname "$0")/../../.github/test-exclusions.json}"

# Fails with a message per bad entry; a malformed file fails jq itself.
errors="$(jq -r '
    if type != "array" then "top level must be an array"
    else
        (to_entries[] | .key as $i | .value as $e
            | if ($e | type) != "object" then "entry \($i): must be an object"
              elif (($e | keys) - ["type", "test", "codeowner"] | length) > 0 or (["type", "test", "codeowner"] - ($e | keys) | length) > 0
                  then "entry \($i): must have exactly the fields type, test and codeowner"
              elif ($e.type | IN("go", "jest", "playwright") | not) then "entry \($i): type must be go, jest or playwright"
              elif (($e.test | type) != "string") or (($e.test | length) < 4) or ($e.test | test("[\\n\\r]")) then "entry \($i): test must be a single-line string of at least 4 characters"
              elif $e.type == "go" and ($e.test | test("^Test[A-Za-z0-9_]*$") | not) then "entry \($i): go test must be a top-level test function name (TestXxx)"
              elif (($e.codeowner | type) != "string") or ($e.codeowner | test("^@[A-Za-z0-9_.-]+(/[A-Za-z0-9_.-]+)?$") | not) then "entry \($i): codeowner must be @user or @org/team"
              else empty end),
        (group_by([.type, .test])[] | select(length > 1) | "duplicate entry: \(.[0].type) \(.[0].test)")
    end
' "$file")"

if [ -n "$errors" ]; then
    echo "$errors" >&2
    exit 1
fi
