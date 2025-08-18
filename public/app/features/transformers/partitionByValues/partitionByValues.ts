import { cloneDeep } from 'lodash';
import { map } from 'rxjs';

import {
  DataFrame,
  DataTransformerID,
  SynchronousDataTransformerInfo,
  getFieldMatcher,
  DataTransformContext,
  FieldMatcher,
  cacheFieldDisplayNames,
} from '@grafana/data';
import { getMatcherConfig, noopTransformer } from '@grafana/data/internal';
import { t } from '@grafana/i18n';

import { partition } from './partition';

export interface FrameNamingOptions {
  /** when true, the frame name is copied unmodified, and discriminator fields' names+values become field labels in new frames */
  asLabels?: boolean;

  /** opts below are used only when asLabels: false */

  /** whether to append to existing frame name, false -> replace */
  append?: boolean; // false
  /** whether to include discriminator field names, e.g. true -> Region=Europe Profession=Chef, false -> 'Europe Chef'  */
  withNames?: boolean; // false
  /** name/value separator, e.g. '=' in 'Region=Europe' */
  separator1?: string;
  /** name/value pair separator, e.g. ' ' in 'Region=Europe Profession=Chef' */
  separator2?: string;
}

const defaultFrameNameOptions: FrameNamingOptions = {
  asLabels: true,

  append: false,
  withNames: false,
  separator1: '=',
  separator2: ' ',
};

export interface PartitionByValuesTransformerOptions {
  /** field names whose values should be used as discriminator keys (typically enum fields) */
  fields: string[];
  /** how the split frames' names should be suffixed (ends up as field prefixes) */
  naming?: FrameNamingOptions;
  /** should the discriminator fields be kept in the output */
  keepFields?: boolean;
}

function buildFrameName(opts: FrameNamingOptions, names: string[], values: unknown[]): string {
  return names
    .map((name, i) => (opts.withNames ? `${name}${opts.separator1}${values[i]}` : values[i]))
    .join(opts.separator2);
}

function buildFieldLabels(names: string[], values: unknown[]) {
  const labels: Record<string, string> = {};

  names.forEach((name, i) => {
    labels[name] = String(values[i]);
  });

  return labels;
}

export const getPartitionByValuesTransformer: () => SynchronousDataTransformerInfo<PartitionByValuesTransformerOptions> =
  () => ({
    id: DataTransformerID.partitionByValues,
    name: t('transformers.get-partition-by-values-transformer.name.partition-by-values', 'Partition by values'),
    description: t(
      'transformers.get-partition-by-values-transformer.description.split-oneframe-dataset-multiple-series',
      'Split a one-frame dataset into multiple series.'
    ),
    defaultOptions: {
      keepFields: false,
    },

    operator: (options, ctx) => (source) =>
      source.pipe(map((data) => getPartitionByValuesTransformer().transformer(options, ctx)(data))),

    transformer: (options: PartitionByValuesTransformerOptions, ctx: DataTransformContext) => {
      const matcherConfig = getMatcherConfig({ names: options.fields });

      if (!matcherConfig) {
        return noopTransformer.transformer({}, ctx);
      }

      const matcher = getFieldMatcher(matcherConfig);

      return (data: DataFrame[]) => {
        if (!data.length) {
          return data;
        }
        // error if > 1 frame?
        return partitionByValues(data[0], matcher, options);
      };
    },
  });

// Split a single frame dataset into multiple frames based on values in a set of fields
function _partitionByValues(
  frame: DataFrame,
  matcher: FieldMatcher,
  options?: PartitionByValuesTransformerOptions
): DataFrame[] {
  const keyFields = frame.fields.filter((f) => matcher(f, frame, [frame]))!;

  if (!keyFields.length) {
    return [frame];
  }

  const keyFieldsVals = keyFields.map((f) => f.values);
  const names = keyFields.map((f) => f.name);

  const frameNameOpts = {
    ...defaultFrameNameOptions,
    ...options?.naming,
  };

  return partition(keyFieldsVals).map((idxs: number[]) => {
    let frameName = frame.name;
    let fieldLabels = {};

    if (frameNameOpts.asLabels) {
      fieldLabels = buildFieldLabels(
        names,
        keyFields.map((f, i) => keyFieldsVals[i][idxs[0]])
      );
    } else {
      let name = buildFrameName(
        frameNameOpts,
        names,
        keyFields.map((f, i) => keyFieldsVals[i][idxs[0]])
      );

      if (frameNameOpts?.append && frame.name) {
        name = `${frame.name} ${name}`;
      }

      frameName = name;
    }

    let filteredFields = frame.fields;

    if (!options?.keepFields) {
      const keyFieldNames = new Set(names);
      filteredFields = frame.fields.filter((field) => !keyFieldNames.has(field.name));
    }

    return {
      name: frameName,
      meta: frame.meta,
      length: idxs.length,
      fields: filteredFields.map((f) => {
        const vals = f.values;
        const vals2 = Array(idxs.length);

        for (let i = 0; i < idxs.length; i++) {
          vals2[i] = vals[idxs[i]];
        }

        return {
          name: f.name,
          type: f.type,
          config: cloneDeep(f.config),
          labels: {
            ...f.labels,
            ...fieldLabels,
          },
          values: vals2,
        };
      }),
    };
  });
}

// since this transformation splits one frame into multiple, we end up with duplicate field names across all frames
// this is normally okay since getFieldDisplayName() -> calculateFieldDisplayName() avoids creating duplicate names
// by using other sources of entropy such as refIds, frame names, field labels, and increments.

// however, this does *not* work if a field has been renamed by the user or datasource (config.displayName or config.displayNameFromDS).
// Organize fields transformation or field overrides are common places where this happens.
// in this situation the auto-namer is skipped, and we end up with multiple fields named exactly the same.

// consequently, onToggleSeriesVisibility() (from usePanelContext) does not have a unique field name to use for applying a
// fieldMatcher that controls field.config.hideFrom.viz

// so what we need to do to make this work is either make field.name unique or make field.config.displayName unique.
// since field.name might need to be used for data links and subsequent drill down queries, we cannot overwrite it.
// therefore, the code below [unfortunately] has to modify field.config.displayName by using calculateFieldDisplayName() logic.
// this will have the side-effect of the displayName being a more verbose variant of what the user indicated, except in panels that
// know how to remove common prefixes/suffixes from field names in tooltip and legend rendering (like XYChart)
export function partitionByValues(
  frame: DataFrame,
  matcher: FieldMatcher,
  options?: PartitionByValuesTransformerOptions
) {
  // remember original field names, we'll need to restore them later
  let fieldNames: Record<string, string> = {};

  let frame2 = {
    ...frame,

    fields: frame.fields.map((f) => {
      let f2 = f;

      let renameTo = f.config.displayNameFromDS ?? f.config.displayName;

      if (renameTo) {
        f2 = {
          ...f,
          config: {
            ...f.config,
          },
          state: {
            ...f.state,
          },
        };

        fieldNames[renameTo] = f.name;
        f2.name = renameTo;

        delete f2.config.displayName;
        delete f2.config.displayNameFromDS;
        delete f2.state?.displayName;
      }

      return f2;
    }),
  };

  let frames2 = _partitionByValues(frame2, matcher, options);

  cacheFieldDisplayNames(frames2);

  // restore original field names
  frames2.forEach((frame) => {
    frame.fields.forEach((field) => {
      if (field.name in fieldNames) {
        field.name = fieldNames[field.name] ?? field.name;
        field.config.displayName = field.state!.displayName!;
      }
    });
  });

  return frames2;
}
