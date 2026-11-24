# Report layout showcase

Dashboards that read like publications, built only from native dashboard features: report sections with summaries, a lede and masthead, style packs, figure rails, margin notes, stat figures, highlighted series with direct and annotation labels, and status cells in tables.

| Dashboard                          | Style                    | Shows                                                                                  |
| ---------------------------------- | ------------------------ | -------------------------------------------------------------------------------------- |
| `checkout-platform.json`           | Newsroom, press          | Status table with budget meters, highlighted series in a figure rail, margin note      |
| `payments-rollout.json`            | Field guide, paper       | Numbered sections and figures, margin notes, promotion gates                           |
| `product-review.json`              | Keynote, electric accent | Oversized figures, a goal line, cohort table                                           |
| `fleet-health.json`                | Pinstripe, signal accent | Dense host table with meters, highlighted host, monochrome with colour only for status |
| `incident-review.json`             | Newsroom, night desk     | Incident figures, impact region, timeline note, follow-ups                             |
| `release-readiness.json`           | Grafana native           | The report structure in Grafana's own cards and type                                   |
| `rollout-checkpoint.json`          | none                     | Report sections and the 2:1 split without a style                                      |

## Load

The dashboards need the `dashboardsReportLayouts` feature toggle and query the testdata data source. With Grafana running:

```sh
python3 devenv/dev-dashboards/dashboard-report-layouts/load.py --url http://localhost:3000
```

The script creates the `gdev-testdata` data source if it is missing, creates or updates every dashboard through the v2 API, and seeds the annotations each dashboard narrates. Annotations are placed relative to now, so re-run it to bring them back in line with the relative time ranges.

Viewers can change palette, accent and typography from the palette button in the dashboard controls; the choice is stored in their browser only. Authors pick the style and write the lede in the dashboard's **Report** options in edit mode, where **Editorial review** lists what to tighten.
