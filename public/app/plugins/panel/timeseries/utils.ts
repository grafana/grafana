import {
  ArrayVector,
  DataFrame,
  DataFrameType,
  Field,
  FieldType,
  getDisplayProcessor,
  getLinksSupplier,
  GrafanaTheme2,
  InterpolateFunction,
  isBooleanUnit,
  SortedVector,
  TimeRange,
} from '@grafana/data';
import { convertFieldType } from '@grafana/data/src/transformations/transformers/convertFieldType';
import { GraphFieldConfig, LineInterpolation } from '@grafana/schema';
import { applyNullInsertThreshold } from '@grafana/ui/src/components/GraphNG/nullInsertThreshold';
import { nullToValue } from '@grafana/ui/src/components/GraphNG/nullToValue';
import { partitionByValuesTransformer } from 'app/features/transformers/partitionByValues/partitionByValues';

/**
 * Returns null if there are no graphable fields
 */
export function prepareGraphableFields(
  series: DataFrame[],
  theme: GrafanaTheme2,
  timeRange?: TimeRange
): DataFrame[] | null {
  if (!series?.length) {
    return null;
  }

  // some datasources simply tag the field as time, but don't convert to milli epochs
  // so we're stuck with doing the parsing here to avoid Moment slowness everywhere later
  // this mutates (once)
  for (let frame of series) {
    for (let field of frame.fields) {
      if (field.type === FieldType.time && typeof field.values.get(0) !== 'number') {
        field.values = convertFieldType(field, { destinationType: FieldType.time }).values;
      }
    }
  }

  if (series.every((df) => df.meta?.type === DataFrameType.TimeSeriesLong)) {
    series = prepareTimeSeriesLong(series);
  }

  let copy: Field;

  const frames: DataFrame[] = [];

  for (let frame of series) {
    const fields: Field[] = [];

    let hasTimeField = false;
    let hasValueField = false;

    let nulledFrame = applyNullInsertThreshold({
      frame,
      refFieldPseudoMin: timeRange?.from.valueOf(),
      refFieldPseudoMax: timeRange?.to.valueOf(),
    });

    for (const field of nullToValue(nulledFrame).fields) {
      switch (field.type) {
        case FieldType.time:
          hasTimeField = true;
          fields.push(field);
          break;
        case FieldType.number:
          hasValueField = true;
          copy = {
            ...field,
            values: new ArrayVector(
              field.values.toArray().map((v) => {
                if (!(Number.isFinite(v) || v == null)) {
                  return null;
                }
                return v;
              })
            ),
          };

          fields.push(copy);
          break; // ok
        case FieldType.string:
          copy = {
            ...field,
            values: new ArrayVector(field.values.toArray()),
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
            values: new ArrayVector(
              field.values.toArray().map((v) => {
                if (v == null) {
                  return v;
                }
                return Boolean(v) ? 1 : 0;
              })
            ),
          };

          if (!isBooleanUnit(config.unit)) {
            config.unit = 'bool';
            copy.display = getDisplayProcessor({ field: copy, theme });
          }

          fields.push(copy);
          break;
      }
    }

    if (hasTimeField && hasValueField) {
      frames.push({
        ...frame,
        length: nulledFrame.length,
        fields,
      });
    }
  }

  if (frames.length) {
    setClassicPaletteIdxs(frames, theme);
    return frames;
  }

  return null;
}

const setClassicPaletteIdxs = (frames: DataFrame[], theme: GrafanaTheme2) => {
  let seriesIndex = 0;

  frames.forEach((frame) => {
    frame.fields.forEach((field) => {
      // TODO: also add FieldType.enum type here after https://github.com/grafana/grafana/pull/60491
      if (field.type === FieldType.number || field.type === FieldType.boolean) {
        field.state = {
          ...field.state,
          seriesIndex: seriesIndex++, // TODO: skip this for fields with custom renderers (e.g. Candlestick)?
        };
        field.display = getDisplayProcessor({ field, theme });
      }
    });
  });
};

export function getTimezones(timezones: string[] | undefined, defaultTimezone: string): string[] {
  if (!timezones || !timezones.length) {
    return [defaultTimezone];
  }
  return timezones.map((v) => (v?.length ? v : defaultTimezone));
}

export function regenerateLinksSupplier(
  alignedDataFrame: DataFrame,
  frames: DataFrame[],
  replaceVariables: InterpolateFunction,
  timeZone: string
): DataFrame {
  alignedDataFrame.fields.forEach((field) => {
    if (field.state?.origin?.frameIndex === undefined || frames[field.state?.origin?.frameIndex] === undefined) {
      return;
    }

    /* check if field has sortedVector values
      if it does, sort all string fields in the original frame by the order array already used for the field
      otherwise just attach the fields to the temporary frame used to get the links
    */
    const tempFields: Field[] = [];
    for (const frameField of frames[field.state?.origin?.frameIndex].fields) {
      if (frameField.type === FieldType.string) {
        if (field.values instanceof SortedVector) {
          const copiedField = { ...frameField };
          copiedField.values = new SortedVector(frameField.values, field.values.getOrderArray());
          tempFields.push(copiedField);
        } else {
          tempFields.push(frameField);
        }
      }
    }

    const tempFrame: DataFrame = {
      fields: [...alignedDataFrame.fields, ...tempFields],
      length: alignedDataFrame.fields.length + tempFields.length,
    };

    field.getLinks = getLinksSupplier(tempFrame, field, field.state!.scopedVars!, replaceVariables, timeZone);
  });

  return alignedDataFrame;
}

export function prepareTimeSeriesLong(series: DataFrame[]): DataFrame[] {
  // Transform each dataframe of the series
  // to handle different field names in different frames
  return series.reduce((acc: DataFrame[], dataFrame: DataFrame) => {
    // these could be different in each frame
    const stringFields = dataFrame.fields.filter((field) => field.type === FieldType.string).map((field) => field.name);

    // transform one dataFrame at a time and concat into DataFrame[]
    const transformedSeries = partitionByValuesTransformer.transformer(
      { fields: stringFields },
      { interpolate: (value: string) => value }
    )([dataFrame]);

    return acc.concat(transformedSeries);
  }, []);
}
