import { render, screen } from '@testing-library/react';

import { createDataFrame, FieldType } from '@grafana/data/dataframe';
import { getDisplayProcessor } from '@grafana/data/field';
import { createTheme } from '@grafana/data/themes';
import { DataFrameType, getDefaultTimeRange, LoadingState } from '@grafana/data/types';
import { selectors } from '@grafana/e2e-selectors';
import { HeatmapCellLayout, TooltipDisplayMode } from '@grafana/schema';

import { HeatmapTooltip } from './HeatmapTooltip';
import { type HeatmapData } from './fields';

const theme = createTheme();

jest.mock('app/features/dashboard/services/DashboardSrv', () => ({
  getDashboardSrv: () => ({
    getCurrent: () => ({
      formatDate: (v: number) => new Date(v).toISOString(),
    }),
  }),
}));

jest.mock('uplot', () => {
  const mock = jest.fn() as jest.Mock & { pxRatio: number };
  mock.pxRatio = 1;
  return mock;
});

jest.mock('./renderHistogram', () => ({
  renderHistogram: jest.fn(),
}));

/**
 * Stamps a DataFrame with display processors so formatted values work in tests.
 */
function stampFrameWithDisplay(frame: ReturnType<typeof createDataFrame>): ReturnType<typeof createDataFrame> {
  frame.fields.forEach((field) => {
    if (!field.display) {
      field.display = getDisplayProcessor({ field, theme });
    }
  });
  return frame;
}

/**
 * Creates minimal HeatmapData for dense heatmap tooltip tests.
 * 3x3 grid: x=[1000,2000,3000], y=[0,1,2], count values per cell.
 */
function createMinimalHeatmapData(overrides?: Partial<HeatmapData>): HeatmapData {
  const heatmap = stampFrameWithDisplay(
    createDataFrame({
      meta: { type: DataFrameType.HeatmapCells },
      fields: [
        {
          name: 'x',
          type: FieldType.time,
          values: [1000, 1000, 1000, 2000, 2000, 2000, 3000, 3000, 3000],
        },
        { name: 'y', type: FieldType.number, values: [0, 1, 2, 0, 1, 2, 0, 1, 2] },
        { name: 'count', type: FieldType.number, values: [5, 10, 15, 10, 20, 25, 15, 20, 30] },
      ],
    })
  );

  return {
    heatmap,
    heatmapColors: {
      palette: ['#000', '#111', '#222', '#333', '#444'],
      values: [0, 1, 2, 1, 2, 3, 2, 2, 4],
      minValue: 5,
      maxValue: 30,
    },
    xBucketSize: 1000,
    yBucketSize: 1,
    xBucketCount: 3,
    yBucketCount: 3,
    xLayout: HeatmapCellLayout.unknown,
    yLayout: HeatmapCellLayout.unknown,
    display: (v: number) => String(v),
    ...overrides,
  };
}

/**
 * Creates HeatmapData with sparse format (xMax, yMin, yMax fields).
 * getSparseCellMinMax requires xMax with config.interval.
 */
function createSparseHeatmapData(overrides?: Partial<HeatmapData>): HeatmapData {
  const heatmap = stampFrameWithDisplay(
    createDataFrame({
      meta: { type: DataFrameType.HeatmapCells },
      fields: [
        { name: 'xMin', type: FieldType.time, values: [500, 500, 1500, 1500] },
        { name: 'xMax', type: FieldType.time, values: [1000, 1000, 2000, 2000], config: { interval: 500 } },
        { name: 'yMin', type: FieldType.number, values: [1, 4, 1, 4] },
        { name: 'yMax', type: FieldType.number, values: [4, 16, 4, 16] },
        { name: 'count', type: FieldType.number, values: [5, 10, 15, 20] },
      ],
    })
  );

  return {
    heatmap,
    heatmapColors: {
      palette: ['#000', '#111', '#222'],
      values: [0, 1, 2, 3],
      minValue: 5,
      maxValue: 20,
    },
    xBucketSize: 500,
    yBucketCount: 2,
    yLayout: HeatmapCellLayout.le,
    display: (v: number) => String(v),
    ...overrides,
  };
}

/**
 * Creates HeatmapData with ordinal y display (meta.custom.yOrdinalDisplay).
 */
