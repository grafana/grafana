import {
  DataFrame,
  Field,
  FieldType,
  getDisplayProcessor,
  GrafanaTheme2,
  isBooleanUnit,
  TimeRange,
  cacheFieldDisplayNames,
  applyNullInsertThreshold,
  nullToValue,
} from '@grafana/data';
import { convertFieldType } from '@grafana/data/internal';
import { GraphFieldConfig, LineInterpolation, TooltipDisplayMode, VizTooltipOptions } from '@grafana/schema';
import { buildScaleKey } from '@grafana/ui/internal';

import { HeatmapTooltip } from '../heatmap/panelcfg.gen';

type ScaleKey = string;

// this will re-enumerate all enum fields on the same scale to create one ordinal progression
// e.g. ['a','b'][0,1,0] + ['c','d'][1,0,1] -> ['a','b'][0,1,0] + ['c','d'][3,2,3]
function reEnumFields(frames: DataFrame[]): DataFrame[] {
  let allTextsByKey: Map<ScaleKey, string[]> = new Map();

  let frames2: DataFrame[] = frames.map((frame) => {
    return {
      ...frame,
      fields: frame.fields.map((field) => {
        if (field.type === FieldType.enum) {
          let scaleKey = buildScaleKey(field.config, field.type);
          let allTexts = allTextsByKey.get(scaleKey);

          if (!allTexts) {
            allTexts = [];
            allTextsByKey.set(scaleKey, allTexts);
          }

          let idxs: number[] = field.values.toArray().slice();
          let txts = field.config.type!.enum!.text!;

          // by-reference incrementing
          if (allTexts.length > 0) {
            for (let i = 0; i < idxs.length; i++) {
              idxs[i] += allTexts.length;
            }
          }

          allTexts.push(...txts);

          // shared among all enum fields on same scale
          field.config.type!.enum!.text! = allTexts;

          return {
            ...field,
            values: idxs,
          };

          // TODO: update displayProcessor?
        }

        return field;
      }),
    };
  });

  return frames2;
}

/**
 * Returns null if there are no graphable fields
 */
export function prepareGraphableFields(
  series: DataFrame[],
  theme: GrafanaTheme2,
  timeRange?: TimeRange,
  // numeric X requires a single frame where the first field is numeric
  xNumFieldIdx?: number
): DataFrame[] | null {
  if (!series?.length) {
    return null;
  }

  cacheFieldDisplayNames(series);

  let useNumericX = xNumFieldIdx != null;

  // Make sure the numeric x field is first in the frame
  if (xNumFieldIdx != null && xNumFieldIdx > 0) {
    series = [
      {
        ...series[0],
        fields: [series[0].fields[xNumFieldIdx], ...series[0].fields.filter((f, i) => i !== xNumFieldIdx)],
      },
    ];
  }

  // some datasources simply tag the field as time, but don't convert to milli epochs
  // so we're stuck with doing the parsing here to avoid Moment slowness everywhere later
  // this mutates (once)
  for (let frame of series) {
    for (let field of frame.fields) {
      if (field.type === FieldType.time && typeof field.values[0] !== 'number') {
        field.values = convertFieldType(field, { destinationType: FieldType.time }).values;
      }
    }
  }

  let enumFieldsCount = 0;

  loopy: for (let frame of series) {
    for (let field of frame.fields) {
      if (field.type === FieldType.enum && ++enumFieldsCount > 1) {
        series = reEnumFields(series);
        break loopy;
      }
    }
  }

  let copy: Field;

  const frames: DataFrame[] = [];

  for (let frame of series) {
    const fields: Field[] = [];

    let hasTimeField = false;
    let hasValueField = false;

    let nulledFrame = useNumericX
      ? frame
      : applyNullInsertThreshold({
          frame,
          refFieldPseudoMin: timeRange?.from.valueOf(),
          refFieldPseudoMax: timeRange?.to.valueOf(),
        });

    const frameFields = nullToValue(nulledFrame).fields;

    for (let fieldIdx = 0; fieldIdx < (frameFields?.length || 0); fieldIdx++) {
      const field = frameFields[fieldIdx];

      switch (field.type) {
        case FieldType.time:
          hasTimeField = true;
          fields.push(field);
          break;
        case FieldType.number:
          hasValueField = useNumericX ? fieldIdx > 0 : true;
          copy = {
            ...field,
            values: field.values.map((v) => {
              if (!(Number.isFinite(v) || v == null)) {
                return null;
              }
              return v;
            }),
          };

          fields.push(copy);
          break; // ok
        case FieldType.enum:
          hasValueField = true;
        case FieldType.string:
          copy = {
            ...field,
            values: field.values,
          };

          fields.push(copy);
          break; // ok
        case FieldType.boolean:
          hasValueField = true;
          const custom: GraphFieldConfig = field.config?.custom ?? {};
          const config = {
            ...field.config,
            max: 1,
            min: 0,
            custom,
          };

          // smooth and linear do not make sense
          if (custom.lineInterpolation !== LineInterpolation.StepBefore) {
            custom.lineInterpolation = LineInterpolation.StepAfter;
          }

          copy = {
            ...field,
            config,
            type: FieldType.number,
            values: field.values.map((v) => {
              if (v == null) {
                return v;
              }
              return Boolean(v) ? 1 : 0;
            }),
          };

          if (!isBooleanUnit(config.unit)) {
            config.unit = 'bool';
            copy.display = getDisplayProcessor({ field: copy, theme });
          }

          fields.push(copy);
          break;
      }
    }

    if ((useNumericX || hasTimeField) && hasValueField) {
      frames.push({
        ...frame,
        length: nulledFrame.length,
        fields,
      });
    }
  }

  if (frames.length) {
    setClassicPaletteIdxs(frames, theme, 0);
    matchEnumColorToSeriesColor(frames, theme);
    return frames;
  }

  return null;
}

