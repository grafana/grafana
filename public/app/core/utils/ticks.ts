/**
 * Get decimal precision of number stored as a string ("3.14" => 2)
 */
export function getStringPrecision(num: string): number {
  if (isNaN(num as unknown as number)) {
    return 0;
  }

  const dotIndex = num.indexOf('.');
  if (dotIndex === -1) {
    return 0;
  } else {
    return num.length - dotIndex - 1;
  }
}
