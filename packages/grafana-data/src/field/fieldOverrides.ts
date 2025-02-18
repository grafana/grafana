import { isNumber, set, unset, get, cloneDeep } from 'lodash';
import { useMemo, useRef } from 'react';
import usePrevious from 'react-use/lib/usePrevious';

import { ThresholdsMode, VariableFormatID } from '@grafana/schema';

import { compareArrayValues, compareDataFrameStructures } from '../dataframe/frameComparisons';
import { guessFieldTypeForField } from '../dataframe/processDataFrame';
import { PanelPlugin } from '../panel/PanelPlugin';
import { asHexString } from '../themes/colorManipulator';
import { GrafanaTheme2 } from '../themes/types';
import { ReducerID, reduceField } from '../transformations/fieldReducer';
import { fieldMatchers } from '../transformations/matchers';
import { ScopedVars, DataContextScopedVar } from '../types/ScopedVars';
import { DataFrame, NumericRange, FieldType, Field, ValueLinkConfig, FieldConfig } from '../types/dataFrame';
import { LinkModel, DataLink } from '../types/dataLink';
import { DisplayProcessor, DisplayValue, DecimalCount } from '../types/displayValue';
import { FieldColorModeId } from '../types/fieldColor';
import {
  DynamicConfigValue,
  ApplyFieldOverrideOptions,
  FieldOverrideContext,
  FieldConfigPropertyItem,
  DataLinkPostProcessor,
  FieldConfigSource,
} from '../types/fieldOverrides';
import { InterpolateFunction, PanelData } from '../types/panel';
import { TimeZone } from '../types/time';
import { FieldMatcher } from '../types/transformations';
import { mapInternalLinkToExplore } from '../utils/dataLinks';
import { locationUtil } from '../utils/location';

import { FieldConfigOptionsRegistry } from './FieldConfigOptionsRegistry';
import { getDisplayProcessor, getRawDisplayProcessor } from './displayProcessor';
import { getMinMaxAndDelta } from './scale';
import { standardFieldConfigEditorRegistry } from './standardFieldConfigEditorRegistry';

interface OverrideProps {
  match: FieldMatcher;
  properties: DynamicConfigValue[];
}

export function findNumericFieldMinMax(data: DataFrame[]): NumericRange {
  let min: number | null = null;
  let max: number | null = null;

  const reducers = [ReducerID.min, ReducerID.max];

  for (const frame of data) {
    for (const field of frame.fields) {
      if (field.type === FieldType.number) {
        const stats = reduceField({ field, reducers });
        const statsMin = stats[ReducerID.min];
        const statsMax = stats[ReducerID.max];

        if (min === null || statsMin < min) {
          min = statsMin;
        }

        if (max === null || statsMax > max) {
          max = statsMax;
        }
      }
    }
  }

  return { min, max, delta: (max ?? 0) - (min ?? 0) };
}

/**
 * Return a copy of the DataFrame with all rules applied
 */
