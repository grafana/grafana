import {
  ApplyFieldOverrideOptions,
  DataFrame,
  DataLink,
  DataSourceInstanceSettings,
  DynamicConfigValue,
  Field,
  FieldColorModeId,
  FieldConfig,
  FieldConfigPropertyItem,
  FieldOverrideContext,
  FieldType,
  GrafanaTheme,
  InterpolateFunction,
  LinkModel,
  ScopedVars,
  TimeZone,
  ValueLinkConfig,
} from '../types';
import { fieldMatchers, reduceField, ReducerID } from '../transformations';
import { FieldMatcher } from '../types/transformations';
import isNumber from 'lodash/isNumber';
import set from 'lodash/set';
import unset from 'lodash/unset';
import get from 'lodash/get';
import { getDisplayProcessor, getRawDisplayProcessor } from './displayProcessor';
import { guessFieldTypeForField } from '../dataframe';
import { standardFieldConfigEditorRegistry } from './standardFieldConfigEditorRegistry';
import { FieldConfigOptionsRegistry } from './FieldConfigOptionsRegistry';
import { DataLinkBuiltInVars, locationUtil } from '../utils';
import { formattedValueToString } from '../valueFormats';
import { getFieldDisplayValuesProxy } from './getFieldDisplayValuesProxy';
import { getFieldDisplayName, getFrameDisplayName } from './fieldState';
import { getTimeField } from '../dataframe/processDataFrame';
import { mapInternalLinkToExplore } from '../utils/dataLinks';
import { getTemplateProxyForField } from './templateProxies';

interface OverrideProps {
  match: FieldMatcher;
  properties: DynamicConfigValue[];
}

interface GlobalMinMax {
  min: number;
  max: number;
}

