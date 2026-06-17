import { FieldMatcherID, FrameMatcherID, type MatcherConfig, type PanelModel } from '@grafana/data';

import { xyChartMigrationHandler } from './migrations';
import { type Options, SeriesMapping } from './panelcfg.gen';
import {
  SeriesMapping as LegacySeriesMapping,
  type Options as LegacyXYChartOptions,
  type ScatterSeriesConfig,
} from './panelcfgold.gen';

/**
 * Fixtures saved older dashboards omit some required Grafana schema fields;
 * migrations only consume `dims` / `series` / `seriesMapping`.
 */
function partialLegacy(opts: Omit<LegacyXYChartOptions, 'legend' | 'tooltip'>): LegacyXYChartOptions {
  return opts as LegacyXYChartOptions;
}

/** Minimal panel usable by {@link xyChartMigrationHandler} migration path */
function legacyPanel(opts: {
  pluginVersion?: string;
  /** Full legacy options (`dims`, `series`, …) */
  options: LegacyXYChartOptions;
  defaultsCustom?: Record<string, unknown>;
  overrides?: PanelModel['fieldConfig']['overrides'];
}): PanelModel {
  return {
    pluginVersion: opts.pluginVersion ?? '',
    options: opts.options,
    fieldConfig: {
      defaults: { custom: opts.defaultsCustom ?? {} },
      overrides: opts.overrides ?? [],
    },
  } as PanelModel;
}

