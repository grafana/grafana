import { render, screen } from '@testing-library/react';
import { type ComponentProps } from 'react';

import { createDataFrame, type DataFrame, type Field, type FieldConfig, FieldType } from '@grafana/data/dataframe';
import { FieldColorModeId, type ThresholdsConfig, ThresholdsMode, type ValueMapping } from '@grafana/data/types';
import { selectors } from '@grafana/e2e-selectors';
import { AxisPlacement, LegendDisplayMode, MappingType } from '@grafana/schema';
import { UPlotConfigBuilder } from '@grafana/ui';

import { BarChartLegend, hasVisibleLegendSeries } from './BarChartLegend';
import { applyBarChartFieldDefaults } from './test-helpers';

/**
 * Creates a minimal DataFrame for BarChartLegend tests.
 * Structure: fields[0] = x field, fields[1..] = value fields.
 */
function createBarChartLegendFrame(overrides?: {
  xFieldConfig?: FieldConfig;
  valueFields?: Array<{
    name: string;
    hideFromLegend?: boolean;
    displayName?: string;
    thresholds?: ThresholdsConfig;
    mappings?: ValueMapping[];
    axisPlacement?: AxisPlacement;
    hideFromViz?: boolean;
  }>;
}): DataFrame {
  const valueFields = overrides?.valueFields ?? [{ name: 'value', hideFromLegend: false }];

  const xFieldConfig: FieldConfig = overrides?.xFieldConfig ?? {};

  const fields: Array<Partial<Field>> = [
    {
      name: 'x',
      type: FieldType.string,
      values: ['a', 'b', 'c'],
      config: {
        ...xFieldConfig,
        custom: xFieldConfig,
      },
    },
    ...valueFields.map((vf) => ({
      name: vf.name,
      type: FieldType.number,
      values: [10, 20, 30],
      config: {
        unit: 'short',
        custom: {
          hideFrom: vf.hideFromLegend ? { legend: true, tooltip: false, viz: false } : undefined,
          axisPlacement: vf.axisPlacement,
        },
        thresholds: vf.thresholds,
        mappings: vf.mappings,
      },
      state: {
        displayName: vf.displayName ?? vf.name,
        hideFrom: vf.hideFromViz ? { legend: false, tooltip: false, viz: true } : undefined,
      },
    })),
  ];

  const frame = createDataFrame({ fields });

  for (let i = 0; i < frame.fields.length; i++) {
    const f = fields[i];
    if (f?.state) {
      frame.fields[i].state = { ...frame.fields[i].state, ...f.state };
    }
  }
  applyBarChartFieldDefaults(frame);

  return frame;
}

/** Creates a dummy UPlotConfigBuilder for hasVisibleLegendSeries (it only uses data, not config). */
function createDummyConfig(): UPlotConfigBuilder {
  return new UPlotConfigBuilder();
}

describe('hasVisibleLegendSeries', () => {
  it('returns true when at least one value field has hideFrom.legend false or unset', () => {
    const frame = createBarChartLegendFrame({
      valueFields: [
        { name: 'metric1', hideFromLegend: false },
        { name: 'metric2', hideFromLegend: false },
      ],
    });
    expect(hasVisibleLegendSeries(createDummyConfig(), [frame])).toBe(true);
  });

  it('returns true when one field is visible and another is hidden', () => {
    const frame = createBarChartLegendFrame({
      valueFields: [
        { name: 'visible', hideFromLegend: false },
        { name: 'hidden', hideFromLegend: true },
      ],
    });
    expect(hasVisibleLegendSeries(createDummyConfig(), [frame])).toBe(true);
  });

  it('returns false when all value fields have hideFrom.legend true', () => {
    const frame = createBarChartLegendFrame({
      valueFields: [
        { name: 'm1', hideFromLegend: true },
        { name: 'm2', hideFromLegend: true },
      ],
    });
    expect(hasVisibleLegendSeries(createDummyConfig(), [frame])).toBe(false);
  });

  it('returns false when there are no value fields (only x field)', () => {
    const frame = createDataFrame({
      fields: [
        {
          name: 'x',
          type: FieldType.string,
          values: ['a', 'b'],
          config: {},
        },
      ],
    });
    expect(hasVisibleLegendSeries(createDummyConfig(), [frame])).toBe(false);
  });
});

