import { toFixed, FormattedValue } from './valueFormats';
import { DecimalCount } from '../types/displayValue';

export function toPercent(size: number, decimals: DecimalCount): FormattedValue {
  if (size === null) {
    return { prefix: '', value: '', suffix: '' };
  }
  return { prefix: '', value: toFixed(size, decimals), suffix: '%' };
}

export function toPercentUnit(size: number, decimals: DecimalCount): FormattedValue {
  if (size === null) {
    return { prefix: '', value: '', suffix: '' };
  }
  return { prefix: '', value: toFixed(100 * size, decimals), suffix: '%' };
}

export function toHex0x(value: number, decimals: DecimalCount): FormattedValue {
  if (value == null) {
    return { prefix: '', value: '', suffix: '' };
  }
  const asHex = toHex(value, decimals);
  if (asHex.value.substring(0, 1) === '-') {
    asHex.value = '-0x' + asHex.value.substring(1);
  } else {
    asHex.value = '0x' + asHex.value;
  }
  return asHex;
}

export function toHex(value: number, decimals: DecimalCount): FormattedValue {
  if (value == null) {
    return { prefix: '', value: '', suffix: '' };
  }
  return {
    prefix: '',
    value: parseFloat(toFixed(value, decimals))
      .toString(16)
      .toUpperCase(),
    suffix: '',
  };
}

export function sci(value: number, decimals: DecimalCount): FormattedValue {
  if (value == null) {
    return { prefix: '', value: '', suffix: '' };
  }
  return { value: value.toExponential(decimals as number), prefix: '', suffix: '' };
}
