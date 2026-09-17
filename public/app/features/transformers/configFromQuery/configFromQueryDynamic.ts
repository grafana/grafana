import { type DataFrame, type Field, FieldType, getFieldDisplayName } from '@grafana/data';

import { FieldNameMatcherEditor } from '../../../../../packages/grafana-ui/src/components/MatchersUI/FieldNameMatcherEditor';
import {
  type FieldToConfigMapHandler,
  type FieldToConfigMapping,
  finalizeFieldToConfig,
  type HandlerArguments,
  lookUpConfigHandler,
} from '../fieldToConfigMapping/fieldToConfigMapping';

import { type ConfigFromQueryTransformOptions } from './configFromQuery';

// In the case that field name is dynamic, everything suddenly becomes different.
// It's not a DataFrame's field name that is the key, its the value
// This makes the code paths for it both simpler & more complex
//
// For one, we can't cleanly use existing functions - meaning more complex code.
// But using new functions also means we can avoid smashing a square into a circle, so strikes and gutters...

interface DynamicHandler {
  targetProperty: string;
  value: unknown;
  handlerArgs?: HandlerArguments;
  processor: FieldToConfigMapHandler['processor'];
}

function evaluateDynamicFieldMappings(
  frame: DataFrame,
  mappings: FieldToConfigMapping[],
  fieldNameSource: string
): Record<string, DynamicHandler[]> {
  const result: Record<string, DynamicHandler[]> = {};

  const fieldForName = frame.fields.find((f) => f.name === fieldNameSource);
  if (!fieldForName || fieldForName.type !== FieldType.string) {
    throw Error(`Invalid Source Field`);
  }

  const handlers: Array<{
    h: FieldToConfigMapHandler;
    args: HandlerArguments | undefined;
    field: Field;
  }> = [];

  frame.fields.forEach((f) => {
    if (f.name === fieldForName.name) {
      return;
    }
    const fieldName = getFieldDisplayName(f, frame);
    const mapping = mappings.find((m) => m.fieldName === f.name);
    const h = lookUpConfigHandler(mapping?.handlerKey || fieldName.toLowerCase());
    if (!h) {
      // TODO: There should maybe be a way to communicate this weird condition to the user?
      // Perhaps a simple fallback?
      return;
    }

    handlers.push({
      h,
      args: mapping?.handlerArguments,
      field: f,
    });
  });

  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- we just asserted that the field type is a string
  (fieldForName as Field<string>).values.forEach((v, i) => {
    if (result[v]) {
      throw Error(`Config query returned duplicate rows for field '${v}'`);
    }

    result[v] = [];

    handlers.forEach((handlerConfig) => {
      const value = handlerConfig.field.values[i];
      if (value === null || value === undefined) {
        return;
      }

      result[v].push({
        handlerArgs: handlerConfig.args,
        targetProperty: handlerConfig.h.targetProperty ?? handlerConfig.h.key,
        processor: handlerConfig.h.processor,
        value,
      });
    });
  });

  return result;
}

export function extractConfigFromQueryDynamic(
  options: ConfigFromQueryTransformOptions,
  data: DataFrame[],
  configFrame: DataFrame,
  mappings: FieldToConfigMapping[]
): DataFrame[] {
  if (!options.applyTo?.options) {
    return data;
  }

  if (data.length === 1) {
    // there is only 1 frame: the config one
    // This cannot be supported, since the config frame cannot be self referential
    throw Error('Dynamic Fields can only work on multiple frames');
  }

  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- we know options is a string, since we know applyTo is the dynamic field name
  const config = evaluateDynamicFieldMappings(configFrame, mappings, options.applyTo!.options as string);

  const output: DataFrame[] = [];

  for (const frame of data) {
    // Skip config frame in output
    if (frame === configFrame) {
      continue;
    }

    const outputFrame: DataFrame = {
      ...frame,
      fields: [],
    };

    for (const field of frame.fields) {
      const fieldName = getFieldDisplayName(field, frame);
      if (!config[fieldName]) {
        outputFrame.fields.push(field);
        continue;
      }

      const newConfig: Record<string, unknown> = {};
      const context = {};
      config[fieldName].forEach((h) => {
        const res = h.processor(h.value, newConfig, context, h.handlerArgs || {});
        if (res !== null && res !== undefined) {
          newConfig[h.targetProperty] = res;
        }
      });

      finalizeFieldToConfig(newConfig, context);

      outputFrame.fields.push({
        ...field,
        config: {
          ...field.config,
          ...newConfig,
        },
      });
    }

    output.push(outputFrame);
  }

  return output;
}
