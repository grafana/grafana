import { isNumber, set, unset, get, cloneDeep, defaultsDeep } from 'lodash';
import { createContext, useContext, useMemo, useRef } from 'react';
import { usePrevious } from 'react-use';

import { ThresholdsMode, VariableFormatID, type MatcherScope } from '@grafana/schema';

import { NullValueMode } from '../../src/types/data';
import { compareArrayValues, compareDataFrameStructures } from '../dataframe/frameComparisons';
import { createDataFrame, guessFieldTypeForField } from '../dataframe/processDataFrame';
import { type PanelPlugin } from '../panel/PanelPlugin';
import { asHexString } from '../themes/colorManipulator';
import { type GrafanaTheme2 } from '../themes/types';
import { fieldMatchers } from '../transformations/matchers';
import { type ScopedVars, type DataContextScopedVar } from '../types/ScopedVars';
import {
  type DataFrame,
  type NumericRange,
  FieldType,
  type Field,
  type ValueLinkConfig,
  type FieldConfig,
} from '../types/dataFrame';
import { type LinkModel, type DataLink } from '../types/dataLink';
import { type DisplayProcessor, type DisplayValue, type DecimalCount } from '../types/displayValue';
import { FieldColorModeId } from '../types/fieldColor';
import {
  type DynamicConfigValue,
  type ApplyFieldOverrideOptions,
  type FieldOverrideContext,
  type DataLinkPostProcessor,
  type FieldConfigSource,
} from '../types/fieldOverrides';
import { type InterpolateFunction, type PanelData } from '../types/panel';
import { type TimeZone } from '../types/time';
import { type FieldMatcher } from '../types/transformations';
import { mapInternalLinkToExplore } from '../utils/dataLinks';
import { locationUtil } from '../utils/location';

import { type FieldConfigOptionsRegistry } from './FieldConfigOptionsRegistry';
import { getDisplayProcessor, getRawDisplayProcessor } from './displayProcessor';
import { getMinMaxAndDelta } from './scale';
import { standardFieldConfigEditorRegistry } from './standardFieldConfigEditorRegistry';

interface OverrideProps {
  match: FieldMatcher;
  properties: DynamicConfigValue[];
}

export function findNumericFieldMinMax(data: DataFrame[]): NumericRange {
  let min: number | null = Infinity;
  let max: number | null = -Infinity;

  for (const frame of data) {
    for (const field of frame.fields) {
      if (field.type === FieldType.number) {
        const nullAsZero = field.config.nullValueMode === NullValueMode.AsZero;
        const vals = field.values;

        for (let i = 0; i < vals.length; i++) {
          let v = vals[i];

          if (v === null) {
            if (nullAsZero) {
              if (min! > 0) {
                min = 0;
              }
              if (max! < 0) {
                max = 0;
              }
            }
          } else if (!Number.isNaN(v)) {
            if (min! > v) {
              min = v;
            }
            if (max! < v) {
              max = v;
            }
          }
        }
      }
    }
  }

  if (min === Infinity) {
    min = null;
  }

  if (max === -Infinity) {
    max = null;
  }

  return { min, max, delta: (max ?? 0) - (min ?? 0) };
}

/**
 * Return a copy of the DataFrame with all rules applied
 */
export function applyFieldOverrides(
  options: ApplyFieldOverrideOptions,
  data: DataFrame[] | undefined = options.data,
  scope: MatcherScope = 'series'
): DataFrame[] {
  if (!data) {
    return [];
  }

  const source = options.fieldConfig;
  if (!source) {
    return data;
  }

  const fieldConfigRegistry = options.fieldConfigRegistry ?? standardFieldConfigEditorRegistry;

  let seriesIndex = 0;
  let globalRange: NumericRange | undefined = undefined;

  // Prepare the Matchers
  const override: OverrideProps[] = [];
  if (source.overrides) {
    for (const rule of source.overrides) {
      if ((rule.matcher.scope ?? 'series') !== scope) {
        continue;
      }
      const info = fieldMatchers.getIfExists(rule.matcher.id);

      if (!info) {
        console.warn(`Unknown field matcher id: "${rule.matcher.id}", skipping override rule`);
        continue;
      }

      override.push({
        match: info.get(rule.matcher.options),
        properties: rule.properties,
      });
    }
  }

  const result: DataFrame[] = Array(data.length);
  for (let index = 0; index < data.length; index++) {
    const originalFrame = data[index];
    // Need to define this new frame here as it's passed to the getLinkSupplier function inside the fields loop
    const newFrame = (result[index] = { ...originalFrame });

    // start by making a copy. looping twice is currently unavoidable, as methods downstream (like the displayName
    // uniqueness check) depend on clone already being present in the fields array.
    const newFields = Array(newFrame.fields.length);
    for (let i = 0; i < newFrame.fields.length; i++) {
      const originalField = newFrame.fields[i];
      newFields[i] = {
        ...originalField,
        config: cloneDeep(originalField.config),
        state: {
          ...originalField.state,
        },
      };
    }
    newFrame.fields = newFields;

    // now that the frame has the new fields, we can mutate the fields in place.
    for (const field of newFrame.fields) {
      const config = field.config;

      field.state!.scopedVars = {
        __dataContext: {
          value: {
            data,
            frame: newFrame,
            frameIndex: index,
            field,
          },
        },
      };

      const context = {
        field,
        data,
        dataFrameIndex: index,
        replaceVariables: options.replaceVariables,
        fieldConfigRegistry: fieldConfigRegistry,
      };

      // Anything in the field config that's not set by the datasource
      // will be filled in by panel's field configuration
      setFieldConfigDefaults(config, source.defaults, context);

      // Find any matching rules and then override
      for (const rule of override) {
        if (rule.match(field, newFrame, data)) {
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
      const { range, newGlobalRange } = calculateRange(config, field, globalRange, data);
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
        const newValues: DataFrame[][] = Array(field.values.length);
        for (let idx = 0; idx < field.values.length; idx++) {
          const nestedFrames: DataFrame[] = field.values[idx];
          for (let nfIndex = 0; nfIndex < nestedFrames.length; nfIndex++) {
            const nestedFrame = nestedFrames[nfIndex];
            for (const valueField of nestedFrame.fields) {
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
                      frame: nestedFrame,
                      frameIndex: nfIndex,
                      field: valueField,
                    },
                  },
                },
              };

              valueField.getLinks = getLinksSupplier(
                nestedFrame,
                valueField,
                valueField.state?.scopedVars ?? {},
                context.replaceVariables,
                options.timeZone,
                options.dataLinkPostProcessor
              );
            }
          }
          newValues[idx] = applyFieldOverrides(options, nestedFrames, 'nested');
        }
        field.values = newValues;
      } else if (field.type === FieldType.frame) {
        const newValues: DataFrame[] = Array(field.values.length);
        for (let idx = 0; idx < field.values.length; idx++) {
          const nestedFrame: DataFrame = field.values[idx] ?? createDataFrame({ fields: [] });
          for (let fieldIndex = 0; fieldIndex < nestedFrame.fields.length; fieldIndex++) {
            const valueField = nestedFrame.fields[fieldIndex];
            valueField.config = defaultsDeep(valueField.config || {}, config);
          }
          newValues[idx] = nestedFrame;
        }
        // @todo should this be scoped?
        field.values = applyFieldOverrides(options, newValues);
      }
    }
  }

  return result;
}

