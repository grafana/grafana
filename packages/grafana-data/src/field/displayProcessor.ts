// Libraries
import { toString, toNumber as _toNumber, isEmpty, isBoolean, isArray, join } from 'lodash';

// Types
import { getFieldTypeFromValue } from '../dataframe/guessFieldType';
import { toUtc } from '../datetime/moment_wrapper';
import { dateTimeParse } from '../datetime/parser';
import { type GrafanaTheme2 } from '../themes/types';
import { type KeyValue } from '../types/data';
import { type Field, FieldType } from '../types/dataFrame';
import { type DecimalCount, type DisplayProcessor, type DisplayValue } from '../types/displayValue';
import { type TimeZone } from '../types/time';
import { type FormattedValue } from '../types/valueFormats';
import { type ValueMappingResult } from '../types/valueMapping';
import { anyToNumber } from '../utils/anyToNumber';
import { getValueMappingResult } from '../utils/valueMappings';
import { isBooleanUnit } from '../valueFormats/baseFormatters';
import { getValueFormat } from '../valueFormats/valueFormats';

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
  let hasDateUnit = Boolean(unit && (timeFormats[unit] || unit.startsWith('time:')));
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
  const isStringUnitOuter = unit === 'string';
  const hasMappings = (config.mappings?.length ?? 0) > 0;

  // Single source of truth for a value's color + percent, shared by the full
  // processor and the color-only resolver below. The full processor passes the
  // value mapping it already resolved (for text/icon) so we don't look it up twice;
  // the color-only path resolves its own mapping and discards the percent.
  const resolveColorAndPercent = (
    value: unknown,
    numeric: number,
    mappingResult: ValueMappingResult | null
  ): { color: string | undefined; percent: number | undefined } => {
    let color: string | undefined;
    let percent: number | undefined;

    if (mappingResult?.color != null) {
      color = options.theme.visualization.getColorByName(mappingResult.color);
    } else if (!hasMappings && field.type === FieldType.enum && value != null && config.type?.enum) {
      const enumIndex = +value;
      const { color: enumColor } = config.type.enum;
      color = enumColor ? enumColor[enumIndex] : undefined;

      // If no color specified in enum field config we will fallback to iterating through the theme palette
      if (color == null) {
        color = options.theme.visualization.getColorByName(palette[enumIndex % palette.length]);
      }
    }

    if (!Number.isNaN(numeric) && color == null) {
      ({ color, percent } = scaleFunc(numeric));
    }

    if (!color) {
      ({ color, percent } = scaleFunc(-Infinity));
    }

    return { color, percent };
  };

  const proc: DisplayProcessor = (value: unknown, adjacentDecimals?: DecimalCount): DisplayValue => {
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
    let mappingResult: ValueMappingResult | null = null;

    if (mappings && mappings.length > 0) {
      mappingResult = getValueMappingResult(mappings, value);

      if (mappingResult) {
        if (mappingResult.text != null) {
          text = mappingResult.text;
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
        const { text: enumText } = config.type.enum;

        text = enumText ? enumText[enumIndex] : `${value}`;
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
          // #73795 - some units, like duration formats, return text which cannot be coerced back into a number safely at this point.
          const asNum = +v.text;
          if (!Number.isNaN(asNum)) {
            v.text = asNum + '';
          }
        } else {
          v = formatFunc(numeric, config.decimals, null, options.timeZone, showMs);
        }

        text = v.text;
        suffix = v.suffix;
        prefix = v.prefix;
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

    ({ color, percent } = resolveColorAndPercent(value, numeric, mappingResult));

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

  // Lean color-only resolver: resolves the value mapping itself (we must, because
  // mapping resolution is order-sensitive — a RangeToText/SpecialValue mapping can
  // match before a later ValueToText one — so a precomputed value->color map would
  // diverge) then delegates to the shared color logic, skipping all text/number
  // formatting that callers wanting only a color would otherwise pay for.
  const resolveColor = (value: unknown): string | undefined => {
    if (hasDateUnit && typeof value === 'string') {
      value = toUtc(value).valueOf();
    }

    const numeric = isStringUnitOuter ? NaN : anyToNumber(value);

    let mappingResult: ValueMappingResult | null = null;
    if (hasMappings) {
      mappingResult = getValueMappingResult(config.mappings!, value);
    } else if (field.type === FieldType.enum && value == null) {
      // matches the full processor's enum-null short-circuit (no color)
      return undefined;
    }

    return resolveColorAndPercent(value, numeric, mappingResult).color;
  };

  proc.color = resolveColor;

  // Text-only is currently a thin wrapper over the full processor. A lean text
  // path (skipping scale/color resolution) can follow once needed; today the
  // color path is the one callers pay for unnecessarily.
  proc.text = (value, decimals) => proc(value, decimals).text;

  return proc;
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
