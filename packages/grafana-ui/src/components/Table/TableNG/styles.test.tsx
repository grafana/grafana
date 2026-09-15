import { render } from '@testing-library/react';

import {
  applyFieldOverrides,
  createTheme,
  type DataFrame,
  FieldType,
  getThemeById,
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
    rowHoverBackground: computed.getPropertyValue('--rdg-row-hover-background-color'),
    selectedRowHoverBackground: computed.getPropertyValue('--rdg-row-selected-hover-background-color'),
    // Emotion's injected rules accumulate across cases in a file, so anything read back out of the
    // stylesheet has to be scoped to the class this render actually produced.
    gridClass: Array.from(grid.classList).find((c) => c.startsWith('css-')) ?? '',
    frozenBackgrounds: Array.from(container.querySelectorAll('.rdg-row:not(.rdg-summary-row) .rdg-cell-frozen')).map(
      (cell) => window.getComputedStyle(cell).backgroundColor
    ),
    /** Background each body row resolves to, in document order. */
    rowBackgrounds: Array.from(container.querySelectorAll('.rdg-row:not(.rdg-summary-row)')).map(
      (row) => window.getComputedStyle(row).backgroundColor
    ),
  };
}

// jsdom does not apply :hover, so inspect the rule generated for this grid's Emotion class.
function hoverRuleFor(gridClass: string): CSSStyleRule | undefined {
  for (const sheet of Array.from(document.styleSheets)) {
    for (const rule of Array.from(sheet.cssRules)) {
      if (
        rule instanceof CSSStyleRule &&
        rule.selectorText.startsWith(`.${gridClass} `) &&
        rule.selectorText.endsWith(':hover>.rdg-cell')
      ) {
        return rule;
      }
    }
  }
  return undefined;
}

describe('table zebra colors', () => {
  it.each([
    ['dark', 'rgb(34, 37, 43)'],
    ['light', 'rgb(244, 245, 245)'],
    ['visual_refresh_dark', 'rgb(25, 29, 34)'],
    ['visual_refresh_light', 'rgb(245, 245, 244)'],
  ])('uses the %s stripe token on alternating rows and their frozen cells', (id, stripe) => {
    const { rowBackgrounds, frozenBackgrounds } = gridVarsFor(getThemeById(id), {
      zebraStriping: true,
      frozenColumns: 1,
    });

    expect(rowBackgrounds).toHaveLength(4);
    expect(frozenBackgrounds).toHaveLength(4);
    for (const backgrounds of [rowBackgrounds, frozenBackgrounds]) {
      expect(backgrounds[1]).toBe(stripe);
      expect(backgrounds[3]).toBe(stripe);
      expect(backgrounds[0]).not.toBe(stripe);
      expect(backgrounds[2]).not.toBe(stripe);
    }
  });

  it.each([
    ['dark', 'rgba(255, 255, 255, 0.12)'],
    ['light', 'rgba(0, 0, 0, 0.12)'],
    ['visual_refresh_dark', 'hsl(from #ffffff h s l / 0.12)'],
    ['visual_refresh_light', 'hsl(from #000000 h s l / 0.12)'],
  ])('uses the %s hover overlay without replacing row or selection surfaces', (id, overlay) => {
    const { rowHoverBackground, selectedRowHoverBackground, gridClass } = gridVarsFor(getThemeById(id), {
      zebraStriping: true,
      tableRefreshEnabled: true,
    });

    expect(rowHoverBackground).toBe('var(--rdg-row-background-color)');
    expect(selectedRowHoverBackground).toBe('var(--rdg-row-selected-background-color)');
    const rule = hoverRuleFor(gridClass);
    expect(rule?.style.getPropertyValue('background-image')).toBe(`linear-gradient(${overlay}, ${overlay})`);
    expect(rule?.selectorText).toBe(
      `.${gridClass} .rdg-row:not(.rdg-summary-row, .table-ng-row-nested):hover>.rdg-cell`
    );
  });

  it.each([false, true])(
    'honors custom stripe and overlay tokens in a transparent panel with visualDesignRefresh=%s',
    (visualDesignRefresh) => {
      const theme = createTheme({
        components: {
          table: {
            backgroundOnCanvas: '#123456',
            rowStripedBackground: '#345678',
            rowHoverOverlay: 'rgba(12, 34, 56, 0.2)',
          },
        },
      });
      theme.flags.visualDesignRefresh = visualDesignRefresh;
      const { rowBackground, rowBackgrounds, gridClass } = gridVarsFor(theme, {
        zebraStriping: true,
        transparent: true,
      });

      expect(rowBackground).toBe('#123456');
      expect(rowBackgrounds[1]).toBe('rgb(52, 86, 120)');
      expect(hoverRuleFor(gridClass)?.style.getPropertyValue('background-image')).toBe(
        'linear-gradient(rgba(12, 34, 56, 0.2), rgba(12, 34, 56, 0.2))'
      );
    }
  );

  it.each([false, true])(
    'keeps solid hover colors and uniform rows when striping is off and table.refresh=%s',
    (tableRefreshEnabled) => {
      const { rowBackgrounds, rowHoverBackground, selectedRowHoverBackground, gridClass } = gridVarsFor(
        getThemeById('dark'),
        {
          tableRefreshEnabled,
          zebraStriping: false,
        }
      );

      expect(rowBackgrounds).toHaveLength(4);
      expect(new Set(rowBackgrounds).size).toBe(1);
      expect(rowHoverBackground).toBe('#34363a');
      expect(selectedRowHoverBackground).toBe('rgb(75, 50, 12)');
      expect(hoverRuleFor(gridClass)).toBeUndefined();
    }
  );
});
