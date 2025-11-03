import { assertIsDefined } from 'test/helpers/asserts';

import {
  createTheme,
  FieldConfig,
  FieldType,
  MutableDataFrame,
  VizOrientation,
  FieldConfigSource,
} from '@grafana/data';
import {
  LegendDisplayMode,
  TooltipDisplayMode,
  VisibilityMode,
  GraphGradientMode,
  StackingMode,
  SortOrder,
  defaultTimeZone,
} from '@grafana/schema';

import { FieldConfig as PanelFieldConfig } from './panelcfg.gen';
import { prepSeries, prepConfig, PrepConfigOpts, prepMarkers, seperateMarkerSeries } from './utils';

const fieldConfig: FieldConfigSource = {
  defaults: {},
  overrides: [],
};

function mockDataFrame() {
  const df1 = new MutableDataFrame({
    refId: 'A',
    fields: [{ name: 'ts', type: FieldType.string, values: ['a', 'b', 'c'] }],
  });

  const df2 = new MutableDataFrame({
    refId: 'B',
    fields: [{ name: 'ts', type: FieldType.time, values: [1, 2, 4] }],
  });

  const f1Config: FieldConfig<PanelFieldConfig> = {
    displayName: 'Metric 1',
    decimals: 2,
    unit: 'm/s',
    custom: {
      gradientMode: GraphGradientMode.Opacity,
      lineWidth: 2,
      fillOpacity: 0.1,
    },
  };

  const f2Config: FieldConfig<PanelFieldConfig> = {
    displayName: 'Metric 2',
    decimals: 2,
    unit: 'kWh',
    custom: {
      gradientMode: GraphGradientMode.Hue,
      lineWidth: 2,
      fillOpacity: 0.1,
    },
  };

  df1.addField({
    name: 'metric1',
    type: FieldType.number,
    config: f1Config,
    state: {},
  });

  df2.addField({
    name: 'metric2',
    type: FieldType.number,
    config: f2Config,
    state: {},
  });

  df1.fields.forEach((f) => (f.config.custom = f.config.custom ?? {}));
  df2.fields.forEach((f) => (f.config.custom = f.config.custom ?? {}));

  const info = prepSeries([df1], fieldConfig, StackingMode.None, createTheme());

  if (info.series.length === 0) {
    throw new Error('Bar chart not prepared correctly');
  }

  return info.series[0];
}

jest.mock('@grafana/data', () => ({
  ...jest.requireActual('@grafana/data'),
  DefaultTimeZone: 'utc',
}));

