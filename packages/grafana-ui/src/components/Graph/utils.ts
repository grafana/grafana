import { GraphSeriesValue, Field } from '@grafana/data';

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
    const xPosition = xAxisDimension.values.get(middle);

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
  xAxisPosition: number
): {
  results: MultiSeriesHoverInfo[];
  time?: GraphSeriesValue;
} => {
  let value, i, series, hoverIndex, hoverDistance, pointTime;

  const results: MultiSeriesHoverInfo[] = [];

  let minDistance, minTime;

  for (i = 0; i < yAxisDimensions.length; i++) {
    series = yAxisDimensions[i];
    const time = xAxisDimensions[i];
    hoverIndex = findHoverIndexFromData(time, xAxisPosition);
    hoverDistance = xAxisPosition - time.values.get(hoverIndex);
    pointTime = time.values.get(hoverIndex);
    // Take the closest point before the cursor, or if it does not exist, the closest after
    if (
      minDistance === undefined ||
      (hoverDistance >= 0 && (hoverDistance < minDistance || minDistance < 0)) ||
      (hoverDistance < 0 && hoverDistance > minDistance)
    ) {
      minDistance = hoverDistance;
      minTime = time.display ? time.display(pointTime).text : pointTime;
    }

    value = series.values.get(hoverIndex);

    results.push({
      value: series.display ? series.display(value).text : value,
      datapointIndex: hoverIndex,
      seriesIndex: i,
      color: series.config.color,
      label: series.name,
      time: time.display ? time.display(pointTime).text : pointTime,
    });
  }

  return {
    results,
    time: minTime,
  };
};
