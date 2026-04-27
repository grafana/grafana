import { render, screen } from '@testing-library/react';

import { createTheme, getDisplayProcessor, type DisplayValue, type LinkModel } from '@grafana/data';
import { createDataFrame, FieldType, type DataFrame, type Field } from '@grafana/data/dataframe';
import { selectors } from '@grafana/e2e-selectors';
import { VisibilityMode } from '@grafana/schema';

import { getFieldActions } from '../status-history/utils';

import { XYChartTooltip, type Props } from './XYChartTooltip';
import { PointShape } from './panelcfg.gen';
import { type XYSeries } from './types2';

jest.mock('../status-history/utils', () => ({
  getFieldActions: jest.fn(() => []),
}));

const theme = createTheme();

function makeField(opts: {
  name: string;
  values: number[];
  hideFromTooltip?: boolean;
  displayName?: string;
  customConfig?: Record<string, unknown>;
}): Field {
  const { name, values, hideFromTooltip = false, displayName, customConfig = {} } = opts;

  const field = createDataFrame({
    fields: [
      {
        name,
        type: FieldType.number,
        values,
        config: {
          custom: {
            hideFrom: { tooltip: hideFromTooltip },
            ...customConfig,
          },
        },
      },
    ],
  }).fields[0];

  field.display = getDisplayProcessor({ field, theme });

  if (displayName) {
    field.state = { ...field.state, displayName };
  }

  return field;
}

function makeSeries(overrides?: Partial<XYSeries>): XYSeries {
  return {
    showPoints: VisibilityMode.Auto,
    pointShape: PointShape.Circle,
    pointStrokeWidth: 1,
    fillOpacity: 50,
    showLine: false,
    lineWidth: 1,
    lineStyle: { fill: 'solid' },
    name: { value: 'Series A' },
    x: { field: makeField({ name: 'x', values: [1, 2, 3] }) },
    y: { field: makeField({ name: 'y', values: [10, 20, 30] }) },
    color: {},
    size: {},
    _rest: [],
    ...overrides,
  };
}

function renderTooltip(overrides?: Partial<Props>) {
  const series = overrides?.xySeries?.[0] ?? makeSeries();
  const yField = series.y.field;
  const frame = createDataFrame({ fields: [yField] });

  const defaultProps: Props = {
    dataIdxs: [0],
    seriesIdx: 1,
    isPinned: false,
    dismiss: jest.fn(),
    data: [frame],
    xySeries: [series],
    replaceVariables: jest.fn((v: string) => v),
    dataLinks: [],
  };

  return render(<XYChartTooltip {...defaultProps} {...overrides} />);
}

