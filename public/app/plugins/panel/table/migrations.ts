import { omitBy, isNil, isNumber, defaultTo, groupBy } from 'lodash';

import {
  PanelModel,
  FieldMatcherID,
  ConfigOverrideRule,
  ThresholdsMode,
  ThresholdsConfig,
  FieldConfig,
  DataFrame,
  FieldType,
} from '@grafana/data';
import { ReduceTransformerOptions } from '@grafana/data/internal';

import { Options } from './panelcfg.gen';

/**
 * At 7.0, the `table` panel was swapped from an angular implementation to a react one.
 * The models do not match, so this process will delegate to the old implementation when
 * a saved table configuration exists.
 */
export const tableMigrationHandler = (panel: PanelModel<Options>): Partial<Options> => {
  // Table was saved as an angular table, lets just swap to the 'table-old' panel
  if (!panel.pluginVersion && 'columns' in panel) {
    console.log('Was angular table', panel);
  }

  // Nothing changed
  return panel.options;
};

const transformsMap = {
  timeseries_to_rows: 'seriesToRows',
  timeseries_to_columns: 'seriesToColumns',
  timeseries_aggregations: 'reduce',
  table: 'merge',
};

const columnsMap = {
  avg: 'mean',
  min: 'min',
  max: 'max',
  total: 'sum',
  current: 'lastNotNull',
  count: 'count',
};

const colorModeMap = {
  cell: 'color-background',
  row: 'color-background',
  value: 'color-text',
};

type Transformations = keyof typeof transformsMap;

type Transformation = {
  id: string;
  options: ReduceTransformerOptions;
};

type Columns = keyof typeof columnsMap;

type Column = {
  value: Columns;
  text: string;
};

type ColorModes = keyof typeof colorModeMap;

const generateThresholds = (thresholds: string[], colors: string[]) => {
  return [-Infinity, ...thresholds].map((threshold, idx) => ({
    color: colors[idx],
    value: isNumber(threshold) ? threshold : parseInt(threshold, 10),
  }));
};

const migrateTransformations = (
  panel: PanelModel<Partial<Options>>,
  oldOpts: { columns: any; transform: Transformations }
) => {
  const transformations: Transformation[] = panel.transformations ?? [];
  if (Object.keys(transformsMap).includes(oldOpts.transform)) {
    const opts: ReduceTransformerOptions = {
      reducers: [],
    };
    if (oldOpts.transform === 'timeseries_aggregations') {
      opts.includeTimeField = false;
      opts.reducers = oldOpts.columns.map((column: Column) => columnsMap[column.value]);
    }
    transformations.push({
      id: transformsMap[oldOpts.transform],
      options: opts,
    });
  }
  return transformations;
};

type Style = {
  unit: string;
  type: string;
  alias: string;
  decimals: number;
  colors: string[];
  colorMode: ColorModes;
  pattern: string;
  thresholds: string[];
  align?: string;
  dateFormat: string;
  link: boolean;
  linkTargetBlank?: boolean;
  linkTooltip?: string;
  linkUrl?: string;
};

const migrateTableStyleToOverride = (style: Style) => {
  const fieldMatcherId = /^\/.*\/$/.test(style.pattern) ? FieldMatcherID.byRegexp : FieldMatcherID.byName;
  const override: ConfigOverrideRule = {
    matcher: {
      id: fieldMatcherId,
      options: style.pattern,
    },
    properties: [],
  };

  if (style.alias) {
    override.properties.push({
      id: 'displayName',
      value: style.alias,
    });
  }

  if (style.unit) {
    override.properties.push({
      id: 'unit',
      value: style.unit,
    });
  }

  if (style.decimals) {
    override.properties.push({
      id: 'decimals',
      value: style.decimals,
    });
  }

  if (style.type === 'date') {
    override.properties.push({
      id: 'unit',
      value: `time: ${style.dateFormat}`,
    });
  }

  if (style.type === 'hidden') {
    override.properties.push({
      id: 'custom.hidden',
      value: true,
    });
  }

  if (style.link) {
    override.properties.push({
      id: 'links',
      value: [
        {
          title: defaultTo(style.linkTooltip, ''),
          url: defaultTo(style.linkUrl, ''),
          targetBlank: defaultTo(style.linkTargetBlank, false),
        },
      ],
    });
  }

  if (style.colorMode) {
    override.properties.push({
      id: 'custom.cellOptions',
      value: {
        type: colorModeMap[style.colorMode],
      },
    });
  }

  if (style.align) {
    override.properties.push({
      id: 'custom.align',
      value: style.align === 'auto' ? null : style.align,
    });
  }

  if (style.thresholds?.length) {
    override.properties.push({
      id: 'thresholds',
      value: {
        mode: ThresholdsMode.Absolute,
        steps: generateThresholds(style.thresholds, style.colors),
      },
    });
  }

  return override;
};

