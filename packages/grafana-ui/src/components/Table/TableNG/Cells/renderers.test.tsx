import { render } from '@testing-library/react';

import { createDataFrame, createTheme, Field, FieldType } from '@grafana/data';

import { TableCellOptions, TableCellDisplayMode, TableCustomCellOptions } from '../../types';

import { getCellRenderer } from './renderers';

// Performance testing utilities
const measurePerformance = (fn: () => void, iterations = 100) => {
  const start = performance.now();
  for (let i = 0; i < iterations; i++) {
    fn();
  }
  const end = performance.now();
  return (end - start) / iterations; // Average time per iteration
};

const createLargeTimeSeriesFrame = () => {
  const timeValues = Array.from({ length: 100 }, (_, i) => Date.now() + i * 1000);
  const valueValues = Array.from({ length: 100 }, (_, i) => Math.random() * 100);

  return createDataFrame({
    fields: [
      { name: 'time', type: FieldType.time, values: timeValues },
      { name: 'value', type: FieldType.number, values: valueValues },
    ],
  });
};

const createLargeJSONData = () => {
  return {
    id: 1,
    name: 'Test Object',
    metadata: {
      tags: Array.from({ length: 50 }, (_, i) => `tag-${i}`),
      properties: Array.from({ length: 100 }, (_, i) => ({ key: `prop-${i}`, value: `value-${i}` })),
      nested: {
        level1: {
          level2: {
            level3: {
              data: Array.from({ length: 20 }, (_, i) => ({ id: i, value: Math.random() })),
            },
          },
        },
      },
    },
    array: Array.from({ length: 200 }, (_, i) => ({ id: i, value: Math.random() * 1000 })),
  };
};