export function applyFieldOverrides(options: ApplyFieldOverrideOptions): DataFrame[] {
  if (!options.data) {
    return [];
  }

  const source = options.fieldConfig;
  if (!source) {
    return options.data;
  }

  const fieldConfigRegistry = options.fieldConfigRegistry ?? standardFieldConfigEditorRegistry;

  let seriesIndex = 0;
  let globalRange: NumericRange | undefined = undefined;

  // Prepare the Matchers
  const override: OverrideProps[] = [];
  if (source.overrides) {
    for (const rule of source.overrides) {
      const info = fieldMatchers.get(rule.matcher.id);
      if (info) {
        override.push({
          match: info.get(rule.matcher.options),
          properties: rule.properties,
        });
      }
    }
  }

  return options.data.map((originalFrame, index) => {
    // Need to define this new frame here as it's passed to the getLinkSupplier function inside the fields loop
    const newFrame: DataFrame = { ...originalFrame };
    // Copy fields
    newFrame.fields = newFrame.fields.map((field) => {
      return {
        ...field,
        config: cloneDeep(field.config),
        state: {
          ...field.state,
        },
      };
    });

    for (const field of newFrame.fields) {
      const config = field.config;

      field.state!.scopedVars = {
        __dataContext: {
          value: {
            data: options.data!,
            frame: newFrame,
            frameIndex: index,
            field: field,
          },
        },
      };

      const context = {
        field: field,
        data: options.data!,
        dataFrameIndex: index,
        replaceVariables: options.replaceVariables,
        fieldConfigRegistry: fieldConfigRegistry,
      };

      // Anything in the field config that's not set by the datasource
      // will be filled in by panel's field configuration
      setFieldConfigDefaults(config, source.defaults, context);

      // Find any matching rules and then override
      for (const rule of override) {
        if (rule.match(field, newFrame, options.data!)) {
          for (const prop of rule.properties) {
            // config.scopedVars is set already here
            setDynamicConfigValue(config, prop, context);
          }
        }
      }

      // Try harder to set a real value that is not 'other'
      let type = field.type;
      if (!type || type === FieldType.other) {
        const t = guessFieldTypeForField(field);
        if (t) {
          type = t;
        }
      }

      // Set the Min/Max value automatically
      const { range, newGlobalRange } = calculateRange(config, field, globalRange, options.data!);
      globalRange = newGlobalRange;

      // Clear any cached displayName as it can change during field overrides process
      field.state!.displayName = null;
      field.state!.seriesIndex = seriesIndex;
      field.state!.range = range;
      field.type = type;

      // Some color modes needs series index to assign field color so we count
      // up series index here but ignore time fields
      if (field.type !== FieldType.time) {
        seriesIndex++;
      }

      // and set the display processor using it
      field.display = getDisplayProcessor({
        field: field,
        theme: options.theme,
        timeZone: options.timeZone,
      });

      // Wrap the display with a cache to avoid double calls
      if (field.config.unit !== 'dateTimeFromNow') {
        field.display = cachingDisplayProcessor(field.display, 2500);
      }

      // Attach data links supplier
      field.getLinks = getLinksSupplier(
        newFrame,
        field,
        field.state!.scopedVars,
        context.replaceVariables,
        options.timeZone,
        options.dataLinkPostProcessor
      );

      if (field.type === FieldType.nestedFrames) {
        for (const nestedFrames of field.values) {
          for (let nfIndex = 0; nfIndex < nestedFrames.length; nfIndex++) {
            for (const valueField of nestedFrames[nfIndex].fields) {
              // Get display processor for nested fields
              valueField.display = getDisplayProcessor({
                field: valueField,
                theme: options.theme,
                timeZone: options.timeZone,
              });

              valueField.state = {
                scopedVars: {
                  __dataContext: {
                    value: {
                      data: nestedFrames,
                      frame: nestedFrames[nfIndex],
                      frameIndex: nfIndex,
                      field: valueField,
                    },
                  },
                },
              };

              valueField.getLinks = getLinksSupplier(
                nestedFrames[nfIndex],
                valueField,
                valueField.state!.scopedVars,
                context.replaceVariables,
                options.timeZone,
                options.dataLinkPostProcessor
              );
            }
          }
        }
      }
    }

    return newFrame;
  });
}

function calculateRange(
  config: FieldConfig,
  field: Field,
  globalRange: NumericRange | undefined,
  data: DataFrame[]
): { range?: { min?: number | null; max?: number | null; delta: number }; newGlobalRange: NumericRange | undefined } {
  // Only calculate ranges when the field is a number and one of min/max is set to auto.
  if (field.type !== FieldType.number || (isNumber(config.min) && isNumber(config.max))) {
    return { newGlobalRange: globalRange };
  }

  // Calculate the min/max from the field.
  if (config.fieldMinMax) {
    const localRange = getMinMaxAndDelta(field);
    const min = config.min ?? localRange.min;
    const max = config.max ?? localRange.max;
    return { range: { min, max, delta: max! - min! }, newGlobalRange: globalRange };
  }

  // We use the global range if supplied, otherwise we calculate it.
  const newGlobalRange = globalRange ?? findNumericFieldMinMax(data);
  const min = config.min ?? newGlobalRange!.min;
  const max = config.max ?? newGlobalRange!.max;
  return { range: { min, max, delta: max! - min! }, newGlobalRange };
}

// this is a significant optimization for streaming, where we currently re-process all values in the buffer on ech update
// via field.display(value). this can potentially be removed once we...
// 1. process data packets incrementally and/if cache the results in the streaming datafame (maybe by buffer index)
// 2. have the ability to selectively get display color or text (but not always both, which are each quite expensive)
// 3. sufficently optimize text formatting and threshold color determinitation
function cachingDisplayProcessor(disp: DisplayProcessor, maxCacheSize = 2500): DisplayProcessor {
  type dispCache = Map<unknown, DisplayValue>;
  // decimals -> cache mapping, -1 is unspecified decimals
  const caches = new Map<number, dispCache>();

  // pre-init caches for up to 15 decimals
  for (let i = -1; i <= 15; i++) {
    caches.set(i, new Map());
  }

  return (value: unknown, decimals?: DecimalCount) => {
    let cache = caches.get(decimals ?? -1)!;

    let v = cache.get(value);

    if (!v) {
      // Don't grow too big
      if (cache.size === maxCacheSize) {
        cache.clear();
      }

      v = disp(value, decimals);

      // convert to hex6 or hex8 so downstream we can cheaply test for alpha (and set new alpha)
      // via a simple length check (in colorManipulator) rather using slow parsing via tinycolor
      if (v.color) {
        v.color = asHexString(v.color);
      }

      cache.set(value, v);
    }

    return v;
  };
}

