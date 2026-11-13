/** @jest-environment jsdom */

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { mockBoundingClientRect, mockClientSize } from '@grafana/test-utils';

import { TableNG } from './TableNG';
import { createJsonDataFrame, wrappedFrame } from './TableNG.testUtils';
import { OVERFLOW_CELL_CLASS } from './constants';

// react-data-grid sizes its virtualized viewport from the client box, which jsdom reports as 0 - without
// this the grid renders no rows at all.
beforeAll(() => {
  // Keep offsetWidth consistent with clientWidth so delayed scrollbar measurement cannot go negative.
  mockBoundingClientRect({ width: 800, height: 600 });
  mockClientSize({ width: 800, height: 600 });
});

// Happy DOM does not support the vendor clamping declarations or :focus-within used by these cases.
describe('TableNG', () => {
  const originalResizeObserver = global.ResizeObserver;

  beforeEach(() => {
    global.ResizeObserver = class ResizeObserver {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
  });

  afterEach(() => {
    global.ResizeObserver = originalResizeObserver;
  });

  describe('Text wrapping', () => {
    it.each([false, true])('clamps wrapped rows with table.refresh=%s', (tableRefreshEnabled) => {
      render(
        <TableNG
          data={wrappedFrame(['wrapped message'])}
          width={800}
          height={600}
          maxRowHeight={100}
          tableRefreshEnabled={tableRefreshEnabled}
        />
      );
      const text = screen.getByText('wrapped message');
      if (tableRefreshEnabled) {
        expect(text).toHaveStyle({ display: '-webkit-box' });
      } else {
        expect(text.parentElement).toHaveAttribute('role', 'gridcell');
      }
      // jsdom omits vendor-prefixed properties from computed styles.
      const clamp = Array.from(document.styleSheets)
        .flatMap((sheet) => Array.from(sheet.cssRules))
        .find(
          (rule): rule is CSSStyleRule =>
            rule instanceof CSSStyleRule &&
            rule.style.getPropertyValue('-webkit-line-clamp') === '4' &&
            text.matches(rule.selectorText)
        );
      expect(clamp?.style.getPropertyValue('-webkit-box-orient')).toBe('vertical');
      expect(clamp?.style.getPropertyValue('display')).toBe('-webkit-box');
    });

    it("never shrinks a hover-expanded JSON cell below the column's own width", async () => {
      // Only a max-width cap here would shrink a column already wider than it down to the cap the
      // moment it's hovered, which un-hovers it, which snaps it back — an infinite flicker. min-width
      // pins the floor to the cell's own size so the cap can only ever grow it, never shrink it.
      const user = userEvent.setup();
      const { container } = render(<TableNG data={createJsonDataFrame(false)} width={800} height={600} />);

      const cells = container.querySelectorAll('[role="gridcell"]');
      await user.click(cells[1]);

      const jsonCellStyles = window.getComputedStyle(cells[1]);
      expect(jsonCellStyles.getPropertyValue('min-width')).toBe('100%');
      expect(jsonCellStyles.getPropertyValue('max-width')).toBe('600px');
    });

    it('only expands a selected cell when hover overflow is disabled', async () => {
      const user = userEvent.setup();
      const { container } = render(
        <TableNG data={createJsonDataFrame(false)} width={800} height={600} hoverOverflow={false} />
      );

      const cell = container.querySelectorAll('[role="gridcell"]')[1];
      const expansionRules = Array.from(document.styleSheets)
        .flatMap((sheet) => Array.from(sheet.cssRules))
        .filter((rule): rule is CSSStyleRule => 'selectorText' in rule)
        .filter(
          (rule) =>
            Array.from(cell.classList).some(
              (className) => className !== OVERFLOW_CELL_CLASS && rule.selectorText.includes(`.${className}`)
            ) && rule.style.getPropertyValue('max-width') === '600px'
        );

      expect(expansionRules).not.toHaveLength(0);
      expect(expansionRules.every((rule) => rule.selectorText.includes('aria-selected'))).toBe(true);
      expect(expansionRules.every((rule) => !rule.selectorText.includes(':hover'))).toBe(true);

      await user.click(cell);
      expect(window.getComputedStyle(cell).getPropertyValue('max-width')).toBe('600px');
    });

    it('collapses a click-expanded JSON cell once focus leaves the table', async () => {
      // react-data-grid keeps a cell selected after the grid loses focus and exposes no way to clear
      // it, so the expanded state hangs off `:focus-within` rather than the selection alone. Without
      // that, clicking away from the table leaves the cell stuck open over its neighbors.
      const user = userEvent.setup();
      const { container } = render(<TableNG data={createJsonDataFrame(false)} width={800} height={600} />);

      const cells = container.querySelectorAll('[role="gridcell"]');
      await user.click(cells[1]);
      expect(window.getComputedStyle(cells[1]).getPropertyValue('max-width')).toBe('600px');

      await user.click(document.body);

      expect(cells[1]).toHaveAttribute('aria-selected', 'true');
      expect(window.getComputedStyle(cells[1]).getPropertyValue('max-width')).not.toBe('600px');
    });

    it('anchors a hover-expanded JSON cell to its top rather than centering the overflow', async () => {
      // The cell root inherits `align-items: center` from the default cell styles. Left unset here,
      // content taller than the max-height cap gets centered on the box's midpoint instead of pinned
      // to the top — pushing the first several lines into the negative-scroll region above scrollTop
      // 0, where they're unreachable no matter how far up you scroll.
      const user = userEvent.setup();
      const { container } = render(<TableNG data={createJsonDataFrame(false)} width={800} height={600} />);

      const cells = container.querySelectorAll('[role="gridcell"]');
      await user.click(cells[1]);

      const jsonCellStyles = window.getComputedStyle(cells[1]);
      expect(jsonCellStyles.getPropertyValue('align-items')).toBe('flex-start');
    });
  });
});
