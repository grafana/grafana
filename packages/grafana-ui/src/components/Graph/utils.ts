import {
  GraphSeriesValue,
  Field,
  formattedValueToString,
  getFieldDisplayName,
  TimeZone,
  dateTimeFormat,
  systemDateFormats,
} from '@grafana/data';

/**
 * Returns index of the closest datapoint BEFORE hover position
 *
 * @param posX
 * @param series
 */
export const findHoverIndexFromData = (xAxisDimension: Field, xPos: number) => {
  let lower = 0;
  let upper = xAxisDimension.values.length - 1;
  let middle;

  while (true) {
    if (lower > upper) {
      return Math.max(upper, 0);
    }
    middle = Math.floor((lower + upper) / 2);
    const xPosition = xAxisDimension.values[middle];

    if (xPosition === xPos) {
      return middle;
    } else if (xPosition && xPosition < xPos) {
      lower = middle + 1;
    } else {
      upper = middle - 1;
    }
  }
};

interface MultiSeriesHoverInfo {
  value: string;
  time: string;
  datapointIndex: number;
  seriesIndex: number;
  label?: string;
  color?: string;
}

/**
 * Returns information about closest datapoints when hovering over a Graph
 *
 * @param seriesList list of series visible on the Graph
 * @param pos mouse cursor position, based on jQuery.flot position
 */
export const getMultiSeriesGraphHoverInfo = (
  // x and y axis dimensions order is aligned
  yAxisDimensions: Field[],
  xAxisDimensions: Field[],
  /** Well, time basically */
  xAxisPosition: number,
  timeZone?: TimeZone
): {
  results: MultiSeriesHoverInfo[];
  time?: GraphSeriesValue;
} => {
  let i, field, hoverIndex, hoverDistance, pointTime;

  const results: MultiSeriesHoverInfo[] = [];

  let minDistance, minTime;

  for (i = 0; i < yAxisDimensions.length; i++) {
    field = yAxisDimensions[i];
    const time = xAxisDimensions[i];
    hoverIndex = findHoverIndexFromData(time, xAxisPosition);
    hoverDistance = xAxisPosition - time.values[hoverIndex];
    pointTime = time.values[hoverIndex];
    // Take the closest point before the cursor, or if it does not exist, the closest after
    if (
      minDistance === undefined ||
      (hoverDistance >= 0 && (hoverDistance < minDistance || minDistance < 0)) ||
      (hoverDistance < 0 && hoverDistance > minDistance)
    ) {
      minDistance = hoverDistance;
      minTime = time.display ? formattedValueToString(time.display(pointTime)) : pointTime;
    }

    const disp = field.display!(field.values[hoverIndex]);

    results.push({
      value: formattedValueToString(disp),
      datapointIndex: hoverIndex,
      seriesIndex: i,
      color: disp.color,
      label: getFieldDisplayName(field),
      time: time.display ? formattedValueToString(time.display(pointTime)) : pointTime,
    });
  }

  return {
    results,
    time: minTime,
  };
};

export const graphTickFormatter = (epoch: number, axis: any) => {
  return dateTimeFormat(epoch, {
    format: axis?.options?.timeformat,
    timeZone: axis?.options?.timezone,
  });
};

export const graphTimeFormat = (ticks: number | null, min: number | null, max: number | null): string => {
  if (min && max && ticks) {
    const range = max - min;
    const secPerTick = range / ticks / 1000;
    // Need have 10 millisecond margin on the day range
    // As sometimes last 24 hour dashboard evaluates to more than 86400000
    const oneDay = 86400010;
    const oneYear = 31536000000;

    if (secPerTick <= 10) {
      return systemDateFormats.interval.millisecond;
    }
    if (secPerTick <= 45) {
      return systemDateFormats.interval.second;
    }
    if (range <= oneDay) {
      return systemDateFormats.interval.minute;
    }
    if (secPerTick <= 80000) {
      return systemDateFormats.interval.hour;
    }
    if (range <= oneYear) {
      return systemDateFormats.interval.day;
    }
    if (secPerTick <= 31536000) {
      return systemDateFormats.interval.month;
    }
    return systemDateFormats.interval.year;
  }

  return systemDateFormats.interval.minute;
};
