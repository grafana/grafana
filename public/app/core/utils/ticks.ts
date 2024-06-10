/**
 * Calculate tick step.
 * Implementation from d3-array (ticks.js)
 * https://github.com/d3/d3-array/blob/master/src/ticks.js
 * @param start Start value
 * @param stop End value
 * @param count Ticks count
 */
export function tickStep(start: number, stop: number, count: number): number {
  const e10 = Math.sqrt(50),
    e5 = Math.sqrt(10),
    e2 = Math.sqrt(2);

  const step0 = Math.abs(stop - start) / Math.max(0, count);
  let step1 = Math.pow(10, Math.floor(Math.log(step0) / Math.LN10));
  const error = step0 / step1;

  if (error >= e10) {
    step1 *= 10;
  } else if (error >= e5) {
    step1 *= 5;
  } else if (error >= e2) {
    step1 *= 2;
  }

  return stop < start ? -step1 : step1;
}

export function getScaledDecimals(decimals: number, tickSize: number) {
  return decimals - Math.floor(Math.log(tickSize) / Math.LN10);
}

/**
 * Format timestamp similar to Grafana graph panel.
 * @param ticks Number of ticks
 * @param min Time from (in milliseconds)
 * @param max Time to (in milliseconds)
 */
export function grafanaTimeFormat(ticks: number, min: number, max: number) {
  if (min && max && ticks) {
    const range = max - min;
    const secPerTick = range / ticks / 1000;
    const oneDay = 86400000;
    const oneYear = 31536000000;

    if (secPerTick <= 45) {
      return 'HH:mm:ss';
    }
    if (secPerTick <= 7200 || range <= oneDay) {
      return 'HH:mm';
    }
    if (secPerTick <= 80000) {
      return 'MM/DD HH:mm';
    }
    if (secPerTick <= 2419200 || range <= oneYear) {
      return 'MM/DD';
    }
    return 'YYYY-MM';
  }

  return 'HH:mm';
}

/**
 * Logarithm of value for arbitrary base.
 */
export function logp(value: number, base: number) {
  return Math.log(value) / Math.log(base);
}

/**
 * Get decimal precision of number (3.14 => 2)
 */
export function getPrecision(num: number): number {
  const str = num.toString();
  return getStringPrecision(str);
}

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
