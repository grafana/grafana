# Table colors

`GrafanaTheme2.components.table` defines shared color roles for tabular surfaces. The
values are available in every theme, independently of feature toggles. Components
choose which states to render; they do not need to identify the theme or import a
palette.

## Roles

| Token                        | Usage                                                                       |
| ---------------------------- | --------------------------------------------------------------------------- |
| `background`                 | Body rows and opaque frozen cells                                           |
| `backgroundOnCanvas`         | Body backing surface in a panel without a background                        |
| `headerBackground`           | Header surface                                                              |
| `headerBorder`               | Header dividers, independently of the body grid                             |
| `border`                     | Body and footer dividers                                                    |
| `rowStripedBackground`       | Alternating data rows; not headers, footers, or nested expansion containers |
| `rowHoverBackgroundSolid`    | Solid hover color for an unstriped row                                      |
| `rowHoverOverlay`            | Translucent tint over a row's existing background                           |
| `rowSelectedBackground`      | Selected row surface                                                        |
| `rowSelectedHoverBackground` | Solid hovered selection surface                                             |
| `headerDraggingBackground`   | Header being dragged                                                        |
| `headerDragTargetBackground` | Header receiving a drop                                                     |
| `cellSelectionBorder`        | Focused cell outline                                                        |

Background surfaces must be opaque where they hide scrolling or overflowing
content. Divider tokens may have alpha; TableNG composites them against the table
surface before painting them over cells with custom backgrounds.

Use either the solid hover color or the hover overlay. Applying both would tint a
row twice. An overlay retains the distinction between striped and plain rows; it
also works over selected rows and transparent-panel backing surfaces. Consumers
must apply it without covering field-configured cell colors or nested tables.

## Four standard themes

| Surface        | Current dark         | Current light         | Refreshed dark       | Refreshed light          |
| -------------- | -------------------- | --------------------- | -------------------- | ------------------------ |
| Body           | `gray10` / `#181b1f` | `white` / `#ffffff`   | `ink850` / `#111419` | `white` / `#ffffff`      |
| Body on canvas | `gray05` / `#111217` | `gray100` / `#fbfbfb` | `ink900` / `#090b0f` | `neutral50` / `#fafafa`  |
| Header         | `gray20` / `#2c2f35` | `gray90` / `#ececed`  | `ink700` / `#202429` | `neutral150` / `#f0f0ef` |
| Stripe         | `gray15` / `#22252b` | `gray95` / `#f4f5f5`  | `ink750` / `#191d22` | `neutral100` / `#f5f5f4` |
| Hover          | `#34363a`            | `#e0e0e0`             | `#2e3035`            | `#e0e0e0`                |

The refreshed header and stripe values are the explicit palette choices from
[Antonio's table-styles branch](https://github.com/grafana/grafana/tree/jotasolano/table-styles).
Header drag surfaces retain its 10% / 5% emphasis of the header background. The
12% hover overlay follows the later hover fix in
[the zebra PR](https://github.com/grafana/grafana/pull/132423); it keeps hover
separate from the header. Those derived interaction values are recorded in the
refreshed theme definitions rather than calculated by table components.

Selection preserves the existing TableNG calculation. In particular, darkening
the refreshed dark warning color by 37 percentage points produces black. This
proposal records that existing result; redesigning selection is a separate choice.

## Inheritance and overrides

Defaults are built after resolving the theme's generic colors. The current themes
use their existing gray palette: `secondary.main` for headers and
`background.secondary` for stripes. Custom themes therefore inherit their own
surfaces, borders and accents rather than a fixed gray table. Refreshed themes
override the table section with explicit values and resolved `palette.*` references.

Every input field is optional; every output field is populated. A partial override
changes only that role. If a theme changes a header or body color substantially,
it should also review the corresponding hover and drag colors.

```ts
const theme = createTheme({
  colors: {
    mode: 'dark',
  },
  components: {
    table: {
      headerBackground: '#202429',
      rowStripedBackground: '#191d22',
    },
  },
});
```

## Adoption

1. Add these tokens without changing any consumer.
2. Migrate TableNG to the tokens, including its header surface and header dividers.
3. Have the existing zebra PR consume `rowStripedBackground` and `rowHoverOverlay`.
   This proposal does not add a zebra option or row striping behavior.
4. Migrate InteractiveTable (header/body dividers, computed hover and drag state)
   and the table layout of VizLegend (header/body surfaces and dividers).

Other candidates include TableRT and feature-specific HTML tables. Existing
`components.table.rowHoverBackground` and `components.table.rowSelected` values
remain unchanged so current consumers keep their behavior. New consumers use
`rowHoverBackgroundSolid` and `rowSelectedBackground` for opaque surfaces; the
existing tokens may be translucent. Generic text, link,
popup, scrollbar and shadow tokens remain shared; field-configured thresholds,
gauge fills and pill colors remain data-driven.
