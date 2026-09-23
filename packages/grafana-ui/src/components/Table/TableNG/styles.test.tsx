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

function computedColor(color: string): string {
  const element = document.createElement('div');
  element.style.backgroundColor = color;
  document.body.appendChild(element);
  const computed = window.getComputedStyle(element).backgroundColor;
  element.remove();
  return computed;
}

describe('table zebra colors', () => {
  it.each(['dark', 'light', 'visual_refresh_dark', 'visual_refresh_light'])(
    'uses the %s stripe token on alternating rows and their frozen cells',
    (id) => {
      const theme = getThemeById(id);
      const { rowBackgrounds, frozenBackgrounds } = gridVarsFor(theme, {
        zebraStriping: true,
        frozenColumns: 1,
      });

      expect(rowBackgrounds).toHaveLength(4);
      expect(frozenBackgrounds).toHaveLength(4);
      for (const backgrounds of [rowBackgrounds, frozenBackgrounds]) {
        expect(backgrounds[1]).toBe(computedColor(theme.components.table.rowStripedBackground));
        expect(backgrounds[3]).toBe(computedColor(theme.components.table.rowStripedBackground));
        expect(backgrounds[0]).not.toBe(computedColor(theme.components.table.rowStripedBackground));
        expect(backgrounds[2]).not.toBe(computedColor(theme.components.table.rowStripedBackground));
      }
    }
  );

  it.each(['dark', 'light', 'visual_refresh_dark', 'visual_refresh_light'])(
    'uses the %s hover background for striped rows',
    (id) => {
      const theme = getThemeById(id);
      const { rowHoverBackground, selectedRowHoverBackground, gridClass } = gridVarsFor(theme, {
        zebraStriping: true,
        tableRefreshEnabled: true,
      });

      expect(rowHoverBackground).toBe(theme.components.table.rowHoverBackground);
      expect(selectedRowHoverBackground).toBe(
        theme.colors.emphasize(theme.components.table.rowSelectedBackground, 0.05)
      );
      const rule = hoverRuleFor(gridClass);
      expect(rule?.style.getPropertyValue('background-color')).toBe(theme.components.table.rowHoverBackground);
      expect(rule?.selectorText).toBe(
        `.${gridClass} .rdg-row:not(.rdg-summary-row, .table-ng-row-nested, [aria-selected='true']):hover>.rdg-cell`
      );
    }
  );

  it.each([false, true])(
    'honors custom stripe and hover tokens in a transparent panel with visualDesignRefresh=%s',
    (visualDesignRefresh) => {
      const theme = createTheme({
        colors: { mode: 'dark', background: { canvas: '#123456', page: '#123456' } },
        components: {
          table: {
            rowStripedBackground: '#345678',
            rowHoverBackground: '#56789a',
          },
        },
      });
      theme.flags.visualDesignRefresh = visualDesignRefresh;
      const { rowBackground, rowBackgrounds, gridClass } = gridVarsFor(theme, {
        zebraStriping: true,
        transparent: true,
      });

      expect(rowBackground).toBe(theme.colors.background.canvas);
      expect(rowBackgrounds[1]).toBe(computedColor(theme.components.table.rowStripedBackground));
      expect(hoverRuleFor(gridClass)?.style.getPropertyValue('background-color')).toBe(
        theme.components.table.rowHoverBackground
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
      const theme = getThemeById('dark');
      expect(rowHoverBackground).toBe(theme.components.table.rowHoverBackground);
      expect(selectedRowHoverBackground).toBe(
        theme.colors.emphasize(theme.components.table.rowSelectedBackground, 0.05)
      );
      expect(hoverRuleFor(gridClass)).toBeUndefined();
    }
  );
});