export interface FieldOverrideEnv extends FieldOverrideContext {
  fieldConfigRegistry: FieldConfigOptionsRegistry;
}

export function setDynamicConfigValue(config: FieldConfig, value: DynamicConfigValue, context: FieldOverrideEnv) {
  const reg = context.fieldConfigRegistry;
  const item = reg.getIfExists(value.id);

  if (!item) {
    return;
  }

  const val = item.process(value.value, context, item.settings);

  const remove = val === undefined || val === null;

  if (remove) {
    if (item.isCustom && config.custom) {
      unset(config.custom, item.path);
    } else {
      unset(config, item.path);
    }
  } else {
    if (item.isCustom) {
      if (!config.custom) {
        config.custom = {};
      }
      set(config.custom, item.path, val);
    } else {
      set(config, item.path, val);
    }
  }
}

// config -> from DS
// defaults -> from Panel config
export function setFieldConfigDefaults(config: FieldConfig, defaults: FieldConfig, context: FieldOverrideEnv) {
  // For cases where we have links on the datasource config and the panel config, we need to merge them
  if (config.links && defaults.links) {
    // Combine the data source links and the panel default config links
    config.links = [...config.links, ...defaults.links];
  }

  // if we have a base threshold set by default but not on the config, we need to merge it in
  const defaultBaseStep =
    defaults?.thresholds?.mode === ThresholdsMode.Absolute &&
    defaults.thresholds?.steps.find((step) => step.value === -Infinity);
  if (
    config.thresholds?.mode === ThresholdsMode.Absolute &&
    !config.thresholds.steps.some((step) => step.value === -Infinity) &&
    defaultBaseStep
  ) {
    config.thresholds.steps = [defaultBaseStep, ...config.thresholds.steps];
  }
  for (const fieldConfigProperty of context.fieldConfigRegistry.list()) {
    if (fieldConfigProperty.isCustom && !config.custom) {
      config.custom = {};
    }
    processFieldConfigValue(
      fieldConfigProperty.isCustom ? config.custom : config,
      fieldConfigProperty.isCustom ? defaults.custom : defaults,
      fieldConfigProperty,
      context
    );
  }

  validateFieldConfig(config);
}

function processFieldConfigValue(
  destination: Record<string, unknown>, // it's mutable
  source: Record<string, unknown>,
  fieldConfigProperty: FieldConfigPropertyItem,
  context: FieldOverrideEnv
) {
  const currentConfig = get(destination, fieldConfigProperty.path);
  if (currentConfig === null || currentConfig === undefined) {
    const item = context.fieldConfigRegistry.getIfExists(fieldConfigProperty.id);
    if (!item) {
      return;
    }

    if (item && item.shouldApply(context.field!)) {
      const val = item.process(get(source, item.path), context, item.settings);
      if (val !== undefined && val !== null) {
        set(destination, item.path, val);
      }
    }
  }
}

/**
 * This checks that all options on FieldConfig make sense.  It mutates any value that needs
 * fixed.  In particular this makes sure that the first threshold value is -Infinity (not valid in JSON)
 */
export function validateFieldConfig(config: FieldConfig) {
  const { thresholds } = config;

  if (!config.color) {
    if (thresholds) {
      config.color = {
        mode: FieldColorModeId.Thresholds,
      };
    }
    // No Color settings
  } else if (!config.color.mode) {
    // Without a mode, skip color altogether
    delete config.color;
  }

  // Verify that max > min (swap if necessary)
  if (config.hasOwnProperty('min') && config.hasOwnProperty('max') && config.min! > config.max!) {
    const tmp = config.max;
    config.max = config.min;
    config.min = tmp;
  }
}

const defaultInternalLinkPostProcessor: DataLinkPostProcessor = (options) => {
  // For internal links at the moment only destination is Explore.
  const { link, linkModel, dataLinkScopedVars, field, replaceVariables } = options;

  if (link.internal) {
    return mapInternalLinkToExplore({
      link,
      internalLink: link.internal,
      scopedVars: dataLinkScopedVars,
      field,
      range: link.internal.range,
      replaceVariables,
    });
  } else {
    return linkModel;
  }
};

