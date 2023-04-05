import { isNumber, set, unset, get, cloneDeep } from 'lodash';
import { useMemo, useRef } from 'react';
import usePrevious from 'react-use/lib/usePrevious';

import { VariableFormatID } from '@grafana/schema';

import { compareArrayValues, compareDataFrameStructures, guessFieldTypeForField } from '../dataframe';
import { PanelPlugin } from '../panel/PanelPlugin';
import { GrafanaTheme2 } from '../themes';
import { asHexString } from '../themes/colorManipulator';
import { fieldMatchers, reduceField, ReducerID } from '../transformations';
import {
  ApplyFieldOverrideOptions,
  DataContextScopedVar,
  DataFrame,
  DataLink,
  DecimalCount,
  DisplayProcessor,
  DisplayValue,
  DynamicConfigValue,
  Field,
  FieldColorModeId,
  FieldConfig,
  FieldConfigPropertyItem,
  FieldConfigSource,
  FieldOverrideContext,
  FieldType,
  InterpolateFunction,
  LinkModel,
  NumericRange,
  PanelData,
  ScopedVars,
  TimeZone,
  ValueLinkConfig,
} from '../types';
import { FieldMatcher } from '../types/transformations';
import { locationUtil } from '../utils';
import { mapInternalLinkToExplore } from '../utils/dataLinks';

import { FieldConfigOptionsRegistry } from './FieldConfigOptionsRegistry';
import { getDisplayProcessor, getRawDisplayProcessor } from './displayProcessor';
import { getFrameDisplayName } from './fieldState';
import { getFieldDisplayValuesProxy } from './getFieldDisplayValuesProxy';
import { standardFieldConfigEditorRegistry } from './standardFieldConfigEditorRegistry';
import { getTemplateProxyForField } from './templateProxies';

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

    const scopedVars: ScopedVars = {
      __series: { text: 'Series', value: { name: getFrameDisplayName(newFrame, index) } }, // might be missing
    };

    for (const field of newFrame.fields) {
      const config = field.config;

      field.state!.scopedVars = {
        ...scopedVars,
        __field: {
          text: 'Field',
          value: getTemplateProxyForField(field, newFrame, options.data),
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
      let range: NumericRange | undefined = undefined;
      if (field.type === FieldType.number) {
        if (!globalRange && (!isNumber(config.min) || !isNumber(config.max))) {
          globalRange = findNumericFieldMinMax(options.data!);
        }
        const min = config.min ?? globalRange!.min;
        const max = config.max ?? globalRange!.max;
        range = { min, max, delta: max! - min! };
      }

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
        options.timeZone
      );
    }

    return newFrame;
  });
}

