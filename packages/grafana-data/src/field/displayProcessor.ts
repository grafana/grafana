// Libraries
import { toString, toNumber as _toNumber, isEmpty, isBoolean, isArray, join } from 'lodash';

// Types
import { getFieldTypeFromValue } from '../dataframe/processDataFrame';
import { toUtc, dateTimeParse } from '../datetime';
import { GrafanaTheme2 } from '../themes/types';
import { KeyValue, TimeZone } from '../types';
import { Field, FieldType } from '../types/dataFrame';
import { DecimalCount, DisplayProcessor, DisplayValue } from '../types/displayValue';
import { anyToNumber } from '../utils/anyToNumber';
import { getValueMappingResult } from '../utils/valueMappings';
import { getValueFormat, isBooleanUnit } from '../valueFormats/valueFormats';

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
      showMs = Math.abs(end - start) < 60; //show ms when minute or less
    }
  } else if (field.type === FieldType.boolean) {
    if (!isBooleanUnit(unit)) {
      unit = 'bool';
    }
  } else if (!unit && field.type === FieldType.string) {
    unit = 'string';
  }

  const formatFunc = getValueFormat(unit || 'none');
  const scaleFunc = getScaleCalculator(field, options.theme);

  return (value: any, decimals?: DecimalCount) => {
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
    }

    if (!isNaN(numeric)) {
      if (text == null && !isBoolean(value)) {
        const v = formatFunc(numeric, decimals ?? config.decimals, null, options.timeZone, showMs);
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

function toStringProcessor(value: any): DisplayValue {
  return { text: toString(value), numeric: anyToNumber(value) };
}

export function getRawDisplayProcessor(): DisplayProcessor {
  return (value: any) => ({
    text: getFieldTypeFromValue(value) === 'other' ? `${JSON.stringify(value, getCircularReplacer())}` : `${value}`,
    numeric: null as unknown as number,
  });
}

const getCircularReplacer = () => {
  const seen = new WeakSet();
  return (_key: any, value: object | null) => {
    if (typeof value === 'object' && value !== null) {
      if (seen.has(value)) {
        return;
      }
      seen.add(value);
    }
    return value;
  };
};