describe('XYChart migrations', () => {
  describe('pluginVersion gating', () => {
    it('does not migrate when plugin version is >= 11.1', () => {
      const inputOptions = { mapping: SeriesMapping.Manual, series: [] as Options['series'] } as Options;
      const panel = {
        pluginVersion: '11.1.0',
        options: inputOptions,
      } as PanelModel;

      const options = xyChartMigrationHandler(panel);
      expect(options).toBe(inputOptions);
    });

    it('migrates when plugin version is empty', () => {
      const opts = partialLegacy({
        dims: { frame: 0 },
        seriesMapping: LegacySeriesMapping.Manual,
        series: [{ x: 'a', y: 'b' }],
      });
      const panel = legacyPanel({ options: opts });
      const out = xyChartMigrationHandler(panel);
      expect(out.mapping).toBe(SeriesMapping.Manual);
      expect(out.series).toHaveLength(1);
      expect(out.series[0].x?.matcher).toEqual({
        id: FieldMatcherID.byName,
        options: 'a',
      });
    });

    it('migrates legacy semver below 11.1 (e.g. 10.4.0)', () => {
      const opts = partialLegacy({
        dims: { frame: 0 },
        seriesMapping: LegacySeriesMapping.Manual,
        series: [{ x: 'a', y: 'b' }],
      });
      const panel = legacyPanel({ pluginVersion: '10.4.0', options: opts });
      const out = xyChartMigrationHandler(panel);
      expect(out.series[0].x?.matcher?.options).toBe('a');
    });

    it('returns options unchanged when version parses to NaN', () => {
      const input = { mapping: SeriesMapping.Auto, series: [] } as unknown as Options;
      const panel = { pluginVersion: 'x.y.z', options: input } as PanelModel;
      expect(xyChartMigrationHandler(panel)).toBe(input);
    });
  });

  describe('migrateOptions()', () => {
    it('maps manual series x/y to byName matchers and frame by index when frame omitted', () => {
      const opts = partialLegacy({
        dims: { frame: 0 },
        seriesMapping: LegacySeriesMapping.Manual,
        series: [
          { x: 'vx', y: 'vy1' },
          { x: 'vx', y: 'vy2' },
        ],
      });
      const out = xyChartMigrationHandler(legacyPanel({ options: opts }));
      expect(out.series[0].frame?.matcher).toEqual({
        id: FrameMatcherID.byIndex,
        options: 0,
      });
      expect(out.series[1].frame?.matcher).toEqual({
        id: FrameMatcherID.byIndex,
        options: 1,
      });
      expect(out.series[0].y?.matcher).toEqual({ id: FieldMatcherID.byName, options: 'vy1' });
      expect(out.series[1].y?.matcher).toEqual({ id: FieldMatcherID.byName, options: 'vy2' });
    });

    it('uses explicit per-series frame index when provided', () => {
      const opts = partialLegacy({
        dims: { frame: 99 },
        seriesMapping: LegacySeriesMapping.Manual,
        series: [{ x: 'a', y: 'b', frame: 7 }],
      });
      const out = xyChartMigrationHandler(legacyPanel({ options: opts }));
      expect(out.series[0].frame?.matcher).toEqual({
        id: FrameMatcherID.byIndex,
        options: 7,
      });
    });

    it('uses dims.x when series omits x', () => {
      const opts = partialLegacy({
        dims: { frame: 0, x: 'sharedX' },
        seriesMapping: LegacySeriesMapping.Manual,
        series: [{ y: 'y1' }],
      });
      const out = xyChartMigrationHandler(legacyPanel({ options: opts }));
      expect(out.series[0].x?.matcher).toEqual({
        id: FieldMatcherID.byName,
        options: 'sharedX',
      });
      expect(out.series[0].y?.matcher).toEqual({
        id: FieldMatcherID.byName,
        options: 'y1',
      });
    });

    it('uses byType number matchers when x and y missing (manual entries)', () => {
      const opts = partialLegacy({
        dims: { frame: 0 },
        seriesMapping: LegacySeriesMapping.Manual,
        series: [{}],
      });
      const out = xyChartMigrationHandler(legacyPanel({ options: opts }));
      expect(out.series[0].x?.matcher).toEqual({
        id: FieldMatcherID.byType,
        options: 'number',
      });
      expect(out.series[0].y?.matcher).toEqual({
        id: FieldMatcherID.byType,
        options: 'number',
      });
    });

    it('maps auto series mode to single default series using dims.frame', () => {
      const opts = partialLegacy({
        dims: { frame: 3, exclude: ['e1'], x: 'cx' },
        seriesMapping: LegacySeriesMapping.Auto,
        series: [{ x: 'ignored', y: 'ignored' }],
      });
      const out = xyChartMigrationHandler(legacyPanel({ options: opts }));
      expect(out.mapping).toBe(SeriesMapping.Auto);
      expect(out.series).toHaveLength(1);
      expect(out.series[0].frame?.matcher).toEqual({
        id: FrameMatcherID.byIndex,
        options: 3,
      });
      expect(out.series[0].x?.matcher).toEqual({
        id: FieldMatcherID.byName,
        options: 'cx',
      });
      const yDims = out.series[0].y as { matcher: MatcherConfig; exclude?: MatcherConfig };
      expect(yDims.exclude).toEqual({
        id: FieldMatcherID.byNames,
        options: ['e1'],
      });
    });

    it('applies dims.exclude on y.matcher for manual series when non-empty', () => {
      const opts = partialLegacy({
        dims: { frame: 0, exclude: ['y1', 'y2'] },
        seriesMapping: LegacySeriesMapping.Manual,
        series: [{ x: 'x', y: 'y' }],
      });
      const out = xyChartMigrationHandler(legacyPanel({ options: opts }));
      const yDims = out.series[0].y as { matcher: MatcherConfig; exclude?: MatcherConfig };
      expect(yDims.exclude).toEqual({
        id: FieldMatcherID.byNames,
        options: ['y1', 'y2'],
      });
    });

    it('stores color field matcher when pointColor.field is set', () => {
      const opts = partialLegacy({
        dims: { frame: 0 },
        seriesMapping: LegacySeriesMapping.Manual,
        series: [
          {
            x: 'x',
            y: 'y',
            pointColor: { field: 'colorCol' },
          } as ScatterSeriesConfig,
        ],
      });
      const out = xyChartMigrationHandler(legacyPanel({ options: opts }));
      expect(out.series[0].color?.matcher).toEqual({
        id: FieldMatcherID.byName,
        options: 'colorCol',
      });
    });

    it('stores size field matcher when pointSize.field is set', () => {
      const opts = partialLegacy({
        dims: { frame: 0 },
        seriesMapping: LegacySeriesMapping.Manual,
        series: [
          {
            x: 'x',
            y: 'y',
            pointSize: { field: 'sizeCol' },
          } as ScatterSeriesConfig,
        ],
      });
      const out = xyChartMigrationHandler(legacyPanel({ options: opts }));
      expect(out.series[0].size?.matcher).toEqual({
        id: FieldMatcherID.byName,
        options: 'sizeCol',
      });
    });

    it('promotes fixed pointColor to field override when it differs from defaults', () => {
      const opts = partialLegacy({
        dims: { frame: 0 },
        seriesMapping: LegacySeriesMapping.Manual,
        series: [{ x: 'x', y: 'yMetric', pointColor: { fixed: '#aabbcc' } } as ScatterSeriesConfig],
      });
      const panel = legacyPanel({
        options: opts,
        defaultsCustom: { pointColor: { fixed: '#ffffff' } },
      });
      xyChartMigrationHandler(panel);

      expect(panel.fieldConfig.overrides).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            matcher: { id: FieldMatcherID.byName, options: 'yMetric' },
            properties: [
              expect.objectContaining({
                id: 'color',
                value: { mode: 'fixed', fixedColor: '#aabbcc' },
              }),
            ],
          }),
        ])
      );
    });

    it('does not add color override when pointColor.fixed equals default', () => {
      const opts = partialLegacy({
        dims: { frame: 0 },
        seriesMapping: LegacySeriesMapping.Manual,
        series: [{ x: 'x', y: 'y', pointColor: { fixed: '#00ff00' } } as ScatterSeriesConfig],
      });
      const panel = legacyPanel({
        options: opts,
        defaultsCustom: { pointColor: { fixed: '#00ff00' } },
      });
      xyChartMigrationHandler(panel);
      expect(panel.fieldConfig.overrides.filter((o) => o.properties.some((p) => p.id === 'color'))).toHaveLength(0);
    });

    it('does not duplicate color override when identical y matcher already has color property', () => {
      const opts = partialLegacy({
        dims: { frame: 0 },
        seriesMapping: LegacySeriesMapping.Manual,
        series: [{ x: 'x', y: 'sameY', pointColor: { fixed: '#ff0000' } } as ScatterSeriesConfig],
      });
      const panel = legacyPanel({
        options: opts,
        defaultsCustom: {},
        overrides: [
          {
            matcher: { id: FieldMatcherID.byName, options: 'sameY' },
            properties: [{ id: 'color', value: { mode: 'fixed', fixedColor: '#000000' } }],
          },
        ],
      });

      xyChartMigrationHandler(panel);
      expect(panel.fieldConfig.overrides.filter((o) => o.properties.some((p) => p.id === 'color'))).toHaveLength(1);
    });

    it('promotes fixed pointSize to override when different from defaults', () => {
      const opts = partialLegacy({
        dims: { frame: 0 },
        seriesMapping: LegacySeriesMapping.Manual,
        series: [{ x: 'x', y: 'ySz', pointSize: { fixed: 12 } } as ScatterSeriesConfig],
      });
      const panel = legacyPanel({
        options: opts,
        defaultsCustom: { pointSize: { fixed: 3 } },
      });
      xyChartMigrationHandler(panel);
      expect(panel.fieldConfig.overrides).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            matcher: { id: FieldMatcherID.byName, options: 'ySz' },
            properties: [expect.objectContaining({ id: 'custom.pointSize.fixed', value: 12 })],
          }),
        ])
      );
    });

    it('does not duplicate pointSize.fixed override when one already exists for y matcher', () => {
      const opts = partialLegacy({
        dims: { frame: 0 },
        seriesMapping: LegacySeriesMapping.Manual,
        series: [{ x: 'x', y: 'sameY', pointSize: { fixed: 42 } } as ScatterSeriesConfig],
      });
      const panel = legacyPanel({
        options: opts,
        defaultsCustom: {},
        overrides: [
          {
            matcher: { id: FieldMatcherID.byName, options: 'sameY' },
            properties: [{ id: 'custom.pointSize.fixed', value: 99 }],
          },
        ],
      });

      xyChartMigrationHandler(panel);
      expect(
        panel.fieldConfig.overrides.filter((o) => o.properties.some((p) => p.id === 'custom.pointSize.fixed'))
      ).toHaveLength(1);
    });

    it('adds pointSize min/max overrides on size field when pointSize.field is set', () => {
      const opts = partialLegacy({
        dims: { frame: 0 },
        seriesMapping: LegacySeriesMapping.Manual,
        series: [
          {
            x: 'x',
            y: 'y',
            pointSize: { field: 'bubble', min: 2, max: 50 },
          } as ScatterSeriesConfig,
        ],
      });
      const panel = legacyPanel({
        options: opts,
        defaultsCustom: { pointSize: { min: 0, max: 100 } },
      });
      xyChartMigrationHandler(panel);

      expect(panel.fieldConfig.overrides).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            matcher: { id: FieldMatcherID.byName, options: 'bubble' },
            properties: [expect.objectContaining({ id: 'custom.pointSize.min', value: 2 })],
          }),
          expect.objectContaining({
            matcher: { id: FieldMatcherID.byName, options: 'bubble' },
            properties: [expect.objectContaining({ id: 'custom.pointSize.max', value: 50 })],
          }),
        ])
      );
    });

    it('preserves unrelated option keys (e.g. tooltip) after migration', () => {
      const opts = {
        dims: { frame: 0 },
        seriesMapping: LegacySeriesMapping.Manual,
        series: [{ x: 'x', y: 'y' }],
        tooltip: { mode: 'multi' as const },
      } as LegacyXYChartOptions;
      const out = xyChartMigrationHandler(legacyPanel({ options: opts }));
      expect((out as Options & { tooltip?: { mode: string } }).tooltip).toEqual({ mode: 'multi' });
    });

    it('defaults undefined seriesMapping to manual in output', () => {
      const opts = {
        dims: { frame: 0 },
        series: [{ x: 'x', y: 'y' }],
      } as LegacyXYChartOptions;
      const out = xyChartMigrationHandler(legacyPanel({ options: opts }));
      expect(out.mapping).toBe(SeriesMapping.Manual);
    });
  });
});
