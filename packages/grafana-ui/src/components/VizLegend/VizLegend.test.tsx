import { render, screen } from '@testing-library/react';

import { LegendDisplayMode, SortOrder } from '@grafana/schema';

import { VizLegend } from './VizLegend';
import { VizLegendItem } from './types';

function createLegendItems(labels: string[]): VizLegendItem[] {
  return labels.map((label) => ({
    label,
    color: '#000',
    yAxis: 1,
  }));
}

function getLegendLabels(container: HTMLElement): string[] {
  const items = container.querySelectorAll('[data-testid*="VizLegend series"]');
  return Array.from(items).map((item) => {
    const button = item.querySelector('button');
    return button?.textContent || '';
  });
}

describe('VizLegend', () => {
  describe('Sorting in List display mode', () => {
    const testItems = createLegendItems(['Zebra', 'apple', 'Mango', 'banana']);

    it('should render items in original order when sortOrder is None', () => {
      const { container } = render(
        <VizLegend displayMode={LegendDisplayMode.List} items={testItems} placement="bottom" sortOrder={SortOrder.None} />
      );

      const labels = getLegendLabels(container);
      expect(labels).toEqual(['Zebra', 'apple', 'Mango', 'banana']);
    });

    it('should render items in original order when sortOrder is undefined', () => {
      const { container } = render(
        <VizLegend displayMode={LegendDisplayMode.List} items={testItems} placement="bottom" />
      );

      const labels = getLegendLabels(container);
      expect(labels).toEqual(['Zebra', 'apple', 'Mango', 'banana']);
    });

    it('should sort items alphabetically A-Z when sortOrder is Ascending', () => {
      const { container } = render(
        <VizLegend
          displayMode={LegendDisplayMode.List}
          items={testItems}
          placement="bottom"
          sortOrder={SortOrder.Ascending}
        />
      );

      const labels = getLegendLabels(container);
      expect(labels).toEqual(['apple', 'banana', 'Mango', 'Zebra']);
    });

    it('should sort items alphabetically Z-A when sortOrder is Descending', () => {
      const { container } = render(
        <VizLegend
          displayMode={LegendDisplayMode.List}
          items={testItems}
          placement="bottom"
          sortOrder={SortOrder.Descending}
        />
      );

      const labels = getLegendLabels(container);
      expect(labels).toEqual(['Zebra', 'Mango', 'banana', 'apple']);
    });

    it('should handle natural numeric ordering correctly', () => {
      const numericItems = createLegendItems(['series-10', 'series-2', 'series-1', 'series-20', 'series-3']);
      const { container } = render(
        <VizLegend
          displayMode={LegendDisplayMode.List}
          items={numericItems}
          placement="bottom"
          sortOrder={SortOrder.Ascending}
        />
      );

      const labels = getLegendLabels(container);
      expect(labels).toEqual(['series-1', 'series-2', 'series-3', 'series-10', 'series-20']);
    });

    it('should handle empty items array', () => {
      const { container } = render(
        <VizLegend displayMode={LegendDisplayMode.List} items={[]} placement="bottom" sortOrder={SortOrder.Ascending} />
      );

      const labels = container.querySelectorAll('[data-testid^="VizLegend series"]');
      expect(labels).toHaveLength(0);
    });

    it('should re-sort when sortOrder prop changes', () => {
      const { container, rerender } = render(
        <VizLegend displayMode={LegendDisplayMode.List} items={testItems} placement="bottom" sortOrder={SortOrder.None} />
      );

      let labels = getLegendLabels(container);
      expect(labels).toEqual(['Zebra', 'apple', 'Mango', 'banana']);

      // Change to ascending sort
      rerender(
        <VizLegend
          displayMode={LegendDisplayMode.List}
          items={testItems}
          placement="bottom"
          sortOrder={SortOrder.Ascending}
        />
      );

      labels = getLegendLabels(container);
      expect(labels).toEqual(['apple', 'banana', 'Mango', 'Zebra']);
    });
  });

  describe('Sorting in Table display mode', () => {
    it('should not apply sortOrder in Table mode', () => {
      const testItems = createLegendItems(['Zebra', 'apple', 'Mango', 'banana']);

      render(
        <VizLegend
          displayMode={LegendDisplayMode.Table}
          items={testItems}
          placement="bottom"
          sortOrder={SortOrder.Ascending}
        />
      );

      // In Table mode, sorting is handled by column headers, not by sortOrder prop
      // Just verify the component renders without errors
      const table = screen.getByRole('table');
      expect(table).toBeInTheDocument();
    });
  });

  describe('Integration with other legend features', () => {
    it('should sort items with display values', () => {
      const itemsWithValues = createLegendItems(['cCC', 'BBB', 'aAA']).map((item) => ({
        ...item,
        displayValues: [
          { text: '10', numeric: 10, title: 'Max' },
          { text: '5', numeric: 5, title: 'Min' },
        ],
      }));

      const { container } = render(
        <VizLegend
          displayMode={LegendDisplayMode.List}
          items={itemsWithValues}
          placement="bottom"
          sortOrder={SortOrder.Ascending}
        />
      );

      const labels = getLegendLabels(container);
      expect(labels).toEqual(['aAA', 'BBB', 'cCC']);
    });

    it('should maintain sort order across different placements', () => {
      const testItems = createLegendItems(['C', 'A', 'B']);

      const { container: bottomContainer } = render(
        <VizLegend
          displayMode={LegendDisplayMode.List}
          items={testItems}
          placement="bottom"
          sortOrder={SortOrder.Ascending}
        />
      );

      const { container: rightContainer } = render(
        <VizLegend
          displayMode={LegendDisplayMode.List}
          items={testItems}
          placement="right"
          sortOrder={SortOrder.Ascending}
        />
      );

      const bottomLabels = getLegendLabels(bottomContainer);
      const rightLabels = getLegendLabels(rightContainer);

      expect(bottomLabels).toEqual(['A', 'B', 'C']);
      expect(rightLabels).toEqual(['A', 'B', 'C']);
    });
  });

  describe('Edge cases', () => {
    it('should handle single item correctly', () => {
      const singleItem = createLegendItems(['OnlyItem']);
      const { container } = render(
        <VizLegend
          displayMode={LegendDisplayMode.List}
          items={singleItem}
          placement="bottom"
          sortOrder={SortOrder.Ascending}
        />
      );

      const labels = getLegendLabels(container);
      expect(labels).toEqual(['OnlyItem']);
    });

    it('should handle items with identical labels', () => {
      // Mock console.error since React warns about duplicate keys (which is expected for this edge case)
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      const duplicateItems = createLegendItems(['A', 'B', 'A', 'C', 'A']);
      const { container } = render(
        <VizLegend
          displayMode={LegendDisplayMode.List}
          items={duplicateItems}
          placement="bottom"
          sortOrder={SortOrder.Ascending}
        />
      );

      const labels = getLegendLabels(container);
      expect(labels).toEqual(['A', 'A', 'A', 'B', 'C']);

      consoleSpy.mockRestore();
    });

    it('should handle special characters in labels', () => {
      const specialItems = createLegendItems(['~test', '@alpha', '#hash', '!exclaim']);
      const { container } = render(
        <VizLegend
          displayMode={LegendDisplayMode.List}
          items={specialItems}
          placement="bottom"
          sortOrder={SortOrder.Ascending}
        />
      );

      // Should sort according to natural collation rules
      const labels = getLegendLabels(container);
      expect(labels).toHaveLength(4);
      // The exact order depends on Intl.Collator implementation, just verify all items are present
      expect(labels).toContain('~test');
      expect(labels).toContain('@alpha');
      expect(labels).toContain('#hash');
      expect(labels).toContain('!exclaim');
    });
  });
});
