// Libraries
import { toString, toNumber as _toNumber, isEmpty, isBoolean, isArray, join } from 'lodash';

// Types
import { getFieldTypeFromValue } from '../dataframe/processDataFrame';
import { toUtc } from '../datetime/moment_wrapper';
import { dateTimeParse } from '../datetime/parser';
import { GrafanaTheme2 } from '../themes/types';
import { KeyValue } from '../types/data';
import { Field, FieldType } from '../types/dataFrame';
import { DecimalCount, DisplayProcessor, DisplayValue } from '../types/displayValue';
import { TimeZone } from '../types/time';
import { anyToNumber } from '../utils/anyToNumber';
import { getValueMappingResult } from '../utils/valueMappings';
import { FormattedValue, getValueFormat, isBooleanUnit } from '../valueFormats/valueFormats';

import { getScaleCalculator } from './scale';

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
  const { palette } = options.theme.visualization;

  let unit = config.unit;
  let hasDateUnit = unit && (timeFormats[unit] || unit.startsWith('time:'));
  let showMs = false;

  if (field.type === FieldType.time && !hasDateUnit) {
    unit = `dateTimeAsSystem`;
    hasDateUnit = true;
    if (field.values && field.values.length > 1) {
      let start = field.values[0];
      let end = field.values[field.values.length - 1];
      if (typeof start === 'string') {
        start = dateTimeParse(start).unix();
        end = dateTimeParse(end).unix();
      } else {
        start /= 1e3;
        end /= 1e3;
      }
      showMs = Math.abs(end - start) < 60; //show ms when minute or less
    }
  } else if (field.type === FieldType.boolean) {
    if (!isBooleanUnit(unit)) {
      unit = 'bool';
    }
  } else if (!unit && field.type === FieldType.string) {
    unit = 'string';
  }

  const hasCurrencyUnit = unit?.startsWith('currency');
  const hasBoolUnit = isBooleanUnit(unit);
  const isNumType = field.type === FieldType.number;
  const isLocaleFormat = unit === 'locale';
  const canTrimTrailingDecimalZeros =
    !hasDateUnit && !hasCurrencyUnit && !hasBoolUnit && !isLocaleFormat && isNumType && config.decimals == null;

  const formatFunc = getValueFormat(unit || 'none');
  const scaleFunc = getScaleCalculator(field, options.theme);

  return (value: unknown, adjacentDecimals?: DecimalCount) => {
    const { mappings } = config;
    const isStringUnit = unit === 'string';

    if (hasDateUnit && typeof value === 'string') {
      value = toUtc(value).valueOf();
    }

    let numeric = isStringUnit ? NaN : anyToNumber(value);
    let text: string | undefined;
    let prefix: string | undefined;
    let suffix: string | undefined;
    let color: string | undefined;
    let icon: string | undefined;
    let percent: number | undefined;

    if (mappings && mappings.length > 0) {
      const mappingResult = getValueMappingResult(mappings, value);

      if (mappingResult) {
        if (mappingResult.text != null) {
          text = mappingResult.text;
        }

        if (mappingResult.color != null) {
          color = options.theme.visualization.getColorByName(mappingResult.color);
        }

        if (mappingResult.icon != null) {
          icon = mappingResult.icon;
        }
      }
    } else if (field.type === FieldType.enum) {
      // Apply enum display handling if field is enum type and no mappings are specified
      if (value == null) {
        return {
          text: '',
          numeric: NaN,
        };
      }

      const enumIndex = +value;
      if (config && config.type && config.type.enum) {
        const { text: enumText, color: enumColor } = config.type.enum;

        text = enumText ? enumText[enumIndex] : `${value}`;
        // If no color specified in enum field config we will fallback to iterating through the theme palette
        color = enumColor ? enumColor[enumIndex] : undefined;

        if (color == null) {
          const namedColor = palette[enumIndex % palette.length];
          color = options.theme.visualization.getColorByName(namedColor);
        }
      }
    }

    if (!Number.isNaN(numeric)) {
      if (text == null && !isBoolean(value)) {
        let v: FormattedValue;

        if (canTrimTrailingDecimalZeros && adjacentDecimals != null) {
          v = formatFunc(numeric, adjacentDecimals, null, options.timeZone, showMs);

          // if no explicit decimals config, we strip trailing zeros e.g. 60.00 -> 60
          // this is needed because we may have determined the minimum determined `adjacentDecimals` for y tick increments based on
          // e.g. 'seconds' field unit (0.15s, 0.20s, 0.25s), but then formatFunc decided to return milli or nanos (150, 200, 250)
          // so we end up with excess precision: 150.00, 200.00, 250.00
          v.text = +v.text + '';
        } else {
          v = formatFunc(numeric, config.decimals, null, options.timeZone, showMs);
        }

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

    if (text == null && isArray(value)) {
      text = join(value, ', ');
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

    const display: DisplayValue = {
      text,
      numeric,
      prefix,
      suffix,
      color,
    };

    if (icon != null) {
      display.icon = icon;
    }

    if (percent != null) {
      display.percent = percent;
    }

    return display;
  };
}

function toStringProcessor(value: unknown): DisplayValue {
  return { text: toString(value), numeric: anyToNumber(value) };
}

export function getRawDisplayProcessor(): DisplayProcessor {
  return (value: unknown) => ({
    text: getFieldTypeFromValue(value) === 'other' ? `${JSON.stringify(value, getCircularReplacer())}` : `${value}`,
    numeric: null as unknown as number,
  });
}

const getCircularReplacer = () => {
  const seen = new WeakSet();
  return (_key: string, value: object | null) => {
    if (typeof value === 'object' && value !== null) {
      if (seen.has(value)) {
        return;
      }
      seen.add(value);
    }
    return value;
  };
};