function createOrdinalHeatmapData(overrides?: Partial<HeatmapData>): HeatmapData {
  const heatmap = stampFrameWithDisplay(
    createDataFrame({
      meta: {
        type: DataFrameType.HeatmapCells,
        custom: {
          yOrdinalDisplay: ['0.005', '0.01', '0.025'],
          yOrdinalLabel: ['pod-xyz', 'pod-abc', 'pod-def'],
        },
      },
      fields: [
        { name: 'x', type: FieldType.time, values: [1000, 1000, 1000, 2000, 2000, 2000] },
        { name: 'y', type: FieldType.number, values: [0, 1, 2, 0, 1, 2] },
        { name: 'count', type: FieldType.number, values: [5, 10, 15, 10, 20, 25] },
      ],
    })
  );

  return {
    heatmap,
    heatmapColors: {
      palette: ['#000', '#111', '#222'],
      values: [0, 1, 2, 1, 2, 3],
      minValue: 5,
      maxValue: 25,
    },
    xBucketSize: 1000,
    yBucketSize: 1,
    xBucketCount: 2,
    yBucketCount: 3,
    xLayout: HeatmapCellLayout.unknown,
    yLayout: HeatmapCellLayout.le,
    display: (v: number) => String(v),
    ...overrides,
  };
}

/**
 * Creates HeatmapData with interval on x field (for Duration in tooltip).
 */
function createHeatmapDataWithInterval(overrides?: Partial<HeatmapData>): HeatmapData {
  const data = createMinimalHeatmapData(overrides);
  if (data.heatmap?.fields[0]) {
    data.heatmap.fields[0].config = { ...data.heatmap.fields[0].config, interval: 1000 };
  }
  return data;
}

