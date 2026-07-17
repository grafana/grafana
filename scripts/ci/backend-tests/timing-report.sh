#!/usr/bin/env bash
set -euo pipefail

dir="${1:-timings}"
csv="${2:-}"
baseline_csv="${3:-}"
previous_csv="${4:-}"
codeowners="${CODEOWNERS_FILE:-.github/CODEOWNERS}"

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

parse_timings_csv() {
  if [ -n "$1" ] && [ -f "$1" ]; then
    jq -Rs '
      [split("\n")[1:][]
       | select(. != "")
       | capture("^\"(?<pkg>[^\"]*)\",\"(?<test>[^\"]*)\",(?<sec>.*)$")
       | {key: (.pkg + "/" + .test), value: (.sec | tonumber)}]
      | from_entries
    ' "$1"
  else
    echo null
  fi
}

baseline="$(parse_timings_csv "$baseline_csv")"
previous="$(parse_timings_csv "$previous_csv")"

owners="$(jq -r '.[:20][].pkg' "$sorted" | sort -u | while read -r pkg; do
  owner="$(awk -v path="$pkg/" '
    /^[[:space:]]*(#|$)/ { next }
    $1 ~ /^\// && $1 !~ /[*?]/ {
      p = substr($1, 2); sub(/\/+$/, "", p)
      if (index(path, p "/") == 1 && length(p) > best) { best = length(p); owner = $2 }
    }
    END { print owner }
  ' "$codeowners")"
  printf '%s\t%s\n' "$pkg" "${owner:-unknown}"
done | jq -Rs '[split("\n")[] | select(. != "") | split("\t") | {key: .[0], value: (.[1] | sub("^@grafana/"; ""))}] | from_entries')"

jq -r --argjson owners "$owners" --argjson baseline "$baseline" --argjson previous "$previous" '
  def fmtdur: if . >= 60 then "\(. / 60 | floor)m \(. % 60 | round)s" else "\(round)s" end;
  def fmtdelta: (. * 10 | round / 10) | if . > 0 then "+\(.)s" else "\(.)s" end;
  ([{label: "main", map: $baseline}, {label: "prev run", map: $previous}] | map(select(.map != null))) as $cmps
  | ["#2a78d6", "#008300", "#e87ba4", "#eda100", "#1baf7a", "#eb6834", "#4a3aa7", "#e34948"] as $palette
  | (.[:20] | map(. + {owner: ($owners[.pkg] // "unknown")})) as $top
  | ($top | reduce .[].owner as $o ([]; if index($o) then . else . + [$o] end)) as $names
  | (if ($names | length) > ($palette | length) then $names[:($palette | length) - 1] + ["other"] else $names end) as $series
  | ($top | map(.owner as $o | if ($series | index($o)) then $o else "other" end)) as $rowSeries
  | $palette[:($series | length)] as $colors
  | (map(.elapsed) | add // 0) as $total
  | "<!-- integration-test-timings -->",
    "## Slowest integration tests\n",
    "**Total: \($total | fmtdur)** across \(length) tests\(
      if ($cmps | length) > 0 then
        " (\($cmps | map((.map | [.[]] | add // 0) as $t | "\(.label): \($t | fmtdur), \($total - $t | fmtdelta)") | join(" · ")))"
      else "" end
    ).\n",
    "Slowest first, worst time across databases and shards. Bars are colored by codeowner:\n",
    ($series | to_entries | map("![\(.value)](https://img.shields.io/badge/\(.value | gsub("-"; "--"))-\($colors[.key] | ltrimstr("#")))") | join(" ")),
    "",
    "```mermaid",
    "%%{init: {\"themeVariables\": {\"xyChart\": {\"plotColorPalette\": \"\($colors | join(","))\"}}}}%%",
    "xychart-beta",
    "    title \"Top \($top | length) slowest integration tests (seconds)\"",
    "    x-axis [\($top | to_entries | map("\"\(.key + 1)\"") | join(", "))]",
    "    y-axis \"seconds\"",
    ($series[] as $s | "    bar [\([range($top | length)] | map(if $rowSeries[.] == $s then ($top[.].elapsed | tostring) else "0" end) | join(", "))]"),
    "```\n",
    "| # | Test | Package | Owner | Seconds |\($cmps | map(" vs \(.label) |") | join(""))",
    "|---|------|---------|-------|--------:|\($cmps | map("--------:|") | join(""))",
    ($top | to_entries[] | . as $row | "| \(.key + 1) | `\(.value.test)` | `\(.value.pkg)` | `\(.value.owner)` | \(.value.elapsed) |\(
      $cmps | map(
        (.map[$row.value.pkg + "/" + $row.value.test]) as $b
        | " \(if $b then ($row.value.elapsed - $b | fmtdelta) else "new" end) |"
      ) | join("")
    )")
' "$sorted"
