#!/usr/bin/env bash
set -euo pipefail

dir="${1:-timings}"
csv="${2:-}"

events="$(mktemp)"
sorted="$(mktemp)"
trap 'rm -f "$events" "$sorted"' EXIT

find "$dir" -name '*.json' -print0 | xargs -0 jq -Rc '
  fromjson?
  | select(.Action == "pass" or .Action == "fail")
  | select(.Test != null)
  | select(.Test | contains("/") | not)
  | {pkg: (.Package | sub("^github\\.com/grafana/grafana/"; "")), test: .Test, elapsed: .Elapsed}
' > "$events"

jq -s '
  group_by(.pkg + "/" + .test)
  | map({pkg: .[0].pkg, test: .[0].test, elapsed: (map(.elapsed) | max)})
  | sort_by(-.elapsed)
' "$events" > "$sorted"

if [ -n "$csv" ]; then
  jq -r '["package", "test", "seconds"], (.[] | [.pkg, .test, .elapsed]) | @csv' "$sorted" > "$csv"
fi

jq -r '
  .[:20] as $top
  | "<!-- integration-test-timings -->",
    "## Slowest integration tests\n",
    "Slowest first, worst time across databases and shards.\n",
    "```mermaid",
    "xychart-beta",
    "    title \"Top \($top | length) slowest integration tests (seconds)\"",
    "    x-axis [\($top | to_entries | map("\"\(.key + 1)\"") | join(", "))]",
    "    y-axis \"seconds\"",
    "    bar [\($top | map(.elapsed | tostring) | join(", "))]",
    "```\n",
    "| # | Test | Package | Seconds |",
    "|---|------|---------|--------:|",
    ($top | to_entries[] | "| \(.key + 1) | `\(.value.test)` | `\(.value.pkg)` | \(.value.elapsed) |")
' "$sorted"