const migrateDefaults = (prevDefaults: Style) => {
  let defaults: FieldConfig = {
    custom: {},
  };
  if (prevDefaults) {
    defaults = omitBy(
      {
        unit: prevDefaults.unit,
        decimals: prevDefaults.decimals,
        displayName: prevDefaults.alias,
        custom: {
          align: prevDefaults.align === 'auto' ? null : prevDefaults.align,
        },
      },
      isNil
    );

    if (prevDefaults.thresholds.length) {
      const thresholds: ThresholdsConfig = {
        mode: ThresholdsMode.Absolute,
        steps: generateThresholds(prevDefaults.thresholds, prevDefaults.colors),
      };
      defaults.thresholds = thresholds;
    }

    if (prevDefaults.colorMode) {
      defaults.custom.cellOptions = {
        type: colorModeMap[prevDefaults.colorMode],
      };
    }
  }
  return defaults;
};

/**
 * This is called when the panel changes from another panel
 */
export const tablePanelChangedHandler = (
  panel: PanelModel<Partial<Options>>,
  prevPluginId: string,
  prevOptions: any
) => {
  // Changing from angular table panel
  if (prevPluginId === 'table-old' && prevOptions.angular) {
    const oldOpts = prevOptions.angular;
    const transformations = migrateTransformations(panel, oldOpts);
    const prevDefaults = oldOpts.styles.find((style: any) => style.pattern === '/.*/');
    const defaults = migrateDefaults(prevDefaults);
    const overrides = oldOpts.styles.filter((style: any) => style.pattern !== '/.*/').map(migrateTableStyleToOverride);

    panel.transformations = transformations;
    panel.fieldConfig = {
      defaults,
      overrides,
    };
  }

  return {};
};

const getMainFrames = (frames: DataFrame[] | null) => {
  return frames?.filter((df) => df.meta?.custom?.parentRowIndex === undefined) || [frames?.[0]];
};

/**
 * In 9.3 meta.custom.parentRowIndex was introduced to support sub-tables.
 * In 10.2 meta.custom.parentRowIndex was deprecated in favor of FieldType.nestedFrames, which supports multiple nested frames.
 * Migrate DataFrame[] from using meta.custom.parentRowIndex to using FieldType.nestedFrames
 */
export const migrateFromParentRowIndexToNestedFrames = (frames: DataFrame[] | null) => {
  const migratedFrames: DataFrame[] = [];
  const mainFrames = getMainFrames(frames).filter(
    (frame: DataFrame | undefined): frame is DataFrame => !!frame && frame.length !== 0
  );

  mainFrames?.forEach((frame) => {
    const subFrames = frames?.filter((df) => frame.refId === df.refId && df.meta?.custom?.parentRowIndex !== undefined);
    const subFramesGrouped = groupBy(subFrames, (frame: DataFrame) => frame.meta?.custom?.parentRowIndex);
    const subFramesByIndex = Object.keys(subFramesGrouped).map((key) => subFramesGrouped[key]);
    const migratedFrame = { ...frame };

    if (subFrames && subFrames.length > 0) {
      migratedFrame.fields.push({
        name: 'nested',
        type: FieldType.nestedFrames,
        config: {},
        values: subFramesByIndex,
      });
    }
    migratedFrames.push(migratedFrame);
  });

  return migratedFrames;
};

export const hasDeprecatedParentRowIndex = (frames: DataFrame[] | null) => {
  return frames?.some((df) => df.meta?.custom?.parentRowIndex !== undefined);
};
