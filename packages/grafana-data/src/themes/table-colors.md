# Table colors

`GrafanaTheme2.components.table` defines shared color roles for tabular surfaces. The
values are available in every theme, independently of feature toggles. Components
choose which states to render; they do not need to identify the theme or import a
palette.

## Roles

| Token                        | Usage                                                                       |
| ---------------------------- | --------------------------------------------------------------------------- |
| `headerBackground`           | Header surface                                                              |
| `rowStripedBackground`       | Alternating data rows; not headers, footers, or nested expansion containers |
| `rowHoverOverlay`            | Translucent tint over a row's existing background                           |
| `rowSelectedBackground`      | Selected row surface                                                        |
| `rowSelectedHoverBackground` | Solid hovered selection surface                                             |
| `cellSelectionBorder`        | Focused cell outline                                                        |

Background surfaces must be opaque where they hide scrolling or overflowing content.

The hover overlay retains the distinction between striped and plain rows and also
works over selected rows and transparent-panel backing surfaces. Consumers can
composite it onto a row surface when an opaque hover color is required, and must
apply it without covering field-configured cell colors or nested tables.

## Inheritance and overrides

Defaults are built after resolving the theme's generic colors. The current themes use
their existing gray palette: `secondary.main` for headers and `background.secondary`
for stripes. Custom themes therefore inherit their own surfaces and accents rather
than a fixed gray table. Refreshed themes override the table section with explicit
values and resolved `palette.*` references.

Every input field is optional; every output field is populated. A partial override
changes only that role. Consumers derive body backgrounds, dividers, and drag states
from the theme's generic colors and these table roles.

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