const matchEnumColorToSeriesColor = (frames: DataFrame[], theme: GrafanaTheme2) => {
  const { palette } = theme.visualization;
  for (const frame of frames) {
    for (const field of frame.fields) {
      if (field.type === FieldType.enum) {
        const namedColor = palette[field.state?.seriesIndex! % palette.length];
        const hexColor = theme.visualization.getColorByName(namedColor);
        const enumConfig = field.config.type!.enum!;

        enumConfig.color = Array(enumConfig.text!.length).fill(hexColor);
        field.display = getDisplayProcessor({ field, theme });
      }
    }
  }
};

export const setClassicPaletteIdxs = (frames: DataFrame[], theme: GrafanaTheme2, skipFieldIdx?: number) => {
  let seriesIndex = 0;

  const updateFieldDisplay = (field: Field, idx: number) => {
    field.state = { ...field.state, seriesIndex: idx };
    field.display = getDisplayProcessor({ field, theme });
  };

  const shouldProcessField = (field: Field, fieldIdx: number) => {
    return (
      fieldIdx !== skipFieldIdx &&
      (field.type === FieldType.number || field.type === FieldType.boolean || field.type === FieldType.enum)
    );
  };

  for (const frame of frames) {
    const isCompareFrame = frame.meta?.timeCompare?.isTimeShiftQuery;

    if (isCompareFrame) {
      // Handle compare frames
      const baseRefId = frame.refId?.replace('-compare', ''); // TODO update scenes to include original refId in meta
      const mainFrame = baseRefId ? frames.find((f) => f.refId === baseRefId) : undefined;

      if (mainFrame && mainFrame.fields.length === frame.fields.length) {
        // Match series indices with main frame
        frame.fields.forEach((field, fieldIdx) => {
          if (shouldProcessField(field, fieldIdx)) {
            const mainField = mainFrame.fields[fieldIdx];
            updateFieldDisplay(field, mainField.state?.seriesIndex ?? seriesIndex++);
          }
        });
      } else {
        // Fallback to incremental assignment
        frame.fields.forEach((field, fieldIdx) => {
          if (shouldProcessField(field, fieldIdx)) {
            updateFieldDisplay(field, seriesIndex++);
          }
        });
      }
    } else {
      // Handle main frames - assign incremental series indices
      frame.fields.forEach((field, fieldIdx) => {
        if (shouldProcessField(field, fieldIdx)) {
          updateFieldDisplay(field, seriesIndex++);
        }
      });
    }
  }
};

export function getTimezones(timezones: string[] | undefined, defaultTimezone: string): string[] {
  if (!timezones || !timezones.length) {
    return [defaultTimezone];
  }
  return timezones.map((v) => (v?.length ? v : defaultTimezone));
}

export const isTooltipScrollable = (tooltipOptions: VizTooltipOptions | HeatmapTooltip) => {
  return tooltipOptions.mode === TooltipDisplayMode.Multi && tooltipOptions.maxHeight != null;
};
