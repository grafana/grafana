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

export function getScaledDecimals(decimals, tickSize) {
  return decimals - Math.floor(Math.log(tickSize) / Math.LN10);
}

/**
 * Calculate tick size based on min and max values, number of ticks and precision.
 * Implementation from Flot.
 * @param min           Axis minimum
 * @param max           Axis maximum
 * @param noTicks       Number of ticks
 * @param tickDecimals  Tick decimal precision
 */
export function getFlotTickSize(min: number, max: number, noTicks: number, tickDecimals: number) {
  const delta = (max - min) / noTicks;
  let dec = -Math.floor(Math.log(delta) / Math.LN10);
  const maxDec = tickDecimals;

  const magn = Math.pow(10, -dec);
  const norm = delta / magn; // norm is between 1.0 and 10.0
  let size;

  if (norm < 1.5) {
    size = 1;
  } else if (norm < 3) {
    size = 2;
    // special case for 2.5, requires an extra decimal
    if (norm > 2.25 && (maxDec == null || dec + 1 <= maxDec)) {
      size = 2.5;
      ++dec;
    }
  } else if (norm < 7.5) {
    size = 5;
  } else {
    size = 10;
  }

  size *= magn;

  return size;
}

/**
 * Calculate axis range (min and max).
 * Implementation from Flot.
 */
export function getFlotRange(panelMin, panelMax, datamin, datamax) {
  const autoscaleMargin = 0.02;

  let min = +(panelMin != null ? panelMin : datamin);
  let max = +(panelMax != null ? panelMax : datamax);
  const delta = max - min;

  if (delta === 0.0) {
    // Grafana fix: wide Y min and max using increased wideFactor
    // when all series values are the same
    const wideFactor = 0.25;
    const widen = Math.abs(max === 0 ? 1 : max * wideFactor);

    if (panelMin === null) {
      min -= widen;
    }
    // always widen max if we couldn't widen min to ensure we
    // don't fall into min == max which doesn't work
    if (panelMax == null || panelMin != null) {
      max += widen;
    }
  } else {
    // consider autoscaling
    const margin = autoscaleMargin;
    if (margin != null) {
      if (panelMin == null) {
        min -= delta * margin;
        // make sure we don't go below zero if all values
        // are positive
        if (min < 0 && datamin != null && datamin >= 0) {
          min = 0;
        }
      }
      if (panelMax == null) {
        max += delta * margin;
        if (max > 0 && datamax != null && datamax <= 0) {
          max = 0;
        }
      }
    }
  }
  return { min, max };
}

/**
 * Calculate tick decimals.
 * Implementation from Flot.
 */
export function getFlotTickDecimals(datamin, datamax, axis, height) {
  const { min, max } = getFlotRange(axis.min, axis.max, datamin, datamax);
  const noTicks = 0.3 * Math.sqrt(height);
  const delta = (max - min) / noTicks;
  const dec = -Math.floor(Math.log(delta) / Math.LN10);

  const magn = Math.pow(10, -dec);
  // norm is between 1.0 and 10.0
  const norm = delta / magn;
  let size;

  if (norm < 1.5) {
    size = 1;
  } else if (norm < 3) {
    size = 2;
    // special case for 2.5, requires an extra decimal
    if (norm > 2.25) {
      size = 2.5;
    }
  } else if (norm < 7.5) {
    size = 5;
  } else {
    size = 10;
  }
  size *= magn;

  const tickDecimals = Math.max(0, -Math.floor(Math.log(delta) / Math.LN10) + 1);
  // grafana addition
  const scaledDecimals = tickDecimals - Math.floor(Math.log(size) / Math.LN10);
  return { tickDecimals, scaledDecimals };
}

/**
 * Format timestamp similar to Grafana graph panel.
 * @param ticks Number of ticks
 * @param min Time from (in milliseconds)
 * @param max Time to (in milliseconds)
 */
export function grafanaTimeFormat(ticks, min, max) {
  if (min && max && ticks) {
    const range = max - min;
    const secPerTick = range / ticks / 1000;
    const oneDay = 86400000;
    const oneYear = 31536000000;

    if (secPerTick <= 45) {
      return '%H:%M:%S';
    }
    if (secPerTick <= 7200 || range <= oneDay) {
      return '%H:%M';
    }
    if (secPerTick <= 80000) {
      return '%m/%d %H:%M';
    }
    if (secPerTick <= 2419200 || range <= oneYear) {
      return '%m/%d';
    }
    return '%Y-%m';
  }

  return '%H:%M';
}

/**
 * Logarithm of value for arbitrary base.
 */
export function logp(value, base) {
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
  if (isNaN((num as unknown) as number)) {
    return 0;
  }

  const dotIndex = num.indexOf('.');
  if (dotIndex === -1) {
    return 0;
  } else {
    return num.length - dotIndex - 1;
  }
}
