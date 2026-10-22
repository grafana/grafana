# Geomap basemap performance harness

A throwaway Playwright harness for #135474. It measures the Protomaps basemap against CARTO on the
`geomap-basemap-perf-single` and `geomap-basemap-perf-grid` dev dashboards from #135639. It is not
part of the e2e suite and is not meant to merge.

## What you need

1. A Grafana backend on `localhost:3000` with the login `admin` / `admin`, and the
   `grafana.geomapProtomapsBasemap` feature flag on in `conf/custom.ini`.
2. The dev dashboards and `geomap_100k_points.csv` from #135639. Restart the backend after you
   check out the branch, because the TestData data source embeds the CSV file at build time.
3. A Protomaps tile server on `localhost:8095`. The results used `server.mjs` from
   [grafana/grafana-maps](https://github.com/grafana/grafana-maps), with build `20261021`.
4. A production frontend build (`yarn build`) for numbers you report. The dev server inflates
   frame times.

## Run it

From the repository root:

```sh
# All 84 single-panel combinations, 3 runs each after a warm-up (about 80 minutes)
PERF_DASHBOARD=single PERF_RUNS=3 PERF_OUT=.perf-harness/results/mine.jsonl \
  yarn playwright test -c .perf-harness basemap-perf.spec.ts

# The worst case before the label fix, against its CARTO baseline (about 2 minutes)
PERF_FILTER='^(Protomaps dark|CARTO dark-matter) · 100k heatmap · Lower Manhattan z16$' PERF_RUNS=3 \
  PERF_OUT=.perf-harness/results/mine.jsonl yarn playwright test -c .perf-harness basemap-perf.spec.ts

# Summarize a results file against CARTO
python3 .perf-harness/scripts/report.py .perf-harness/results/mine.jsonl
```

Each line of a results file is one panel: every run, the medians, and the run settings.
`basemap-perf.spec.ts` documents the other variables at the top: `PERF_FILTER`, `PERF_SOAK_SEC`,
`PERF_LEAK`, `PERF_COPIES`, `PERF_DEDUPE_FONT` and `PERF_STRIP_LAYERS`.

The grid cannot show 16 copies of the 100k-marker panel. Four copies already use 740 MB of heap,
with CARTO too, and 16 crash the tab. Use `PERF_COPIES=4` for those rows.

## Results in this branch

| File                                            | What it is                                                                        |
| ----------------------------------------------- | --------------------------------------------------------------------------------- |
| `results/before-labels.jsonl`                   | Single dashboard before the label fix, dev build. z16 fails at p95 66.7 ms.       |
| `results/strip.jsonl`                           | z16 with label layers removed one group at a time. Isolates `roads_labels_minor`. |
| `results/dedupe-font.jsonl`                     | z16 with repeated `ctx.font` writes skipped. Helps, does not fix.                 |
| `results/minzoom16*.jsonl`                      | z16 after the minor-road minzoom change, with and without paths.                  |
| `results/after-labels.jsonl`                    | Single dashboard after the label fix, dev build. All pass.                        |
| `results/grid.jsonl`, `results/soak-leak.jsonl` | Grid, 2-minute soak and 5-cycle leak check, dev build.                            |
| `results/prod-*.jsonl`, `results/prod-run.log`  | Final numbers on a production build. These are the ones in #135474.               |
| `results/labelprobe-z16.txt`                    | Label texts drawn at z16 by CARTO dark-matter and Protomaps dark.                 |

The "no labels · 100k markers" row in `results/prod-grid.jsonl` has an implausible first render
(1.5 s with 4 tile requests). Do not quote it.

## Other probes

- `fontwrites.spec.ts` counts `ctx.font` writes on on-screen canvases per frame.
- `labelprobe.spec.ts` records which label texts each basemap draws.
- `scripts/compare-label-layers.py` and `scripts/compare-label-prominence.py` print the symbol
  layers of the Protomaps and CARTO styles side by side.
- `scripts/tile-features.mjs` decodes one tile and prints matching features, for example
  `node .perf-harness/scripts/tile-features.mjs 15 9647 12320 paul`.