describe('TableNG Cells renderers', () => {
  describe('getCellRenderer', () => {
    // Helper function to create a basic field
    function createField<V>(type: FieldType, values: V[] = []): Field<V> {
      return {
        name: 'test',
        type,
        values,
        config: {},
        state: {},
        display: jest.fn(() => ({ text: 'black', color: 'white', numeric: 0 })),
        // @ts-ignore: this mock works fine for this test.
        getLinks: jest.fn(() => [
          {
            title: 'example',
            href: 'http://example.com',
            target: '_blank',
            origin: {},
          },
        ]),
      };
    }

    // Helper function to render a cell and get the test ID
    const renderCell = (field: Field, cellOptions: TableCellOptions) =>
      render(
        getCellRenderer(
          field,
          cellOptions
        )({
          field,
          value: 'test-value',
          rowIdx: 0,
          frame: createDataFrame({ fields: [field] }),
          height: 100,
          width: 100,
          theme: createTheme(),
          cellOptions,
          cellInspect: false,
          showFilters: false,
          justifyContent: 'flex-start',
        })
      );

    // Performance test helper
    const benchmarkCellPerformance = (field: Field, cellOptions: TableCellOptions, iterations = 100) => {
      // eslint-disable-next-line testing-library/render-result-naming-convention
      const r = getCellRenderer(field, cellOptions);
      return measurePerformance(() => {
        render(
          r({
            field,
            value: 'test-value',
            rowIdx: 0,
            frame: createDataFrame({ fields: [field] }),
            height: 100,
            width: 100,
            theme: createTheme(),
            cellOptions,
            cellInspect: false,
            showFilters: false,
            justifyContent: 'flex-start',
          })
        );
      }, iterations);
    };

    describe('explicit cell type cases', () => {
      it.each([
        { type: TableCellDisplayMode.Sparkline, fieldType: FieldType.number },
        { type: TableCellDisplayMode.Gauge, fieldType: FieldType.number },
        { type: TableCellDisplayMode.JSONView, fieldType: FieldType.string },
        { type: TableCellDisplayMode.Image, fieldType: FieldType.string },
        { type: TableCellDisplayMode.DataLinks, fieldType: FieldType.string },
        { type: TableCellDisplayMode.Actions, fieldType: FieldType.string },
        { type: TableCellDisplayMode.ColorText, fieldType: FieldType.string },
        { type: TableCellDisplayMode.ColorBackground, fieldType: FieldType.string },
        { type: TableCellDisplayMode.Auto, fieldType: FieldType.string },
      ] as const)('should render $type cell into the document', ({ type, fieldType }) => {
        const field = createField(fieldType);
        const { container } = renderCell(field, { type });
        expect(container).toBeInTheDocument();
        expect(container.childNodes).toHaveLength(1);
      });

      describe('invalid config cases', () => {
        it('should return AutoCell when cellOptions.type is undefined', () => {
          const field = createField(FieldType.string);

          const { container } = renderCell(field, { type: undefined } as unknown as TableCellOptions);
          expect(container).toBeInTheDocument();
          expect(container.childNodes).toHaveLength(1);
        });

        it('should return AutoCell when cellOptions is undefined', () => {
          const field = createField(FieldType.string);

          const { container } = renderCell(field, undefined as unknown as TableCellOptions);
          expect(container).toBeInTheDocument();
          expect(container.childNodes).toHaveLength(1);
        });

        it('should return AutoCell when cellOptions is unmapped', () => {
          const field = createField(FieldType.string);

          const { container } = renderCell(field, { type: 'number' } as unknown as TableCellOptions);
          expect(container).toBeInTheDocument();
          expect(container.childNodes).toHaveLength(1);
        });
      });
    });

    describe('auto mode field type cases', () => {
      it('should return GeoCell for geo field type', () => {
        const field = createField(FieldType.geo);

        const { container } = renderCell(field, { type: TableCellDisplayMode.Auto });
        expect(container).toBeInTheDocument();
        expect(container.childNodes).toHaveLength(1);
      });

      it('should return SparklineCell for frame field type with time series', () => {
        const timeSeriesFrame = createDataFrame({
          fields: [
            { name: 'time', type: FieldType.time, values: [1, 2, 3] },
            { name: 'value', type: FieldType.number, values: [1, 2, 3] },
          ],
        });
        const field = createField(FieldType.frame, [timeSeriesFrame]);

        const { container } = renderCell(field, { type: TableCellDisplayMode.Auto });
        expect(container).toBeInTheDocument();
        expect(container.childNodes).toHaveLength(1);
      });

      it('should return JSONCell for frame field type with non-time series', () => {
        const regularFrame = createDataFrame({
          fields: [
            { name: 'name', type: FieldType.string, values: ['a', 'b', 'c'] },
            { name: 'value', type: FieldType.number, values: [1, 2, 3] },
          ],
        });
        const field = createField(FieldType.frame, [regularFrame]);

        const { container } = renderCell(field, { type: TableCellDisplayMode.Auto });
        expect(container).toBeInTheDocument();
        expect(container.childNodes).toHaveLength(1);
      });

      it('should return JSONCell for other field type', () => {
        const field = createField(FieldType.other);

        const { container } = renderCell(field, { type: TableCellDisplayMode.Auto });
        expect(container).toBeInTheDocument();
        expect(container.childNodes).toHaveLength(1);
      });

      it('should return AutoCell for string field type', () => {
        const field = createField(FieldType.string);

        const { container } = renderCell(field, { type: TableCellDisplayMode.Auto });
        expect(container).toBeInTheDocument();
        expect(container.childNodes).toHaveLength(1);
      });

      it('should return AutoCell for number field type', () => {
        const field = createField(FieldType.number);

        const { container } = renderCell(field, { type: TableCellDisplayMode.Auto });
        expect(container).toBeInTheDocument();
        expect(container.childNodes).toHaveLength(1);
      });

      it('should return AutoCell for boolean field type', () => {
        const field = createField(FieldType.boolean);

        const { container } = renderCell(field, { type: TableCellDisplayMode.Auto });
        expect(container).toBeInTheDocument();
        expect(container.childNodes).toHaveLength(1);
      });

      it('should return AutoCell for time field type', () => {
        const field = createField(FieldType.time);

        const { container } = renderCell(field, { type: TableCellDisplayMode.Auto });
        expect(container).toBeInTheDocument();
        expect(container.childNodes).toHaveLength(1);
      });
    });

    describe('custom cell renderer cases', () => {
      it('should return custom cell component for Custom type with valid cellComponent', () => {
        const CustomComponent = () => <div data-testid="custom-cell">CustomCell</div>;
        const field = createField(FieldType.string);

        const { container } = renderCell(field, {
          type: TableCellDisplayMode.Custom,
          cellComponent: CustomComponent,
        });
        expect(container).toBeInTheDocument();
        expect(container.childNodes).toHaveLength(1);
      });

      it('(invalid) should return null for Custom type without cellComponent', () => {
        const field = createField(FieldType.string);

        const { container } = renderCell(field, {
          type: TableCellDisplayMode.Custom,
          cellComponent: undefined,
        } as unknown as TableCustomCellOptions);

        expect(container.childNodes).toHaveLength(0);
      });
    });

    describe('edge cases', () => {
      it('should handle empty field values array', () => {
        const field = createField(FieldType.frame, []);

        const { container } = renderCell(field, { type: TableCellDisplayMode.Auto });
        expect(container).toBeInTheDocument();
        expect(container.childNodes).toHaveLength(1);
      });

      it('should handle field with null values', () => {
        const field = createField(FieldType.frame, [null]);

        const { container } = renderCell(field, { type: TableCellDisplayMode.Auto });
        expect(container).toBeInTheDocument();
        expect(container.childNodes).toHaveLength(1);
      });

      it('should handle field with undefined values', () => {
        const field = createField(FieldType.frame, [undefined]);

        const { container } = renderCell(field, { type: TableCellDisplayMode.Auto });
        expect(container).toBeInTheDocument();
        expect(container.childNodes).toHaveLength(1);
      });
    });

    describe.skip('performance benchmarks', () => {
      // Performance thresholds (in milliseconds)
      // these thresholds are tweaked based on performance on CI, not on a typical dev machine.
      const PERFORMANCE_THRESHOLDS = {
        FAST: 1, // Should render in under 1ms
        MEDIUM: 2.5, // Should render in under 2.5ms
        SLOW: 5, // Should render in under 5ms
      };

      describe('explicit cell type performance', () => {
        it.each([
          { type: TableCellDisplayMode.Sparkline, threshold: PERFORMANCE_THRESHOLDS.MEDIUM },
          { type: TableCellDisplayMode.Gauge, threshold: PERFORMANCE_THRESHOLDS.SLOW },
          { type: TableCellDisplayMode.JSONView, threshold: PERFORMANCE_THRESHOLDS.FAST },
          { type: TableCellDisplayMode.Image, threshold: PERFORMANCE_THRESHOLDS.FAST },
          { type: TableCellDisplayMode.DataLinks, threshold: PERFORMANCE_THRESHOLDS.FAST },
          { type: TableCellDisplayMode.Actions, threshold: PERFORMANCE_THRESHOLDS.FAST },
          { type: TableCellDisplayMode.ColorText, threshold: PERFORMANCE_THRESHOLDS.FAST },
          { type: TableCellDisplayMode.ColorBackground, threshold: PERFORMANCE_THRESHOLDS.FAST },
          { type: TableCellDisplayMode.Auto, threshold: PERFORMANCE_THRESHOLDS.FAST },
        ] as const)('should render $type within performance threshold', ({ type, threshold }) => {
          const field = createField(FieldType.number);
          const avgTime = benchmarkCellPerformance(field, { type }, 100);
          expect(avgTime).toBeLessThan(threshold);
        });
      });

      describe('custom cell renderer performance', () => {
        it('should render custom cell component within performance threshold', () => {
          const CustomComponent = () => <div data-testid="custom-cell">CustomCell</div>;
          const field = createField(FieldType.string);
          const avgTime = benchmarkCellPerformance(
            field,
            {
              type: TableCellDisplayMode.Custom,
              cellComponent: CustomComponent,
            },
            50
          );
          expect(avgTime).toBeLessThan(PERFORMANCE_THRESHOLDS.FAST);
        });
      });

      describe('large data performance', () => {
        it('should render JSONCell with large JSON data within performance threshold', () => {
          const largeJSON = createLargeJSONData();
          const field = createField(FieldType.string, [JSON.stringify(largeJSON)]);
          const avgTime = benchmarkCellPerformance(field, { type: TableCellDisplayMode.JSONView }, 20);
          expect(avgTime).toBeLessThan(PERFORMANCE_THRESHOLDS.SLOW);
        });

        it('should render SparklineCell with large time series within performance threshold', () => {
          const largeTimeSeriesFrame = createLargeTimeSeriesFrame();
          const field = createField(FieldType.frame, [largeTimeSeriesFrame]);
          const avgTime = benchmarkCellPerformance(field, { type: TableCellDisplayMode.Sparkline }, 10);
          expect(avgTime).toBeLessThan(PERFORMANCE_THRESHOLDS.MEDIUM);
        });

        it('should render AutoCell with large string data within performance threshold', () => {
          const largeString = 'x'.repeat(10000); // 10KB string
          const field = createField(FieldType.string, [largeString]);
          const avgTime = benchmarkCellPerformance(field, { type: TableCellDisplayMode.Auto }, 30);
          expect(avgTime).toBeLessThan(PERFORMANCE_THRESHOLDS.MEDIUM);
        });
      });
    });
  });
});
