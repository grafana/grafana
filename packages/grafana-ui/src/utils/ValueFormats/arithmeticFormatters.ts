import { toFixed } from './valueFormats';

export function toPercent(size: number, decimals: number) {
  if (size === null) {
    return '';
  }
  return toFixed(size, decimals) + '%';
}

export function toPercentUnit(size: number, decimals: number) {
  if (size === null) {
    return '';
  }
  return toFixed(100 * size, decimals) + '%';
}

export function toHex0x(value: number, decimals: number) {
  if (value == null) {
    return '';
  }
  const hexString = toHex(value, decimals);
  if (hexString.substring(0, 1) === '-') {
    return '-0x' + hexString.substring(1);
  }
  return '0x' + hexString;
}

export function toHex(value: number, decimals: number) {
  if (value == null) {
    return '';
  }
  return parseFloat(toFixed(value, decimals))
    .toString(16)
    .toUpperCase();
}

export function sci(value: number, decimals: number) {
  if (value == null) {
    return '';
  }
  return value.toExponential(decimals);
}
