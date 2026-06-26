import { DecimalCount } from '../types/displayValue';

import { scaledUnits, ValueFormatter } from './valueFormats';

export function currency(symbol: string, asSuffix?: boolean): ValueFormatter {
  const units = ['', ' тыс.', ' млн.', ' млрд.', ' трлн.'];
  const scaler = scaledUnits(1000, units);
  return (value: number, decimals?: DecimalCount, scaledDecimals?: DecimalCount) => {
    if (value == null) {
      return { text: '' };
    }
    const isNegative = value < 0;
    if (isNegative) {
      value = Math.abs(value);
    }
    const scaled = scaler(value, decimals, scaledDecimals);
    if (asSuffix) {
      scaled.suffix = scaled.suffix !== undefined ? `${scaled.suffix}${symbol}` : undefined;
    } else {
      scaled.prefix = symbol;
    }
    if (isNegative) {
      scaled.prefix = `-${scaled.prefix?.length ? scaled.prefix : ''}`;
    }
    if (symbol === '₽') {
      scaled.text = Number(scaled.text).toLocaleString(undefined, { maximumFractionDigits: decimals ?? undefined })
      scaled.prefix = '';
      scaled.suffix += ' ₽';
    }
    // console.log(scaled.text)
    return scaled;
  };
}

const SI_PREFIXES = ['ф', 'п', 'н', 'мк', 'м', '', 'к', 'М', 'Г', 'Т', 'П', 'Э', 'З', 'И'];
const SI_PREFIXES_SHORT = ['', 'к'];
const SI_BASE_INDEX = SI_PREFIXES.indexOf('');
const SI_BASE_INDEX_SHORT = SI_PREFIXES_SHORT.indexOf('');

export function getOffsetFromSIPrefix(c: string): number {
  const charIndex = SI_PREFIXES.findIndex((prefix) => prefix.normalize('NFKD') === c.normalize('NFKD'));
  return charIndex < 0 ? 0 : charIndex - SI_BASE_INDEX;
}

const BIN_PREFIXES = ['', 'Ки', 'Ми', 'Ги', 'Ти', 'Пи', 'Эи"', 'Зи', 'Йи'];

export function binaryPrefix(unit: string, offset = 0): ValueFormatter {
  const units = BIN_PREFIXES.map((p) => ' ' + p + unit);
  return scaledUnits(1024, units, offset);
}

export function SIPrefix(unit: string, offset = 0, short = false): ValueFormatter {
  const units = short ? SI_PREFIXES_SHORT.map((p) => ' ' + p + unit) : SI_PREFIXES.map((p) => ' ' + p + unit);
  const scaler = scaledUnits(1000, units, short ? SI_BASE_INDEX_SHORT + offset : SI_BASE_INDEX + offset);
  return (value: number, decimals?: DecimalCount, scaledDecimals?: DecimalCount) => {
    if (value == null) {
      return { text: '' };
    }
    const isNegative = value < 0;
    if (isNegative) {
      value = Math.abs(value);
    }
    const scaled = scaler(value, decimals, scaledDecimals);
    scaled.text = Number(scaled.text).toLocaleString(undefined, { maximumFractionDigits: decimals ?? undefined })
    
    // console.log(scaled.text)
    return scaled;
  };
}
