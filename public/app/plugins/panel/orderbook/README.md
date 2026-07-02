# Order book panel

A depth-of-market visualization. Ask (sell) levels are stacked above the mid price in red,
bid (buy) levels below in green. Each row shows a horizontal bar scaled to the level's size,
an optional cumulative-depth background bar, and the price / delta / size / sum columns.

## Data

The panel reads a single data frame with these fields (names are auto-detected, override in options):

| Field | Type   | Notes                                                             |
| ----- | ------ | ----------------------------------------------------------------- |
| price | number | Price of each level. Matched on names like `price`, `bid`, `ask`. |
| size  | number | Size/volume of each level. Matched on `size`, `volume`, `qty`.    |
| side  | string | `bid`/`buy` or `ask`/`sell`. Optional.                            |

When no side field is present, levels are split by the mid price: levels priced above the mid
are asks, the rest are bids. The mid price is the midpoint of the best bid and best ask by
default, or read from a field.

The **delta** column shows how much each level's size changed since the previous data update.
The **sum** column shows the cumulative size accumulated from the mid price outward.
