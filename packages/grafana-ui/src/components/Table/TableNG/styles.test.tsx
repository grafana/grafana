import { render } from '@testing-library/react';

import {
  applyFieldOverrides,
  createTheme,
  type DataFrame,
  FieldType,
  type GrafanaTheme2,
  ThemeContext,
  toDataFrame,
} from '@grafana/data';
import { mockClientSize } from '@grafana/test-utils';

import { TableNG } from './TableNG';

// react-data-grid sizes its virtualized viewport from the client box, which jsdom reports as 0 - without
// this the grid renders no rows at all.
beforeAll(() => {
  mockClientSize({ width: 800, height: 600 });
});

const makeFrame = (theme: GrafanaTheme2): DataFrame =>
  applyFieldOverrides({
    data: [
      toDataFrame({
        fields: [
          { name: 'name', type: FieldType.string, values: ['a', 'b', 'c', 'd'] },
          { name: 'value', type: FieldType.number, values: [1, 2, 3, 4] },
        ],
      }),
    ],
    fieldConfig: { defaults: {}, overrides: [] },
    replaceVariables: (value) => value,
    timeZone: 'utc',
    theme,
  })[0];

/** Renders the grid under `theme` and hands back the custom properties `getGridStyles` set on it. */
function gridVarsFor(theme: GrafanaTheme2, props: Partial<React.ComponentProps<typeof TableNG>> = {}) {
  const { container } = render(
    <ThemeContext.Provider value={theme}>
      <TableNG data={makeFrame(theme)} width={800} height={600} {...props} />
    </ThemeContext.Provider>
  );

  const grid = container.querySelector('[role="grid"]');
  if (!grid) {
    throw new Error('grid did not render');
  }
  const computed = window.getComputedStyle(grid);

  return {
    rowBackground: computed.getPropertyValue('--rdg-row-background-color'),
    headerBackground: computed.getPropertyValue('--rdg-header-background-color'),
    rowHoverBackground: computed.getPropertyValue('--rdg-row-hover-background-color'),
    borderColor: computed.getPropertyValue('--rdg-border-color'),
    /** Background each body row resolves to, in document order. */
    rowBackgrounds: Array.from(container.querySelectorAll('.rdg-row:not(.rdg-summary-row)')).map(
      (row) => window.getComputedStyle(row).backgroundColor
    ),
  };
}

const darkTheme = createTheme({ colors: { mode: 'dark' } });
const lightTheme = createTheme({ colors: { mode: 'light' } });

describe('getGridStyles', () => {
  describe('table.refresh header surface', () => {
    it.each([
      ['dark', darkTheme, 'rgb(37, 40, 44)'],
      ['light', lightTheme, 'rgb(239, 239, 239)'],
    ])('steps the header off the row background in a %s theme', (_name, theme, expected) => {
      const { rowBackground, headerBackground } = gridVarsFor(theme, { tableRefreshEnabled: true });

      expect(headerBackground).toBe(expected);
      expect(headerBackground).not.toBe(rowBackground);
    });

    it.each([
      ['dark', darkTheme],
      ['light', lightTheme],
    ])('leaves the header on the row background with the flag off in a %s theme', (_name, theme) => {
      const { rowBackground, headerBackground } = gridVarsFor(theme, { tableRefreshEnabled: false });

      expect(headerBackground).toBe(rowBackground);
    });

    it('steps off the canvas, not the panel, when the panel is transparent', () => {
      const opaque = gridVarsFor(darkTheme, { tableRefreshEnabled: true });
      const transparent = gridVarsFor(darkTheme, { tableRefreshEnabled: true, transparent: true });

      // The canvas sits below the panel background, so the surface derived from it lands darker -
      // the point being that it is still derived, rather than falling back to a panel-relative color
      // that would read as lighter than the canvas it sits on.
      expect(transparent.headerBackground).not.toBe(opaque.headerBackground);
      expect(transparent.headerBackground).not.toBe(transparent.rowBackground);
    });
  });

  describe('table.refresh grid lines', () => {
    it('strengthens the dark-theme grid line, which border.weak loses against the header surface', () => {
      const refreshed = gridVarsFor(darkTheme, { tableRefreshEnabled: true });
      const legacy = gridVarsFor(darkTheme, { tableRefreshEnabled: false });

      expect(refreshed.borderColor).toBe('#3c3e45');
      expect(legacy.borderColor).toBe('#2e3036');
    });

    it('leaves the light-theme grid line on border.weak, where the step darkens instead', () => {
      const refreshed = gridVarsFor(lightTheme, { tableRefreshEnabled: true });
      const legacy = gridVarsFor(lightTheme, { tableRefreshEnabled: false });

      expect(refreshed.borderColor).toBe(legacy.borderColor);
    });
  });

  describe('zebra striping', () => {
    it.each([
      ['dark', darkTheme, 'rgb(33, 36, 39)'],
      ['light', lightTheme, 'rgb(244, 244, 244)'],
    ])('stripes every other row in a %s theme, starting from the second', (_name, theme, stripe) => {
      const { rowBackgrounds } = gridVarsFor(theme, { zebraStriping: true });

      expect(rowBackgrounds).toHaveLength(4);
      // The first row keeps the plain row background, which the grid sets as a custom property
      // rather than a color of its own - so the stripe is what distinguishes them here.
      expect(rowBackgrounds[1]).toBe(stripe);
      expect(rowBackgrounds[3]).toBe(stripe);
      expect(rowBackgrounds[0]).not.toBe(stripe);
      expect(rowBackgrounds[2]).not.toBe(stripe);
    });

    it('leaves every row on the same background with the option off', () => {
      const { rowBackgrounds } = gridVarsFor(darkTheme, { zebraStriping: false });

      expect(rowBackgrounds).toHaveLength(4);
      expect(new Set(rowBackgrounds).size).toBe(1);
    });

    // Hover is drawn as an overlay on the hovered cells instead, so that it is the same relative
    // step over a plain row and a striped one. jsdom never applies `:hover`, so what is asserted
    // here is the half that is assertable: that the swap no longer moves the color.
    it.each([
      ['on', true],
      ['off', false],
    ])('stops hover replacing the row background, with table.refresh %s', (_name, tableRefreshEnabled) => {
      const { rowHoverBackground } = gridVarsFor(darkTheme, {
        zebraStriping: true,
        tableRefreshEnabled,
      });

      // Pointed at the row background rather than a color of its own, so the swap is a no-op and
      // the overlay is the only thing that moves.
      expect(rowHoverBackground).toBe('var(--rdg-row-background-color)');
    });

    it('leaves hover replacing the row background when striping is off', () => {
      const { rowHoverBackground, rowBackground, headerBackground } = gridVarsFor(darkTheme, {
        zebraStriping: false,
        tableRefreshEnabled: true,
      });

      expect(rowHoverBackground).toBe(headerBackground);
      expect(rowHoverBackground).not.toBe(rowBackground);
    });
  });
});
