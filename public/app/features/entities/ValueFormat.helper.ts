export function formatLongNumber(value: any): any {
  if (typeof value === 'number') {
    if (value >= 1e9 || -1e9 >= value) {
      return Intl.NumberFormat('en-US').format(Math.round(value / 1e6) / 1e3) + 'G';
    } else if (value >= 1e6 || -1e6 >= value) {
      return Intl.NumberFormat('en-US').format(Math.round(value / 1e3) / 1e3) + 'M';
    }
    if (value >= 9999 || -9999 >= value) {
      return Intl.NumberFormat('en-US').format(Math.round(value) / 1e3) + 'K';
    }
  }
  return value;
}