describe('XYChartTooltip', () => {
  it('renders with series name in header', () => {
    renderTooltip();
    expect(screen.getByTestId(selectors.components.Panels.Visualization.Tooltip.Wrapper)).toBeVisible();
    expect(screen.getByText('Series A')).toBeVisible();
  });

  describe('content fields', () => {
    it('shows x and y field values', () => {
      renderTooltip();
      expect(screen.getByText('x')).toBeVisible();
      expect(screen.getByText('1')).toBeVisible();
      expect(screen.getByText('y')).toBeVisible();
      expect(screen.getByText('10')).toBeVisible();
    });

    it('shows size field when mapped', () => {
      const series = makeSeries({
        size: { field: makeField({ name: 'radius', values: [5, 10, 15] }) },
      });
      renderTooltip({ xySeries: [series] });
      expect(screen.getByText('radius')).toBeVisible();
      expect(screen.getByText('5')).toBeVisible();
    });

    it('shows color field when mapped', () => {
      const series = makeSeries({
        color: { field: makeField({ name: 'temp', values: [100, 200, 300] }) },
      });
      renderTooltip({ xySeries: [series] });
      expect(screen.getByText('temp')).toBeVisible();
      expect(screen.getByText('100')).toBeVisible();
    });

    it('shows rest fields', () => {
      const series = makeSeries({
        _rest: [makeField({ name: 'host', values: [42] }), makeField({ name: 'region', values: [7] })],
      });
      renderTooltip({ xySeries: [series] });
      expect(screen.getByText('host')).toBeVisible();
      expect(screen.getByText('42')).toBeVisible();
      expect(screen.getByText('region')).toBeVisible();
      expect(screen.getByText('7')).toBeVisible();
    });

    it('renders content items in order: x, y, size, color, rest', () => {
      const series = makeSeries({
        size: { field: makeField({ name: 'sz', values: [5] }) },
        color: { field: makeField({ name: 'clr', values: [99] }) },
        _rest: [makeField({ name: 'extra', values: [1] })],
      });
      renderTooltip({ xySeries: [series] });

      const wrapper = screen.getByTestId(selectors.components.Panels.Visualization.Tooltip.Wrapper);
      const allText = wrapper.textContent ?? '';
      const positions = ['x', 'y', 'sz', 'clr', 'extra'].map((label) => allText.indexOf(label));
      for (let i = 1; i < positions.length; i++) {
        expect(positions[i]).toBeGreaterThan(positions[i - 1]);
      }
    });
  });

  describe('field deduplication', () => {
    it('skips size field when same reference as x', () => {
      const sharedField = makeField({ name: 'shared', values: [1, 2, 3] });
      const series = makeSeries({
        x: { field: sharedField },
        size: { field: sharedField },
      });
      renderTooltip({ xySeries: [series] });
      expect(screen.getAllByText('shared')).toHaveLength(1);
    });

    it('skips color field when same reference as y', () => {
      const sharedField = makeField({ name: 'shared', values: [10, 20, 30] });
      const series = makeSeries({
        y: { field: sharedField },
        color: { field: sharedField },
      });
      renderTooltip({ xySeries: [series] });
      expect(screen.getAllByText('shared')).toHaveLength(1);
    });
  });

  describe('field display names', () => {
    it('uses displayName from field state when available', () => {
      const series = makeSeries({
        x: { field: makeField({ name: 'x', values: [1], displayName: 'X Axis' }) },
      });
      renderTooltip({ xySeries: [series] });
      expect(screen.getByText('X Axis')).toBeVisible();
    });

    it('strips series name from compound field label', () => {
      const series = makeSeries({
        name: { value: 'cpu' },
        y: { field: makeField({ name: 'y', values: [10], displayName: 'cpu usage' }) },
      });
      renderTooltip({ xySeries: [series] });
      expect(screen.getByText('usage')).toBeVisible();
    });

    it('preserves label when it equals series name exactly', () => {
      const series = makeSeries({
        name: { value: 'cpu' },
        y: { field: makeField({ name: 'y', values: [10], displayName: 'cpu' }) },
      });
      renderTooltip({ xySeries: [series] });
      expect(screen.getAllByText('cpu')).toHaveLength(2);
    });

    it('preserves label when field name has no spaces', () => {
      const series = makeSeries({
        name: { value: 'cpu' },
        y: { field: makeField({ name: 'y', values: [10], displayName: 'usage' }) },
      });
      renderTooltip({ xySeries: [series] });
      expect(screen.getByText('usage')).toBeVisible();
    });
  });

  describe.each([true, false])('hideFrom.tooltip: %s', (hideFromTooltip) => {
    it.each<[string, string, Partial<XYSeries>]>([
      ['x', 'x', { x: { field: makeField({ name: 'x', values: [1], hideFromTooltip }) } }],
      ['y', 'y', { y: { field: makeField({ name: 'y', values: [10], hideFromTooltip }) } }],
      ['size', 'radius', { size: { field: makeField({ name: 'radius', values: [5], hideFromTooltip }) } }],
      ['color', 'temp', { color: { field: makeField({ name: 'temp', values: [100], hideFromTooltip }) } }],
      ['rest', 'extra', { _rest: [makeField({ name: 'extra', values: [99], hideFromTooltip })] }],
    ])(`${hideFromTooltip ? 'hides' : 'shows'} %s field`, (_slot, fieldName, overrides) => {
      const series = makeSeries(overrides);
      renderTooltip({ xySeries: [series] });
      if (hideFromTooltip) {
        expect(screen.queryByText(fieldName)).toBeNull();
      } else {
        expect(screen.queryByText(fieldName)).toBeVisible();
      }
    });
  });

  describe('color', () => {
    function getHeaderColorIndicator(): HTMLElement {
      const wrapper = screen.getByTestId(selectors.components.Panels.Visualization.Tooltip.Wrapper);
      const header = wrapper.children[0];
      // VizTooltipColorIndicator renders a div with inline backgroundColor — no testid available
      return header.querySelector('[style*="background-color"]') as HTMLElement;
    }

    it('uses color from color field display value', () => {
      const colorField = makeField({ name: 'temp', values: [100] });
      colorField.display = (v: unknown): DisplayValue => ({ text: `${v}`, numeric: Number(v), color: '#ff0000' });
      const series = makeSeries({ color: { field: colorField } });
      renderTooltip({ xySeries: [series] });
      expect(getHeaderColorIndicator()).toHaveStyle({ backgroundColor: '#ff0000' });
    });

    it('uses fixed color when no color field', () => {
      const series = makeSeries({ color: { fixed: '#00ff00' } });
      renderTooltip({ xySeries: [series] });
      expect(getHeaderColorIndicator()).toHaveStyle({ backgroundColor: '#00ff00' });
    });

    it('falls back to #fff when no color field or fixed', () => {
      const series = makeSeries({ color: {} });
      renderTooltip({ xySeries: [series] });
      expect(getHeaderColorIndicator()).toHaveStyle({ backgroundColor: '#fff' });
    });

    it('applies fillOpacity as alpha to color', () => {
      const colorField = makeField({ name: 'temp', values: [100], customConfig: { fillOpacity: 50 } });
      colorField.display = (v: unknown): DisplayValue => ({ text: `${v}`, numeric: Number(v), color: '#ff0000' });
      const series = makeSeries({ color: { field: colorField } });
      renderTooltip({ xySeries: [series] });
      const indicator = getHeaderColorIndicator();
      expect(indicator.style.backgroundColor).toContain('0.5');
    });
  });

  describe('footer', () => {
    it.each<[string, Partial<Props>]>([
      ['isPinned', { isPinned: true }],
      [
        'dataLink has oneClick',
        { isPinned: false, dataLinks: [{ href: 'http://example.com', title: 'Link', oneClick: true } as LinkModel] },
      ],
    ])('renders footer when %s', (_label, overrides) => {
      renderTooltip(overrides);
      const wrapper = screen.getByTestId(selectors.components.Panels.Visualization.Tooltip.Wrapper);
      expect(wrapper.children).toHaveLength(3);
      expect(screen.getByText('Series A')).toBeVisible();
      expect(screen.getByText('x')).toBeVisible();
      expect(screen.getByText('y')).toBeVisible();
    });

    it('does not render footer when not pinned and no oneClick links', () => {
      renderTooltip({ isPinned: false, dataLinks: [] });
      const wrapper = screen.getByTestId(selectors.components.Panels.Visualization.Tooltip.Wrapper);
      expect(wrapper.children).toHaveLength(2);
      expect(screen.getByText('Series A')).toBeVisible();
      expect(screen.getByText('x')).toBeVisible();
      expect(screen.getByText('y')).toBeVisible();
    });

    describe('getFieldActions', () => {
      it('calls getFieldActions when canExecuteActions is true and pinned', () => {
        const mockGetFieldActions = getFieldActions as jest.Mock;
        mockGetFieldActions.mockClear();

        const series = makeSeries();
        const yField = series.y.field;
        // Build a frame that holds the exact yField reference so .includes() matches
        const frame = { fields: [yField], length: yField.values.length };

        renderTooltip({
          isPinned: true,
          canExecuteActions: true,
          data: [frame] as DataFrame[],
          xySeries: [series],
        });

        expect(mockGetFieldActions).toHaveBeenCalledWith(
          expect.objectContaining({ fields: expect.arrayContaining([yField]) }),
          yField,
          expect.any(Function),
          0,
          'xychart'
        );
      });

      it('does not call getFieldActions when canExecuteActions is false', () => {
        const mockGetFieldActions = getFieldActions as jest.Mock;
        mockGetFieldActions.mockClear();
        renderTooltip({ isPinned: true, canExecuteActions: false });
        expect(mockGetFieldActions).not.toHaveBeenCalled();
      });
    });
  });
});