// this is a significant optimization for streaming, where we currently re-process all values in the buffer on ech update
// via field.display(value). this can potentially be removed once we...
// 1. process data packets incrementally and/if cache the results in the streaming datafame (maybe by buffer index)
// 2. have the ability to selectively get display color or text (but not always both, which are each quite expensive)
// 3. sufficently optimize text formatting and threshold color determinitation
function cachingDisplayProcessor(disp: DisplayProcessor, maxCacheSize = 2500): DisplayProcessor {
  type dispCache = Map<any, DisplayValue>;
  // decimals -> cache mapping, -1 is unspecified decimals
  const caches = new Map<number, dispCache>();

  // pre-init caches for up to 15 decimals
  for (let i = -1; i <= 15; i++) {
    caches.set(i, new Map());
  }

  return (value: any, decimals?: DecimalCount) => {
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

/**
 * Merge the links from the data source config and the panel config
 * @param configLinks coming from the datasource
 * @param defaultLinks coming from the panel config
 * @returns unique merged links
 */

function mergeLinks(configLinks: DataLink[], defaultLinks: DataLink[]) {
  // Combine the config links and the default links
  const combinedLinks = [...configLinks, ...defaultLinks];

  // Deduplicate the combined array of links
  // note: this is necessary to prevent default links from being displayed multiple times
  // as setFieldConfigDefaults is called multiple times for each data frame

  const uniqueLinks = combinedLinks.reduce((accumulator: DataLink[], currentLink) => {
    const existingLink = accumulator.find((link) => JSON.stringify(link) === JSON.stringify(currentLink));
    if (!existingLink) {
      accumulator.push(currentLink);
    }

    return accumulator;
  }, []);

  return uniqueLinks;
}

// config -> from DS
// defaults -> from Panel config
export function setFieldConfigDefaults(config: FieldConfig, defaults: FieldConfig, context: FieldOverrideEnv) {
  for (const fieldConfigProperty of context.fieldConfigRegistry.list()) {
    // For cases where we have links on the datasource config and the panel config, we need to merge them
    if (config.links && defaults.links) {
      config.links = mergeLinks(config.links, defaults.links);
    }

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
  destination: Record<string, any>, // it's mutable
  source: Record<string, any>,
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

export const getLinksSupplier =
  (
    frame: DataFrame,
    field: Field,
    fieldScopedVars: ScopedVars,
    replaceVariables: InterpolateFunction,
    timeZone?: TimeZone
  ) =>
  (config: ValueLinkConfig): Array<LinkModel<Field>> => {
    if (!field.config.links || field.config.links.length === 0) {
      return [];
    }

    return field.config.links.map((link: DataLink) => {
      let dataFrameVars = {};
      let dataContext: DataContextScopedVar = { value: { frame, field } };

      // We are not displaying reduction result
      if (config.valueRowIndex !== undefined && !isNaN(config.valueRowIndex)) {
        dataContext.value.rowIndex = config.valueRowIndex;

        const fieldsProxy = getFieldDisplayValuesProxy({
          frame,
          rowIndex: config.valueRowIndex,
          timeZone: timeZone,
        });

        dataFrameVars = {
          __data: {
            value: {
              name: frame.name,
              refId: frame.refId,
              fields: fieldsProxy,
            },
            text: 'Data',
          },
        };
      } else {
        dataContext.value.calculatedValue = config.calculatedValue;
      }

      const variables: ScopedVars = {
        ...fieldScopedVars,
        ...dataFrameVars,
        __dataContext: dataContext,
      };

      if (link.onClick) {
        return {
          href: link.url,
          title: replaceVariables(link.title || '', variables),
          target: link.targetBlank ? '_blank' : undefined,
          onClick: (evt, origin) => {
            link.onClick!({
              origin: origin ?? field,
              e: evt,
              replaceVariables: (v) => replaceVariables(v, variables),
            });
          },
          origin: field,
        };
      }

      if (link.internal) {
        // For internal links at the moment only destination is Explore.
        return mapInternalLinkToExplore({
          link,
          internalLink: link.internal,
          scopedVars: variables,
          field,
          range: link.internal.range ?? ({} as any),
          replaceVariables,
        });
      }
      let href = link.onBuildUrl
        ? link.onBuildUrl({
            origin: field,
            replaceVariables,
          })
        : link.url;

      if (href) {
        href = locationUtil.assureBaseUrl(href.replace(/\n/g, ''));
        href = replaceVariables(href, variables, VariableFormatID.PercentEncode);
        href = locationUtil.processUrl(href);
      }

      const info: LinkModel<Field> = {
        href,
        title: replaceVariables(link.title || '', variables),
        target: link.targetBlank ? '_blank' : undefined,
        origin: field,
      };
      return info;
    });
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

    return {
      structureRev: structureRev.current,
      ...data,
      series: applyFieldOverrides({
        data: series,
        fieldConfig,
        fieldConfigRegistry,
        replaceVariables: replace,
        theme,
        timeZone,
      }),
    };
  }, [fieldConfigRegistry, fieldConfig, data, prevSeries, timeZone, theme, replace]);
}
