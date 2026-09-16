# Table colors

`GrafanaTheme2.components.table` defines shared color roles for tabular surfaces. The
values are available in every theme, independently of feature toggles. Components
choose which states to render; they do not need to identify the theme or import a
palette.

## Roles

| Token                        | Usage                                                                       |
| ---------------------------- | --------------------------------------------------------------------------- |
| `headerBackground`           | Header surface                                                              |
| `border`                     | Body and footer dividers                                                    |
| `rowStripedBackground`       | Alternating data rows; not headers, footers, or nested expansion containers |
| `rowHoverSurface`            | Solid hover surface for an unstriped row                                    |
| `rowHoverOverlay`            | Translucent tint over a row's existing background                           |
| `rowSelectedBackground`      | Selected row surface                                                        |
| `rowSelectedHoverBackground` | Solid hovered selection surface                                             |
| `cellSelectionBorder`        | Focused cell outline                                                        |

Background surfaces and dividers must be opaque where they cover field-configured
cell backgrounds or scrolling content.

Use the solid hover surface for plain rows and the hover overlay when the underlying
surface must remain visible, such as striped or selected rows. Consumers must apply
the overlay without covering field-configured cell colors or nested tables.

## Inheritance and overrides

Defaults are built after resolving the theme's generic colors. The current themes use
their existing gray palette: `secondary.main` for headers and `background.secondary`
for stripes. Custom themes therefore inherit their own surfaces and accents rather
than a fixed gray table. Refreshed themes override the table section with explicit
values and resolved `palette.*` references.

Every input field is optional; every output field is populated. A partial override
changes only that role. Consumers derive body backgrounds, header dividers, and drag
states from the theme's generic colors and these table roles.

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