export const getLinksSupplier =
  (
    frame: DataFrame,
    field: Field,
    fieldScopedVars: ScopedVars,
    replaceVariables: InterpolateFunction,
    timeZone?: TimeZone,
    dataLinkPostProcessor?: DataLinkPostProcessor
  ) =>
  (config: ValueLinkConfig): Array<LinkModel<Field>> => {
    if (!field.config.links || field.config.links.length === 0) {
      return [];
    }

    const linkModels = field.config.links.map((link: DataLink) => {
      const dataContext: DataContextScopedVar = getFieldDataContextClone(frame, field, fieldScopedVars);
      const dataLinkScopedVars = {
        ...fieldScopedVars,
        __dataContext: dataContext,
      };

      const boundReplaceVariables: InterpolateFunction = (value, scopedVars, format) =>
        replaceVariables(value, { ...dataLinkScopedVars, ...scopedVars }, format);

      // We are not displaying reduction result
      if (config.valueRowIndex !== undefined && !isNaN(config.valueRowIndex)) {
        dataContext.value.rowIndex = config.valueRowIndex;
      } else {
        dataContext.value.calculatedValue = config.calculatedValue;
      }

      let linkModel: LinkModel<Field>;

      let href =
        link.onClick || !link.onBuildUrl
          ? link.url
          : link.onBuildUrl({
              origin: field,
              replaceVariables: boundReplaceVariables,
            });

      if (href) {
        href = locationUtil.assureBaseUrl(href.replace(/\n/g, ''));
        href = replaceVariables(href, dataLinkScopedVars, VariableFormatID.UriEncode);
        href = locationUtil.processUrl(href);
      }

      if (link.onClick) {
        linkModel = {
          href,
          title: replaceVariables(link.title || '', dataLinkScopedVars),
          target: link.targetBlank ? '_blank' : undefined,
          onClick: (evt: MouseEvent, origin: Field) => {
            link.onClick!({
              origin: origin ?? field,
              e: evt,
              replaceVariables: boundReplaceVariables,
            });
          },
          origin: field,
          oneClick: link.oneClick ?? false,
        };
      } else {
        linkModel = {
          href,
          title: replaceVariables(link.title || '', dataLinkScopedVars),
          target: link.targetBlank ? '_blank' : undefined,
          origin: field,
          oneClick: link.oneClick ?? false,
        };
      }

      return (dataLinkPostProcessor || defaultInternalLinkPostProcessor)({
        frame,
        field,
        dataLinkScopedVars,
        replaceVariables,
        config,
        link,
        linkModel,
      });
    });

    return linkModels.filter((link): link is LinkModel => !!link);
  };

/**
 * Return a copy of the DataFrame with raw data
 */
export function applyRawFieldOverrides(data: DataFrame[]): DataFrame[] {
  if (!data || data.length === 0) {
    return [];
  }

  const newData = [...data];
  const processor = getRawDisplayProcessor();

  for (let frameIndex = 0; frameIndex < newData.length; frameIndex++) {
    const newFrame = { ...newData[frameIndex] };
    const newFields = [...newFrame.fields];

    for (let fieldIndex = 0; fieldIndex < newFields.length; fieldIndex++) {
      newFields[fieldIndex] = {
        ...newFields[fieldIndex],
        display: processor,
      };
    }

    newData[frameIndex] = {
      ...newFrame,
      fields: newFields,
    };
  }

  return newData;
}

/**
 * @internal
 */
export function useFieldOverrides(
  plugin: PanelPlugin | undefined,
  fieldConfig: FieldConfigSource | undefined,
  data: PanelData | undefined,
  timeZone: string,
  theme: GrafanaTheme2,
  replace: InterpolateFunction,
  dataLinkPostProcessor?: DataLinkPostProcessor
): PanelData | undefined {
  const fieldConfigRegistry = plugin?.fieldConfigRegistry;
  const structureRev = useRef(0);
  const prevSeries = usePrevious(data?.series);

  return useMemo(() => {
    if (!fieldConfigRegistry || !fieldConfig || !data) {
      return;
    }

    const series = data?.series;

    if (
      data.structureRev == null &&
      series &&
      prevSeries &&
      !compareArrayValues(series, prevSeries, compareDataFrameStructures)
    ) {
      structureRev.current++;
    }

    const panelData: PanelData = {
      structureRev: structureRev.current,
      ...data,
      series: applyFieldOverrides({
        data: series,
        fieldConfig,
        fieldConfigRegistry,
        replaceVariables: replace,
        theme,
        timeZone,
        dataLinkPostProcessor,
      }),
    };
    if (data.annotations && data.annotations.length > 0) {
      panelData.annotations = applyFieldOverrides({
        data: data.annotations,
        fieldConfig: {
          defaults: {},
          overrides: [],
        },
        replaceVariables: replace,
        theme,
        timeZone,
        dataLinkPostProcessor,
      });
    }
    return panelData;
  }, [fieldConfigRegistry, fieldConfig, data, prevSeries, timeZone, theme, replace, dataLinkPostProcessor]);
}

/**
 * Clones the existing dataContext or creates a new one
 */
export function getFieldDataContextClone(frame: DataFrame, field: Field, fieldScopedVars: ScopedVars) {
  if (fieldScopedVars?.__dataContext) {
    return {
      value: {
        ...fieldScopedVars.__dataContext.value,
      },
    };
  }

  return { value: { frame, field, data: [frame] } };
}
