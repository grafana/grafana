export function isNumeric(num: string | number | true | {} | string[]) {
  return (typeof num === 'number' || (typeof num === 'string' && num.trim() !== '')) && !Number.isNaN(num);
}