function calculateRange(
  config: FieldConfig,
  field: Field,
  globalRange: NumericRange | undefined,
  data: DataFrame[]
): { range?: NumericRange; newGlobalRange?: NumericRange } {
  // If range is defined with min/max, use it
  if (isNumber(config.min) && isNumber(config.max)) {
    const range = { min: config.min, max: config.max, delta: config.max - config.min };
    return { range, newGlobalRange: globalRange ?? range };
  }

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

// decimals -> cache mapping, -1 is unspecified decimals. pre-init caches for up to 15 decimals
type DecimalsCache = Map<unknown, DisplayValue>;

// this is a significant optimization for streaming, where we currently re-process all values in the buffer on ech update
// via field.display(value). this can potentially be removed once we...
// 1. process data packets incrementally and/if cache the results in the streaming datafame (maybe by buffer index)
// 2. have the ability to selectively get display color or text (but not always both, which are each quite expensive)
// 3. sufficently optimize text formatting and threshold color determinitation
function cachingDisplayProcessor(disp: DisplayProcessor, maxCacheSize = 2500): DisplayProcessor {
  let caches: Map<number, DecimalsCache>;
  return (value: unknown, decimals?: DecimalCount) => {
    // pre-allocating these maps is quite expensive, so we do it just-in-time.
    // -1, 0, 1..15 = 17 entries
    caches ??= new Map(Array.from({ length: 17 }, (_, i) => [i - 1, new Map()]));

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

  let val = item.process(value.value, context, item.settings);

  const remove = val === undefined || val === null;

  if (remove) {
    if (item.isCustom && config.custom) {
      unset(config.custom, item.path);
    } else {
      unset(config, item.path);
    }
  } else {
    // Merge arrays (e.g. mappings) when multiple overrides target the same field
    // Override values come first so they take precedence (first match wins in getValueMappingResult)
    if (Array.isArray(val)) {
      const existingValue = item.isCustom ? get(config.custom, item.path) : get(config, item.path);

      if (Array.isArray(existingValue)) {
        val = [...val, ...existingValue];
      }
    }

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
    // Combine the data source links and the panel default config links. mutate rather than allocate new for perf reasons.
    config.links.push(...defaults.links);
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
    config.thresholds.steps.unshift(defaultBaseStep);
  }

  for (const fieldConfigProperty of context.fieldConfigRegistry.list()) {
    let destination = config;
    let source = defaults;
    if (fieldConfigProperty.isCustom) {
      config.custom ??= {};
      destination = config.custom;
      source = defaults.custom;
    }

    const currentConfig = get(destination, fieldConfigProperty.path);
    if (currentConfig == null) {
      const item = context.fieldConfigRegistry.getIfExists(fieldConfigProperty.id);
      if (!item) {
        return;
      }

      if (item.shouldApply(context.field!)) {
        const val = item.process(get(source, item.path), context, item.settings);
        if (val != null) {
          set(destination, item.path, val);
        }
      }
    }
  }

  validateFieldConfig(config);
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
  if (config.min != null && config.max != null && config.min > config.max) {
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

        if (href?.length > 0) {
          href = locationUtil.processUrl(href);
        }
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
  replace: InterpolateFunction
): PanelData | undefined {
  const fieldConfigRegistry = plugin?.fieldConfigRegistry;
  const structureRev = useRef(0);
  const prevSeries = usePrevious(data?.series);

  const { dataLinkPostProcessor } = useDataLinksContext();

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

/**
 * @internal
 */
export const DataLinksContext = createContext<{
  dataLinkPostProcessor: DataLinkPostProcessor;
}>({ dataLinkPostProcessor: defaultInternalLinkPostProcessor });

/**
 * @internal
 */
export const useDataLinksContext = () => useContext(DataLinksContext);