describe('HeatmapTooltip', () => {
  const defaultProps = {
    mode: TooltipDisplayMode.Single,
    dataIdxs: [0, 0, 0],
    seriesIdx: 1,
    dataRef: { current: createMinimalHeatmapData() },
    isPinned: false,
    dismiss: jest.fn(),
    panelData: { state: LoadingState.Done, series: [], timeRange: getDefaultTimeRange() },
    replaceVariables: (v: string) => v,
  };

  describe('HeatmapHoverCell (dense heatmap)', () => {
    it('renders tooltip wrapper with header and content', () => {
      const dataRef = { current: createMinimalHeatmapData({ yLayout: HeatmapCellLayout.le }) };
      render(<HeatmapTooltip {...defaultProps} dataRef={dataRef} />);

      expect(screen.getByTestId(selectors.components.Panels.Visualization.Tooltip.Wrapper)).toBeVisible();
      expect(screen.getByText('5')).toBeVisible();
      expect(screen.getByText(/Bucket/)).toBeVisible();
    });

    it('renders bucket range in header for time x-axis', () => {
      render(<HeatmapTooltip {...defaultProps} />);

      expect(screen.getByTestId(selectors.components.Panels.Visualization.Tooltip.Wrapper)).toBeVisible();
      expect(screen.getByText(/count/)).toBeVisible();
    });

    it('renders count value and bucket range for cell', () => {
      const dataRef = { current: createMinimalHeatmapData({ yLayout: HeatmapCellLayout.le }) };
      render(<HeatmapTooltip {...defaultProps} dataRef={dataRef} dataIdxs={[0, 4, 0]} />);

      expect(screen.getByText('20')).toBeVisible();
      expect(screen.getByText(/Bucket/)).toBeVisible();
    });

    it('renders VizTooltipFooter when isPinned is true', () => {
      render(<HeatmapTooltip {...defaultProps} isPinned={true} />);

      const wrapper = screen.getByTestId(selectors.components.Panels.Visualization.Tooltip.Wrapper);
      expect(wrapper).toBeVisible();
      expect(wrapper.children.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('TooltipDisplayMode', () => {
    it('renders Single mode content with count and bucket', () => {
      const dataRef = { current: createMinimalHeatmapData({ yLayout: HeatmapCellLayout.le }) };
      render(<HeatmapTooltip {...defaultProps} mode={TooltipDisplayMode.Single} dataRef={dataRef} />);

      expect(screen.getByText('5')).toBeVisible();
      expect(screen.getByText(/Bucket/)).toBeVisible();
    });

    it('renders Multi mode content with multiple buckets at same x', () => {
      const dataRef = { current: createMinimalHeatmapData({ yLayout: HeatmapCellLayout.le }) };
      render(
        <HeatmapTooltip
          {...defaultProps}
          mode={TooltipDisplayMode.Multi}
          dataIdxs={[0, 1, 0]}
          dataRef={dataRef}
          isPinned={false}
        />
      );

      expect(screen.getByTestId(selectors.components.Panels.Visualization.Tooltip.Wrapper)).toBeVisible();
      expect(screen.getByText('10')).toBeVisible();
    });

    it('renders Multi mode with sparse heatmap', () => {
      const dataRef = { current: createSparseHeatmapData({ yLayout: HeatmapCellLayout.le }) };
      render(
        <HeatmapTooltip
          {...defaultProps}
          mode={TooltipDisplayMode.Multi}
          dataIdxs={[0, 0, 0]}
          dataRef={dataRef}
          isPinned={false}
        />
      );

      expect(screen.getByTestId(selectors.components.Panels.Visualization.Tooltip.Wrapper)).toBeVisible();
      expect(screen.getByText('5')).toBeVisible();
    });

    it('skips cells with zero count in Multi mode', () => {
      const heatmap = stampFrameWithDisplay(
        createDataFrame({
          meta: { type: DataFrameType.HeatmapCells },
          fields: [
            { name: 'x', type: FieldType.time, values: [1000, 1000, 1000, 2000, 2000, 2000] },
            { name: 'y', type: FieldType.number, values: [0, 1, 2, 0, 1, 2] },
            { name: 'count', type: FieldType.number, values: [5, 0, 15, 10, 20, 25] },
          ],
        })
      );
      const dataRef = {
        current: createMinimalHeatmapData({
          heatmap,
          heatmapColors: {
            palette: ['#000', '#111', '#222'],
            values: [0, 0, 1, 1, 2, 2],
            minValue: 0,
            maxValue: 25,
          },
          yLayout: HeatmapCellLayout.le,
        }),
      };
      render(
        <HeatmapTooltip
          {...defaultProps}
          mode={TooltipDisplayMode.Multi}
          dataIdxs={[0, 0, 0]}
          dataRef={dataRef}
          isPinned={false}
        />
      );

      expect(screen.getByTestId(selectors.components.Panels.Visualization.Tooltip.Wrapper)).toBeVisible();
      expect(screen.getByText('5')).toBeVisible();
    });

    it('renders Duration when x field has interval config', () => {
      const dataRef = { current: createHeatmapDataWithInterval() };
      render(<HeatmapTooltip {...defaultProps} dataRef={dataRef} isPinned={true} />);

      expect(screen.getByText('Duration')).toBeVisible();
      expect(screen.getByText('1 s')).toBeVisible();
    });
  });

  describe('yLayout', () => {
    it('renders bucket range for yLayout le', () => {
      const dataRef = { current: createMinimalHeatmapData({ yLayout: HeatmapCellLayout.le }) };
      render(<HeatmapTooltip {...defaultProps} dataRef={dataRef} />);

      expect(screen.getByTestId(selectors.components.Panels.Visualization.Tooltip.Wrapper)).toBeVisible();
      expect(screen.getByText(/Bucket/)).toBeVisible();
    });

    it('renders bucket range for yLayout ge', () => {
      const dataRef = { current: createMinimalHeatmapData({ yLayout: HeatmapCellLayout.ge }) };
      render(<HeatmapTooltip {...defaultProps} dataRef={dataRef} />);

      expect(screen.getByTestId(selectors.components.Panels.Visualization.Tooltip.Wrapper)).toBeVisible();
      expect(screen.getByText(/Bucket/)).toBeVisible();
    });

    it('renders bucket range for yLayout le with yLog scale', () => {
      const dataRef = {
        current: createMinimalHeatmapData({
          yLayout: HeatmapCellLayout.le,
          yLog: 2,
          yLogSplit: 2,
        }),
      };
      render(<HeatmapTooltip {...defaultProps} dataRef={dataRef} />);

      expect(screen.getByTestId(selectors.components.Panels.Visualization.Tooltip.Wrapper)).toBeVisible();
      expect(screen.getByText(/Bucket/)).toBeVisible();
    });

    it('renders bucket range for yLayout ge with yLog scale', () => {
      const dataRef = {
        current: createMinimalHeatmapData({
          yLayout: HeatmapCellLayout.ge,
          yLog: 10,
          yLogSplit: 2,
        }),
      };
      render(<HeatmapTooltip {...defaultProps} dataRef={dataRef} />);

      expect(screen.getByTestId(selectors.components.Panels.Visualization.Tooltip.Wrapper)).toBeVisible();
      expect(screen.getByText(/Bucket/)).toBeVisible();
    });

    it('renders content for yLayout unknown', () => {
      const dataRef = { current: createMinimalHeatmapData({ yLayout: HeatmapCellLayout.unknown }) };
      render(<HeatmapTooltip {...defaultProps} dataRef={dataRef} />);

      expect(screen.getByTestId(selectors.components.Panels.Visualization.Tooltip.Wrapper)).toBeVisible();
      expect(screen.getByText('count')).toBeVisible();
      expect(screen.getByText('5')).toBeVisible();
    });
  });

  describe('showHistogram', () => {
    it('renders histogram canvas when showHistogram is true', () => {
      render(<HeatmapTooltip {...defaultProps} showHistogram={true} />);

      const canvas = document.querySelector('canvas');
      expect(canvas).toBeInTheDocument();
    });

    it('does not render histogram when showHistogram is false', () => {
      render(<HeatmapTooltip {...defaultProps} showHistogram={false} />);

      const canvas = document.querySelector('canvas');
      expect(canvas).not.toBeInTheDocument();
    });
  });

  describe('showColorScale', () => {
    it('renders ColorScale when showColorScale is true', () => {
      render(<HeatmapTooltip {...defaultProps} showColorScale={true} />);

      expect(screen.getByTestId(selectors.components.Panels.Visualization.Tooltip.Wrapper)).toBeVisible();
      expect(screen.getByText('count')).toBeVisible();
    });
  });

  describe('Exemplars', () => {
    it('renders ExemplarTooltip when seriesIdx is 2 and exemplars have display data', () => {
      const exemplarFrame = createDataFrame({
        name: 'exemplar',
        meta: { custom: { resultType: 'exemplar' } },
        fields: [
          { name: 'Time', type: FieldType.time, values: [1500] },
          { name: 'Value', type: FieldType.number, values: [200] },
          { name: 'traceID', type: FieldType.string, values: ['trace-abc'] },
        ],
      });
      const dataRef = {
        current: createMinimalHeatmapData({ exemplars: exemplarFrame }),
      };

      render(<HeatmapTooltip {...defaultProps} seriesIdx={2} dataIdxs={[0, 0, 0]} dataRef={dataRef} />);

      expect(screen.getByText('Exemplar')).toBeVisible();
      expect(screen.getByText('traceID')).toBeVisible();
      expect(screen.getByText('trace-abc')).toBeVisible();
    });

    it('returns null when seriesIdx is 2 and getDisplayValuesAndLinks returns null', () => {
      const exemplarFrame = createDataFrame({
        name: 'exemplar',
        meta: { custom: { resultType: 'exemplar' } },
        fields: [
          {
            name: 'Time',
            type: FieldType.time,
            values: [1500],
            config: { custom: { hideFrom: { tooltip: true } } },
          },
          {
            name: 'Value',
            type: FieldType.number,
            values: [200],
            config: { custom: { hideFrom: { tooltip: true } } },
          },
        ],
      });
      const dataRef = {
        current: createMinimalHeatmapData({ exemplars: exemplarFrame }),
      };

      const { container } = render(
        <HeatmapTooltip {...defaultProps} seriesIdx={2} dataIdxs={[0, 0, 0]} dataRef={dataRef} />
      );

      expect(container.firstChild).toBeNull();
    });
  });

  describe('x-axis display', () => {
    it('uses xField.display when x field has display processor', () => {
      const heatmap = stampFrameWithDisplay(
        createDataFrame({
          meta: { type: DataFrameType.HeatmapCells },
          fields: [
            { name: 'x', type: FieldType.number, values: [100, 100, 100, 200, 200, 200] },
            { name: 'y', type: FieldType.number, values: [0, 1, 2, 0, 1, 2] },
            { name: 'count', type: FieldType.number, values: [5, 10, 15, 10, 20, 25] },
          ],
        })
      );
      const dataRef = {
        current: createMinimalHeatmapData({
          heatmap,
          xBucketSize: 100,
          yBucketCount: 3,
          xBucketCount: 2,
        }),
      };
      render(<HeatmapTooltip {...defaultProps} dataRef={dataRef} dataIdxs={[0, 0, 0]} />);

      expect(screen.getByTestId(selectors.components.Panels.Visualization.Tooltip.Wrapper)).toBeVisible();
      expect(screen.getByText('count')).toBeVisible();
    });

    it('uses dashboard formatDate when x field is time type without display', () => {
      const heatmap = createDataFrame({
        meta: { type: DataFrameType.HeatmapCells },
        fields: [
          { name: 'x', type: FieldType.time, values: [1000, 1000, 1000], display: undefined },
          { name: 'y', type: FieldType.number, values: [0, 1, 2] },
          { name: 'count', type: FieldType.number, values: [5, 10, 15] },
        ],
      });
      heatmap.fields[1].display = getDisplayProcessor({ field: heatmap.fields[1], theme });
      heatmap.fields[2].display = getDisplayProcessor({ field: heatmap.fields[2], theme });
      const dataRef = {
        current: createMinimalHeatmapData({
          heatmap,
          xBucketSize: 1000,
          yBucketCount: 3,
          xBucketCount: 1,
        }),
      };
      render(<HeatmapTooltip {...defaultProps} dataRef={dataRef} dataIdxs={[0, 0, 0]} />);

      expect(screen.getByTestId(selectors.components.Panels.Visualization.Tooltip.Wrapper)).toBeVisible();
      expect(screen.getByText(/1970-01-01/)).toBeVisible();
    });

    it('uses string fallback when x field has no display and is not time type', () => {
      const heatmap = createDataFrame({
        meta: { type: DataFrameType.HeatmapCells },
        fields: [
          { name: 'x', type: FieldType.number, values: [100, 100, 100], display: undefined },
          { name: 'y', type: FieldType.number, values: [0, 1, 2] },
          { name: 'count', type: FieldType.number, values: [5, 10, 15] },
        ],
      });
      heatmap.fields[1].display = getDisplayProcessor({ field: heatmap.fields[1], theme });
      heatmap.fields[2].display = getDisplayProcessor({ field: heatmap.fields[2], theme });
      const dataRef = {
        current: createMinimalHeatmapData({
          heatmap,
          xBucketSize: 100,
          yBucketCount: 3,
          xBucketCount: 1,
        }),
      };
      render(<HeatmapTooltip {...defaultProps} dataRef={dataRef} dataIdxs={[0, 0, 0]} />);

      expect(screen.getByTestId(selectors.components.Panels.Visualization.Tooltip.Wrapper)).toBeVisible();
      expect(screen.getByText('200')).toBeVisible();
    });
  });

  describe('Sparse heatmap', () => {
    it('renders tooltip for sparse heatmap', () => {
      const dataRef = { current: createSparseHeatmapData() };
      render(<HeatmapTooltip {...defaultProps} dataRef={dataRef} dataIdxs={[0, 0, 0]} />);

      expect(screen.getByTestId(selectors.components.Panels.Visualization.Tooltip.Wrapper)).toBeVisible();
      expect(screen.getByText('5')).toBeVisible();
    });
  });

  describe('Ordinal display', () => {
    it('renders tooltip for ordinal y display', () => {
      const dataRef = { current: createOrdinalHeatmapData() };
      render(<HeatmapTooltip {...defaultProps} dataRef={dataRef} dataIdxs={[0, 0, 0]} />);

      expect(screen.getByTestId(selectors.components.Panels.Visualization.Tooltip.Wrapper)).toBeVisible();
      expect(screen.getByText('5')).toBeVisible();
    });
  });

  describe('Pinned footer', () => {
    it('renders footer when isPinned and series has links field', () => {
      const series = createDataFrame({
        fields: [
          { name: 'time', type: FieldType.time, values: [1000, 2000, 3000] },
          {
            name: 'A',
            type: FieldType.number,
            values: [5, 10, 15],
            config: { links: [{ url: 'https://example.com', title: 'View' }] },
          },
          { name: 'B', type: FieldType.number, values: [10, 20, 25] },
          { name: 'C', type: FieldType.number, values: [15, 20, 30] },
        ],
      });
      const dataRef = {
        current: createMinimalHeatmapData({ series }),
      };

      render(
        <HeatmapTooltip
          {...defaultProps}
          dataRef={dataRef}
          isPinned={true}
          dataIdxs={[0, 0, 0]}
          replaceVariables={(v) => v}
        />
      );

      expect(screen.getByTestId(selectors.components.Panels.Visualization.Tooltip.Wrapper)).toBeVisible();
    });
  });
});