describe('BarChart utils', () => {
  describe('preparePlotConfigBuilder', () => {
    const config: PrepConfigOpts = {
      series: [mockDataFrame()],
      totalSeries: 2,
      // color?: Field | null;
      timeZone: defaultTimeZone,
      theme: createTheme(),
      orientation: VizOrientation.Auto,

      options: {
        showMarkersInLegend: false,
        orientation: VizOrientation.Auto,
        groupWidth: 20,
        barWidth: 2,
        showValue: VisibilityMode.Always,
        legend: {
          displayMode: LegendDisplayMode.List,
          showLegend: true,
          placement: 'bottom',
          calcs: [],
        },
        xTickLabelRotation: 0,
        xTickLabelMaxLength: 20,
        stacking: StackingMode.None,
        tooltip: {
          mode: TooltipDisplayMode.None,
          sort: SortOrder.None,
        },
        text: {
          valueSize: 10,
        },
        fullHighlight: false,
        markerGroups: [],
      },
      preparedMarkers: [],
      markerData: [],
    };

    it.each([VizOrientation.Auto, VizOrientation.Horizontal, VizOrientation.Vertical])('orientation', (v) => {
      const result = prepConfig({
        ...config,
        options: {
          ...config.options,
          orientation: v,
        },
        series: [mockDataFrame()],
        orientation: v,
      }).builder.getConfig();
      expect(result).toMatchSnapshot();
    });

    it.each([VisibilityMode.Always, VisibilityMode.Auto])('value visibility', (v) => {
      expect(
        prepConfig({
          ...config,
          options: {
            ...config.options,
            showValue: v,
          },
          series: [mockDataFrame()],
        }).builder.getConfig()
      ).toMatchSnapshot();
    });

    it.each([StackingMode.None, StackingMode.Percent, StackingMode.Normal])('stacking', (v) => {
      expect(
        prepConfig({
          ...config,
          options: {
            ...config.options,
            stacking: v,
          },
          series: [mockDataFrame()],
        }).builder.getConfig()
      ).toMatchSnapshot();
    });
  });

  describe('prepareGraphableFrames', () => {
    it('will return empty string when there are no frames in the response', () => {
      const info = prepSeries([], fieldConfig, StackingMode.None, createTheme());

      expect(info.warn).toBe('');
      expect(info.series).toHaveLength(0);
    });

    it('will return empty string when there is no data in the response', () => {
      const info = prepSeries(
        [
          {
            length: 0,
            fields: [],
          },
        ],
        fieldConfig,
        StackingMode.None,
        createTheme()
      );

      expect(info.warn).toBe('');
      expect(info.series).toHaveLength(0);
    });

    it('will warn when there is no string or time field', () => {
      const df = new MutableDataFrame({
        fields: [
          { name: 'a', type: FieldType.other, values: [1, 2, 3, 4, 5] },
          { name: 'value', values: [1, 2, 3, 4, 5] },
        ],
      });
      df.fields.forEach((f) => (f.config.custom = f.config.custom ?? {}));

      const info = prepSeries([df], fieldConfig, StackingMode.None, createTheme());
      const warning = assertIsDefined('warn' in info ? info : null);
      expect(warning.warn).toEqual('Bar charts require a string or time field');
    });

    it('will warn when there are no numeric fields in the response', () => {
      const df = new MutableDataFrame({
        fields: [
          { name: 'a', type: FieldType.string, values: ['a', 'b', 'c', 'd', 'e'] },
          { name: 'value', type: FieldType.boolean, values: [true, true, true, true, true] },
        ],
      });
      df.fields.forEach((f) => (f.config.custom = f.config.custom ?? {}));

      const info = prepSeries([df], fieldConfig, StackingMode.None, createTheme());
      const warning = assertIsDefined('warn' in info ? info : null);
      expect(warning.warn).toEqual('No numeric fields found');
    });

    it('will convert NaN and Infinty to nulls', () => {
      const df = new MutableDataFrame({
        fields: [
          { name: 'a', type: FieldType.string, values: ['a', 'b', 'c', 'd', 'e'] },
          { name: 'value', values: [-10, NaN, 10, -Infinity, +Infinity] },
        ],
      });
      df.fields.forEach((f) => (f.config.custom = f.config.custom ?? {}));

      const info = prepSeries([df], fieldConfig, StackingMode.None, createTheme());

      const field = info.series[0].fields[1];
      expect(field.values).toMatchInlineSnapshot(`
        [
          -10,
          null,
          10,
          null,
          null,
        ]
      `);
    });

    it('should not apply % unit to series when stacking is percent', () => {
      const df = new MutableDataFrame({
        fields: [
          { name: 'string', type: FieldType.string, values: ['a', 'b', 'c'] },
          { name: 'a', values: [-10, 20, 10], state: { calcs: { min: -10 } } },
          { name: 'b', values: [20, 20, 20], state: { calcs: { min: 20 } } },
          { name: 'c', values: [10, 10, 10], state: { calcs: { min: 10 } } },
        ],
      });
      df.fields.forEach((f) => (f.config.custom = f.config.custom ?? {}));

      const info = prepSeries([df], fieldConfig, StackingMode.Percent, createTheme());

      expect(info.series[0].fields[0].config.unit).toBeUndefined();
      expect(info.series[0].fields[1].config.unit).toBeUndefined();
      expect(info.series[0].fields[2].config.unit).toBeUndefined();
    });

    describe('prepareMarkers', () => {
      const vizFields = [
        { name: 'x', type: FieldType.string, values: ['a', 'b', 'c'], config: {} },
        { name: 'series1', type: FieldType.number, values: [10, 20, 30], config: {} },
        { name: 'series2', type: FieldType.number, values: [15, 25, 35], config: {} },
      ] as any[];

      const markerFields = [
        { name: 'marker1_data', type: FieldType.number, values: [5, 5, 5], config: { unit: '__fixed' } },
        { name: 'marker2_data', type: FieldType.number, values: [7, 7, 7], config: { unit: '__log' } },
      ] as any[];

      const markers = [
        {
          id: 1,
          dataField: 'marker1_data',
          targetField: 'series1',
          opts: { label: 'john', shape: 'circle', color: 'red', size: 1, opacity: 1 },
        },
        {
          id: 2,
          dataField: 'marker2_data',
          targetField: 'series2',
          opts: { label: 'jane', shape: 'circle', color: 'blue', size: 1, opacity: 1 },
        },
        {
          id: 3,
          dataField: 'fake_name',
          targetField: 'series2',
          opts: { label: 'jane', shape: 'circle', color: 'blue', size: 1, opacity: 1 },
        },
      ];

      it('should prepare markers for StackingMode.None', () => {
        const result = prepMarkers(vizFields, markerFields, markers, StackingMode.None);
        expect(result).toHaveLength(6);
        expect(result).toEqual(
          expect.arrayContaining([
            expect.objectContaining({ groupIdx: 0, yValue: 5, seriesIdx: 1, yScaleKey: '__fixed' }),
            expect.objectContaining({ groupIdx: 1, yValue: 5, seriesIdx: 1, yScaleKey: '__fixed' }),
            expect.objectContaining({ groupIdx: 2, yValue: 5, seriesIdx: 1, yScaleKey: '__fixed' }),
            expect.objectContaining({ groupIdx: 0, yValue: 7, seriesIdx: 2, yScaleKey: '__log' }),
            expect.objectContaining({ groupIdx: 1, yValue: 7, seriesIdx: 2, yScaleKey: '__log' }),
            expect.objectContaining({ groupIdx: 2, yValue: 7, seriesIdx: 2, yScaleKey: '__log' }),
          ])
        );
      });

      it('should prepare markers for StackingMode.Normal', () => {
        const result = prepMarkers(vizFields, markerFields, markers, StackingMode.Normal);
        expect(result).toHaveLength(6);
        expect(result).toEqual(
          expect.arrayContaining([
            // marker1 on series1 (yValue = marker value)
            expect.objectContaining({ groupIdx: 0, yValue: 5, seriesIdx: 1, yScaleKey: '__fixed' }),
            expect.objectContaining({ groupIdx: 1, yValue: 5, seriesIdx: 1, yScaleKey: '__fixed' }),
            expect.objectContaining({ groupIdx: 2, yValue: 5, seriesIdx: 1, yScaleKey: '__fixed' }),
            // marker2 on series2 (yValue = series1 value + marker value)
            expect.objectContaining({ groupIdx: 0, yValue: 10 + 7, seriesIdx: 2, yScaleKey: '__log' }),
            expect.objectContaining({ groupIdx: 1, yValue: 20 + 7, seriesIdx: 2, yScaleKey: '__log' }),
            expect.objectContaining({ groupIdx: 2, yValue: 30 + 7, seriesIdx: 2, yScaleKey: '__log' }),
          ])
        );
      });

      it('should prepare markers for StackingMode.Percent', () => {
        const result = prepMarkers(vizFields, markerFields, markers, StackingMode.Percent);
        expect(result).toHaveLength(6);
        expect(result).toEqual(
          expect.arrayContaining([
            // marker1 on series1 (yValue = marker value / total)
            expect.objectContaining({ groupIdx: 0, yValue: 5 / (10 + 15), seriesIdx: 1, yScaleKey: '__fixed' }),
            expect.objectContaining({ groupIdx: 1, yValue: 5 / (20 + 25), seriesIdx: 1, yScaleKey: '__fixed' }),
            expect.objectContaining({ groupIdx: 2, yValue: 5 / (30 + 35), seriesIdx: 1, yScaleKey: '__fixed' }),
            // marker2 on series2 (yValue = (series1 value + marker value) / total)
            expect.objectContaining({ groupIdx: 0, yValue: (10 + 7) / (10 + 15), seriesIdx: 2, yScaleKey: '__log' }),
            expect.objectContaining({ groupIdx: 1, yValue: (20 + 7) / (20 + 25), seriesIdx: 2, yScaleKey: '__log' }),
            expect.objectContaining({ groupIdx: 2, yValue: (30 + 7) / (30 + 35), seriesIdx: 2, yScaleKey: '__log' }),
          ])
        );
      });

      describe('hideMarkerSeries', () => {
        it('removes marker fields from a deep-copied PanelData and returns them in markerData', () => {
          const df = new MutableDataFrame({
            fields: [
              { name: 'x', type: FieldType.string, values: ['a', 'b'] },
              { name: 'metric', type: FieldType.number, values: [1, 2] },
              { name: 'marker', type: FieldType.number, values: [5, 6] },
            ],
          });
          df.fields.forEach((f) => (f.config.custom = f.config.custom ?? {}));

          const panelData = { series: [df] } as any;
          const markers = [
            {
              id: 1,
              dataField: 'marker',
              targetField: 'series1',
              opts: { label: 'john', shape: 'circle', color: 'red', size: 1, opacity: 1 },
            },
          ];

          const originalFieldCount = panelData.series[0].fields.length;

          const { barData, markerData } = seperateMarkerSeries(panelData, markers);

          // marker removed from returned barData
          expect(barData.series[0].fields.find((f: any) => f.name === 'marker')).toBeUndefined();
          // marker returned in markerData
          expect(markerData).toHaveLength(1);
          expect(markerData[0].name).toBe('marker');

          // original panelData must remain unchanged (deep copy)
          expect(panelData.series[0].fields.find((f: any) => f.name === 'marker')).toBeDefined();
          expect(panelData.series[0].fields.length).toBe(originalFieldCount);
        });

        it('ignores markers that reference missing fields and handles duplicate marker references gracefully', () => {
          const df = new MutableDataFrame({
            fields: [
              { name: 'x', type: FieldType.string, values: ['a'] },
              { name: 'metric', type: FieldType.number, values: [1] },
              { name: 'markerA', type: FieldType.number, values: [9] },
            ],
          });
          df.fields.forEach((f) => (f.config.custom = f.config.custom ?? {}));

          const panelData = { series: [df] } as any;

          // two markers refer to the same dataField and one refers to a non-existent field
          const markers = [
            {
              id: 1,
              dataField: 'markerA',
              targetField: 'metric',
              opts: { label: 'john', shape: 'circle', color: 'red', size: 1, opacity: 1 },
            },
            {
              id: 3,
              dataField: 'markerA',
              targetField: 'none_existent',
              opts: { label: 'jane', shape: 'circle', color: 'blue', size: 1, opacity: 1 },
            },
          ];

          const { barData, markerData } = seperateMarkerSeries(panelData, markers);

          // only one marker field present and removed once
          expect(markerData).toHaveLength(1);
          expect(markerData[0].name).toBe('markerA');

          // barData no longer contains the marker field
          expect(barData.series[0].fields.find((f: any) => f.name === 'markerA')).toBeUndefined();

          // missing marker had no effect
          expect(barData.series[0].fields.find((f: any) => f.name === 'does_not_exist')).toBeUndefined();
        });
      });
    });
  });
});
