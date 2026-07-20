#!/usr/bin/env bash
set -euo pipefail

dir="${1:-profiles}"

for f in "$dir"/*.pprof; do
  [ -e "$f" ] || continue
  name="$(basename "$f" .pprof)"
  metric="${name##*.}"
  pkg="${name%.*}"
  pkg="${pkg//__//}"
  go tool pprof -raw "$f" 2>/dev/null | awk -v pkg="$pkg" -v metric="$metric" '
    /^Samples:/ { sect = "samples"; next }
    /^Locations/ { sect = "locs"; next }
    /^Mappings/ { sect = ""; next }
    sect == "samples" && /^[ \t]*[0-9]/ && index($0, ":") {
      pos = index($0, ":")
      vals_str = substr($0, 1, pos - 1)
      gsub(/^[ \t]+/, "", vals_str)
      split(vals_str, vals, /[ \t]+/)
      nsamp++
      sval[nsamp] = vals[2]
      sids[nsamp] = substr($0, pos + 1)
      next
    }
    sect == "locs" && /^[ \t]*[0-9]+: 0x/ {
      id = $1
      sub(/:$/, "", id)
      fn[id] = $4
      last = id
      next
    }
    sect == "locs" && last != "" { fn[last] = fn[last] " " $1; next }
    END {
      for (i = 1; i <= nsamp; i++) {
        n = split(sids[i], ids, /[ \t]+/)
        test = ""
        for (j = n; j >= 1; j--) {
          if (match(fn[ids[j]], /\.TestIntegration[A-Za-z0-9_]*/)) {
            test = substr(fn[ids[j]], RSTART + 1, RLENGTH - 1)
            break
          }
        }
        if (test != "") total[test] += sval[i]
      }
      for (t in total)
        printf "{\"pkg\":\"%s\",\"test\":\"%s\",\"metric\":\"%s\",\"value\":%.0f}\n", pkg, t, metric, total[t]
    }
  '
done