export function findNumericFieldMinMax(data: DataFrame[]): GlobalMinMax {
  let min = Number.MAX_VALUE;
  let max = Number.MIN_VALUE;

  const reducers = [ReducerID.min, ReducerID.max];

  for (const frame of data) {
    for (const field of frame.fields) {
      if (field.type === FieldType.number) {
        const stats = reduceField({ field, reducers });
        if (stats[ReducerID.min] < min) {
          min = stats[ReducerID.min];
        }
        if (stats[ReducerID.max] > max) {
          max = stats[ReducerID.max];
        }
      }
    }
  }

  return { min, max };
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
  let range: GlobalMinMax | undefined = undefined;

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

  return options.data.map((frame, index) => {
    // Need to define this new frame here as it's passed to the getLinkSupplier function inside the fields loop
    const newFrame: DataFrame = { ...frame };

    const scopedVars: ScopedVars = {
      __series: { text: 'Series', value: { name: getFrameDisplayName(frame, index) } }, // might be missing
    };

    const fields: Field[] = frame.fields.map(field => {
      // Config is mutable within this scope
      const fieldScopedVars = { ...scopedVars };
      const displayName = getFieldDisplayName(field, frame, options.data);

      fieldScopedVars['__field'] = {
        text: 'Field',
        value: getTemplateProxyForField(field, frame, options.data),
      };

      field.state = {
        ...field.state,
        scopedVars: fieldScopedVars,
        displayName,
      };

      const config: FieldConfig = { ...field.config };
      const context = {
        field,
        data: options.data!,
        dataFrameIndex: index,
        replaceVariables: options.replaceVariables,
        getDataSourceSettingsByUid: options.getDataSourceSettingsByUid,
        fieldConfigRegistry: fieldConfigRegistry,
      };

      // Anything in the field config that's not set by the datasource
      // will be filled in by panel's field configuration
      setFieldConfigDefaults(config, source.defaults, context);
      // Find any matching rules and then override
      for (const rule of override) {
        if (rule.match(field, frame, options.data!)) {
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

      // Some units have an implied range
      if (config.unit === 'percent') {
        if (!isNumber(config.min)) {
          config.min = 0;
        }
        if (!isNumber(config.max)) {
          config.max = 100;
        }
      } else if (config.unit === 'percentunit') {
        if (!isNumber(config.min)) {
          config.min = 0;
        }
        if (!isNumber(config.max)) {
          config.max = 1;
        }
      }

      // Set the Min/Max value automatically
      if (options.autoMinMax && field.type === FieldType.number) {
        if (!isNumber(config.min) || !isNumber(config.max)) {
          if (!range) {
            range = findNumericFieldMinMax(options.data!); // Global value
          }
          if (!isNumber(config.min)) {
            config.min = range.min;
          }
          if (!isNumber(config.max)) {
            config.max = range.max;
          }
        }
      }

      // Some color modes needs series index to assign field color so we count
      // up series index here but ignore time fields
      if (field.type !== FieldType.time) {
        seriesIndex++;
      }

      // Overwrite the configs
      const newField: Field = {
        ...field,
        config,
        type,
        state: {
          ...field.state,
          displayName: null,
          seriesIndex,
        },
      };

      // and set the display processor using it
      newField.display = getDisplayProcessor({
        field: newField,
        theme: options.theme,
        timeZone: options.timeZone,
      });

      // Attach data links supplier
      newField.getLinks = getLinksSupplier(
        newFrame,
        newField,
        fieldScopedVars,
        context.replaceVariables,
        context.getDataSourceSettingsByUid,
        {
          theme: options.theme,
          timeZone: options.timeZone,
        }
      );

      return newField;
    });

    newFrame.fields = fields;
    return newFrame;
  });
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

const processFieldConfigValue = (
  destination: Record<string, any>, // it's mutable
  source: Record<string, any>,
  fieldConfigProperty: FieldConfigPropertyItem,
  context: FieldOverrideEnv
) => {
  const currentConfig = get(destination, fieldConfigProperty.path);
  if (currentConfig === null || currentConfig === undefined) {
    const item = context.fieldConfigRegistry.getIfExists(fieldConfigProperty.id);
    // console.log(item);
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
};

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

export const getLinksSupplier = (
  frame: DataFrame,
  field: Field,
  fieldScopedVars: ScopedVars,
  replaceVariables: InterpolateFunction,
  getDataSourceSettingsByUid: (uid: string) => DataSourceInstanceSettings | undefined,
  options: {
    theme: GrafanaTheme;
    timeZone?: TimeZone;
  }
) => (config: ValueLinkConfig): Array<LinkModel<Field>> => {
  if (!field.config.links || field.config.links.length === 0) {
    return [];
  }
  const timeRangeUrl = locationUtil.getTimeRangeUrlParams();
  const { timeField } = getTimeField(frame);

  return field.config.links.map((link: DataLink) => {
    const variablesQuery = locationUtil.getVariablesUrlParams();
    let dataFrameVars = {};
    let valueVars = {};

    // We are not displaying reduction result
    if (config.valueRowIndex !== undefined && !isNaN(config.valueRowIndex)) {
      const fieldsProxy = getFieldDisplayValuesProxy(frame, config.valueRowIndex, options);
      valueVars = {
        raw: field.values.get(config.valueRowIndex),
        numeric: fieldsProxy[field.name].numeric,
        text: fieldsProxy[field.name].text,
        time: timeField ? timeField.values.get(config.valueRowIndex) : undefined,
      };
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
      if (config.calculatedValue) {
        valueVars = {
          raw: config.calculatedValue.numeric,
          numeric: config.calculatedValue.numeric,
          text: formattedValueToString(config.calculatedValue),
        };
      }
    }

    const variables = {
      ...fieldScopedVars,
      __value: {
        text: 'Value',
        value: valueVars,
      },
      ...dataFrameVars,
      [DataLinkBuiltInVars.keepTime]: {
        text: timeRangeUrl,
        value: timeRangeUrl,
      },
      [DataLinkBuiltInVars.includeVars]: {
        text: variablesQuery,
        value: variablesQuery,
      },
    };

    if (link.internal) {
      // For internal links at the moment only destination is Explore.
      return mapInternalLinkToExplore(link, variables, {} as any, field, {
        replaceVariables,
        getDataSourceSettingsByUid,
      });
    } else {
      let href = locationUtil.assureBaseUrl(link.url.replace(/\n/g, ''));
      href = replaceVariables(href, variables);
      href = locationUtil.processUrl(href);

      const info: LinkModel<Field> = {
        href,
        title: replaceVariables(link.title || '', variables),
        target: link.targetBlank ? '_blank' : undefined,
        origin: field,
      };

      return info;
    }
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
