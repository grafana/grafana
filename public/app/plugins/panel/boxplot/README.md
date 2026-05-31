# Box plot panel

Draws box-and-whisker plots from summary statistics that already exist in your data — one box per row.

This panel does not compute statistics. It maps data fields onto box-plot dimensions and draws them:

- **Q1**, **Median**, **Q3** — the box and its midline (required).
- **Min**, **Max** — the whisker ends (five-number summary).
- **Lower whisker**, **Upper whisker** — optional. When mapped, the whiskers extend to these values and
  **Min**/**Max** are drawn as outlier points beyond them (seven-number summary).

Fields are auto-detected by name (`min`, `q1`/`p25`/`25th %`, `median`, `q3`/`p75`/`75th %`, `max`, …), so the
output of the **Reduce** transformation maps automatically. To build a box plot from raw values, add a
**Reduce** transformation (calcs: Min, 25th %, Median, 75th %, Max) in *Series to rows* mode, then select this
panel.