describe('BarChartLegend', () => {
  const defaultLegendProps: ComponentProps<typeof BarChartLegend> = {
    data: [],
    showLegend: false, // unused in the BarChartLegend component
    displayMode: LegendDisplayMode.List,
    placement: 'bottom',
    calcs: [],
  };

  /**
   * Renders BarChartLegend with the given data and legend options.
   */
  function renderBarChartLegend(
    data: DataFrame[],
    legendOverrides?: {
      placement: 'bottom' | 'right';
      displayMode: LegendDisplayMode;
      calcs: string[];
    }
  ) {
    const mergedProps = { ...defaultLegendProps, ...legendOverrides };
    return render(<BarChartLegend {...mergedProps} data={data} />);
  }

  describe('Rendering', () => {
    describe('hideFromLegend', () => {
      it('renders VizLegend when data has visible value fields', () => {
        const frame = createBarChartLegendFrame({
          valueFields: [{ name: 'Metric A', hideFromLegend: false }],
        });
        renderBarChartLegend([frame]);

        expect(screen.getByTestId(selectors.components.VizLegend.seriesName('Metric A'))).toBeVisible();
      });

      it('does not render VizLegend when value field has hideFromLegend true', () => {
        const frame = createBarChartLegendFrame({
          valueFields: [{ name: 'Metric A', hideFromLegend: true }],
        });
        renderBarChartLegend([frame]);

        expect(screen.queryByTestId(selectors.components.VizLegend.seriesName('Metric A'))).not.toBeInTheDocument();
      });

      it('excludes fields with hideFrom.legend true from legend items', () => {
        const frame = createBarChartLegendFrame({
          valueFields: [
            { name: 'Visible', hideFromLegend: false },
            { name: 'Hidden', hideFromLegend: true },
          ],
        });
        renderBarChartLegend([frame]);

        expect(screen.getByTestId(selectors.components.VizLegend.seriesName('Visible'))).toBeVisible();
        expect(screen.queryByTestId(selectors.components.VizLegend.seriesName('Hidden'))).not.toBeInTheDocument();
      });
    });

    it('legend items show displayName', () => {
      const frame = createBarChartLegendFrame({
        valueFields: [{ name: 'rawName', displayName: 'Display Name', hideFromLegend: false }],
      });
      renderBarChartLegend([frame]);

      expect(screen.getByTestId(selectors.components.VizLegend.seriesName('Display Name'))).toBeVisible();
    });

    it('legend items fall back to field.name when displayName is not set', () => {
      const frame = createBarChartLegendFrame({
        valueFields: [{ name: 'FallbackLabel', hideFromLegend: false }],
      });
      renderBarChartLegend([frame]);

      expect(screen.getByTestId(selectors.components.VizLegend.seriesName('FallbackLabel'))).toBeVisible();
    });

    it('passes placement and displayMode through to VizLegend', () => {
      const frame = createBarChartLegendFrame({
        valueFields: [{ name: 'Metric', hideFromLegend: false }],
      });
      renderBarChartLegend([frame], { placement: 'right', displayMode: LegendDisplayMode.Table, calcs: [] });

      expect(screen.getByText('Metric')).toBeVisible();
    });
  });

  describe('Thresholds', () => {
    it('renders threshold items when color mode is Thresholds and field has thresholds with more than one step', () => {
      const frame = createBarChartLegendFrame({
        xFieldConfig: { color: { mode: FieldColorModeId.Thresholds } },
        valueFields: [
          {
            name: 'value',
            hideFromLegend: false,
            thresholds: {
              mode: ThresholdsMode.Absolute,
              steps: [
                { value: -Infinity, color: 'rgb(115, 191, 105)' },
                { value: 50, color: 'yellow' },
                { value: 80, color: 'rgb(242, 73, 92)' },
              ],
            },
          },
        ],
      });
      renderBarChartLegend([frame]);

      expect(screen.getAllByTestId('series-icon')).toHaveLength(3);
      expect(screen.getByText('< 50')).toBeVisible();
      expect(screen.getByText('50+')).toBeVisible();
      expect(screen.getByText('80+')).toBeVisible();

      const getSeriesIcon = (seriesName: string) => {
        return screen
          .getByTestId(selectors.components.VizLegend.seriesName(seriesName))
          .querySelector('[data-testid="series-icon"]');
      };

      expect(getSeriesIcon('< 50')).toHaveStyle({ background: 'rgb(115, 191, 105)' });
      expect(getSeriesIcon('50+')).toHaveStyle({ background: 'rgb(250, 222, 42)' });
      expect(getSeriesIcon('80+')).toHaveStyle({ background: 'rgb(242, 73, 92)' });
    });

    it('handles percentage thresholds mode', () => {
      const frame = createBarChartLegendFrame({
        xFieldConfig: { color: { mode: FieldColorModeId.Thresholds } },
        valueFields: [
          {
            name: 'pct',
            hideFromLegend: false,
            thresholds: {
              mode: ThresholdsMode.Percentage,
              steps: [
                { value: -Infinity, color: 'blue' },
                { value: 50, color: 'orange' },
              ],
            },
          },
        ],
      });
      renderBarChartLegend([frame]);

      expect(screen.getByText('< 50%')).toBeVisible();
    });
  });

  describe('Value Mappings', () => {
    it('passes mapping items to VizLegend when value fields have mappings', () => {
      const frame = createBarChartLegendFrame({
        valueFields: [
          {
            name: 'mapped',
            hideFromLegend: false,
            mappings: [
              {
                type: MappingType.ValueToText,
                options: {
                  'Series 1': { text: 'One', color: 'green' },
                  'Series 2': { text: 'Two', color: 'red' },
                },
              },
            ],
          },
        ],
      });
      renderBarChartLegend([frame]);

      expect(screen.getByTestId(selectors.components.VizLegend.seriesName('Series 1'))).toBeVisible();
      expect(screen.getByTestId(selectors.components.VizLegend.seriesName('Series 2'))).toBeVisible();
    });

    it('handles range-to-text mappings', () => {
      const frame = createBarChartLegendFrame({
        valueFields: [
          {
            name: 'range',
            hideFromLegend: false,
            mappings: [
              {
                type: MappingType.RangeToText,
                options: {
                  from: 0,
                  to: 10,
                  result: { text: 'Low', color: 'blue' },
                },
              },
            ],
          },
        ],
      });
      renderBarChartLegend([frame]);

      expect(screen.getByText('[0 - 10] Low')).toBeVisible();
    });
  });

  describe('Edge cases', () => {
    it('renders without crashing when only x field exists (no value fields)', () => {
      const frame = createDataFrame({
        fields: [
          {
            name: 'x',
            type: FieldType.string,
            values: ['a', 'b'],
            config: {},
          },
        ],
      });
      applyBarChartFieldDefaults(frame);

      expect(() => renderBarChartLegend([frame])).not.toThrow();
    });

    it('handles field with axisPlacement Right for yAxis', () => {
      const frame = createBarChartLegendFrame({
        valueFields: [{ name: 'RightAxis', hideFromLegend: false, axisPlacement: AxisPlacement.Right }],
      });
      renderBarChartLegend([frame]);

      expect(screen.getByTestId(selectors.components.VizLegend.seriesName('RightAxis'))).toBeVisible();
    });

    it('handles field with hideFrom.viz for disabled state on items', () => {
      const frame = createBarChartLegendFrame({
        valueFields: [{ name: 'DisabledViz', hideFromLegend: false, hideFromViz: true }],
      });
      renderBarChartLegend([frame]);

      expect(screen.getByTestId(selectors.components.VizLegend.seriesName('DisabledViz'))).toBeVisible();
    });
  });
});
