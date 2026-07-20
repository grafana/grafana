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
  | {pkg: (.Package | sub("^github\\.com/grafana/grafana/"; "")), test: .Test, elapsed: .Elapsed,
     db: (input_filename | capture("test-timings-(?<db>[a-z]+)-").db)}
' > "$events"

jq -s '
  (map(.db) | unique) as $dbs
  | {dbs: $dbs, tests: (
      group_by(.pkg + "/" + .test)
      | map(
          (group_by(.db) | map({key: .[0].db, value: (map(.elapsed) | max)}) | from_entries) as $by
          | {pkg: .[0].pkg, test: .[0].test, dbs: $by,
             elapsed: (($by | [.[]] | add) / ($by | length) * 100 | round / 100)}
        )
      | sort_by(-.elapsed)
    )}
' "$events" > "$sorted"

if [ -n "$csv" ]; then
  jq -r '
    .dbs as $dbs
    | (["package", "test"] + $dbs + ["average"]),
      (.tests[] | . as $t | [$t.pkg, $t.test] + [$dbs[] | ($t.dbs[.] // "")] + [$t.elapsed])
    | @csv
  ' "$sorted" > "$csv"
fi

parse_timings_csv() {
  if [ -n "$1" ] && [ -f "$1" ]; then
    jq -Rs '
      [split("\n")[1:][]
       | select(. != "")
       | capture("^\"(?<pkg>[^\"]*)\",\"(?<test>[^\"]*)\",(?<rest>.*)$")
       | {key: (.pkg + "/" + .test), value: (.rest | split(",") | last | tonumber)}]
      | from_entries
    ' "$1"
  else
    echo null
  fi
}

baseline="$(parse_timings_csv "$baseline_csv")"
previous="$(parse_timings_csv "$previous_csv")"

owners="$(jq -r '.tests[:20][].pkg' "$sorted" | sort -u | while read -r pkg; do
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
  .dbs as $dbs
  | .tests as $tests
  | ([{label: "main", map: $baseline}, {label: "prev run", map: $previous}] | map(select(.map != null))) as $cmps
  | ["#2a78d6", "#008300", "#e87ba4", "#eda100", "#1baf7a", "#eb6834", "#4a3aa7", "#e34948"] as $palette
  | ($tests[:20] | map(. + {owner: ($owners[.pkg] // "unknown")})) as $top
  | ($top | reduce .[].owner as $o ([]; if index($o) then . else . + [$o] end)) as $names
  | (if ($names | length) > ($palette | length) then $names[:($palette | length) - 1] + ["other"] else $names end) as $series
  | ($top | map(.owner as $o | if ($series | index($o)) then $o else "other" end)) as $rowSeries
  | $palette[:($series | length)] as $colors
  | ($tests | map(.elapsed) | add // 0) as $total
  | "<!-- integration-test-timings -->",
    "## Slowest integration tests\n",
    "**Total: \($total | fmtdur)** across \($tests | length) tests\(
      if ($cmps | length) > 0 then
        " (\($cmps | map((.map | [.[]] | add // 0) as $t | "\(.label): \($t | fmtdur), \($total - $t | fmtdelta)") | join(" · ")))"
      else "" end
    ).\n",
    "Slowest first by average across databases; per-database columns show the worst shard time. Bars are colored by codeowner:\n",
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
    "| # | Test | Package | Owner |\($dbs | map(" \(.[0:1] | ascii_upcase)\(.[1:]) |") | join("")) Average |\($cmps | map(" vs \(.label) |") | join(""))",
    "|---|------|---------|-------|\($dbs | map("--------:|") | join(""))--------:|\($cmps | map("--------:|") | join(""))",
    ($top | to_entries[] | . as $row | "| \(.key + 1) | `\(.value.test)` | `\(.value.pkg)` | `\(.value.owner)` |\(
      $dbs | map(" \($row.value.dbs[.] // "—") |") | join("")
    ) \(.value.elapsed) |\(
      $cmps | map(
        (.map[$row.value.pkg + "/" + $row.value.test]) as $b
        | " \(if $b then ($row.value.elapsed - $b | fmtdelta) else "new" end) |"
      ) | join("")
    )")
' "$sorted"
