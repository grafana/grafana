// Libraries
import { toString, toNumber as _toNumber, isEmpty, isBoolean } from 'lodash';

// Types
import { DataFrame, Field, FieldType } from '../types/dataFrame';
import { DisplayProcessor, DisplayValue } from '../types/displayValue';
import { getValueFormat, isBooleanUnit } from '../valueFormats/valueFormats';
import { getValueMappingResult } from '../utils/valueMappings';
import { dateTime, dateTimeParse } from '../datetime';
import { FieldColorModeId, KeyValue, TimeZone } from '../types';
import { getScaleCalculator } from './scale';
import { GrafanaTheme2 } from '../themes/types';
import { anyToNumber } from '../utils/anyToNumber';
import { fieldMatchers } from '../transformations/matchers';
import { FieldMatcherID } from '../transformations/matchers/ids';

interface DisplayProcessorOptions {
  field: Partial<Field>;
  /**
   * Will pick browser timezone if not defined
   */
  timeZone?: TimeZone;
  /**
   * Will pick 'dark' if not defined
   */
  theme: GrafanaTheme2;

  /**
   * Used if need to use another field for color
   */
  frame?: DataFrame;
}

// Reasonable units for time
const timeFormats: KeyValue<boolean> = {
  dateTimeAsIso: true,
  dateTimeAsIsoNoDateIfToday: true,
  dateTimeAsUS: true,
  dateTimeAsUSNoDateIfToday: true,
  dateTimeAsLocal: true,
  dateTimeAsLocalNoDateIfToday: true,
  dateTimeFromNow: true,
};

export function getDisplayProcessor(options?: DisplayProcessorOptions): DisplayProcessor {
  if (!options || isEmpty(options) || !options.field) {
    return toStringProcessor;
  }

  const field = options.field as Field;
  const config = field.config ?? {};

  let unit = config.unit;
  let hasDateUnit = unit && (timeFormats[unit] || unit.startsWith('time:'));
  let showMs = false;

  if (field.type === FieldType.time && !hasDateUnit) {
    unit = `dateTimeAsSystem`;
    hasDateUnit = true;
    if (field.values && field.values.length > 1) {
      let start = field.values.get(0);
      let end = field.values.get(field.values.length - 1);
      if (typeof start === 'string') {
        start = dateTimeParse(start).unix();
        end = dateTimeParse(end).unix();
      } else {
        start /= 1e3;
        end /= 1e3;
      }
      showMs = end - start < 60; //show ms when minute or less
    }
  } else if (field.type === FieldType.boolean) {
    if (!isBooleanUnit(unit)) {
      unit = 'bool';
    }
  }

  const formatFunc = getValueFormat(unit || 'none');
  const scaleFunc = getScaleCalculator(field, options.theme);

  let colorFromField: Field | null = null;

  // Special logic if color is derived from another field we need to use another fields display processor
  if (field.config.color?.mode === FieldColorModeId.Field) {
    const fromFieldName = field.config.color.fromField;
    if (fromFieldName && options.frame) {
      colorFromField = getFieldToDeriveColorFrom(fromFieldName, options.frame);
    }
  }

  return (value: any, index?: number) => {
    const { mappings } = config;
    const isStringUnit = unit === 'string';

    if (hasDateUnit && typeof value === 'string') {
      value = dateTime(value).valueOf();
    }

    let numeric = isStringUnit ? NaN : anyToNumber(value);
    let text: string | undefined;
    let prefix: string | undefined;
    let suffix: string | undefined;
    let color: string | undefined;
    let percent: number | undefined;

    if (index != null && colorFromField) {
      const display = colorFromField.display!(colorFromField.values.get(index));
      color = display.color;
    }

    if (mappings && mappings.length > 0) {
      const mappingResult = getValueMappingResult(mappings, value);

      if (mappingResult) {
        if (mappingResult.text != null) {
          text = mappingResult.text;
        }

        if (color == null && mappingResult.color != null) {
          color = options.theme.visualization.getColorByName(mappingResult.color);
        }
      }
    }

    if (!isNaN(numeric)) {
      if (text == null && !isBoolean(value)) {
        const v = formatFunc(numeric, config.decimals, null, options.timeZone, showMs);
        text = v.text;
        suffix = v.suffix;
        prefix = v.prefix;
      }

      // Return the value along with scale info
      if (color == null) {
        const scaleResult = scaleFunc(numeric);
        color = scaleResult.color;
        percent = scaleResult.percent;
      }
    }

    if (text == null) {
      text = toString(value);
      if (!text) {
        if (config.noValue) {
          text = config.noValue;
        } else {
          text = ''; // No data?
        }
      }
    }

    if (!color) {
      const scaleResult = scaleFunc(-Infinity);
      color = scaleResult.color;
      percent = scaleResult.percent;
    }

    return { text, numeric, prefix, suffix, color, percent };
  };
}

function toStringProcessor(value: any): DisplayValue {
  return { text: toString(value), numeric: anyToNumber(value) };
}

export function getRawDisplayProcessor(): DisplayProcessor {
  return (value: any) => ({
    text: `${value}`,
    numeric: (null as unknown) as number,
  });
}

function getFieldToDeriveColorFrom(fromField: string, frame: DataFrame): Field | null {
  const matcher = fieldMatchers.get(FieldMatcherID.byName).get(fromField);
  for (const f of frame.fields) {
    if (matcher(f, frame, [frame])) {
      return f;
    }
  }

  return null;
}
