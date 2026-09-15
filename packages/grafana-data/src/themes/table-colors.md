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
content. Divider tokens must also be opaque so field-configured cell backgrounds
do not change their appearance.

Use either the solid hover color or the hover overlay. Applying both would tint a
row twice. An overlay retains the distinction between striped and plain rows; it
also works over selected rows and transparent-panel backing surfaces. Consumers
must apply it without covering field-configured cell colors or nested tables.

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
