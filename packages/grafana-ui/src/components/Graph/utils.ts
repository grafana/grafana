import { GraphSeriesXY, GraphSeriesValue } from '@grafana/data';

/**
 * Returns index of the closest datapoint BEFORE hover position
 *
 * @param posX
 * @param series
 */
export const findHoverIndexFromData = (series: GraphSeriesXY, xPos: number) => {
  let lower = 0;
  let upper = series.data.length - 1;
  let middle;
  while (true) {
    if (lower > upper) {
      return Math.max(upper, 0);
    }
    middle = Math.floor((lower + upper) / 2);
    const xPosition = series.data[middle][0];

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
  value: GraphSeriesValue;
  time: GraphSeriesValue;
  datapointIndex: number;
  seriesIndex: number;
  label: string;
  color: string;
}

/**
 * Returns information about closest datapoints when hovering over a Graph
 *
 * @param seriesList list of series visible on the Graph
 * @param pos mouse cursor position, based on jQuery.flot position
 */
export const getMultiSeriesGraphHoverInfo = (
  seriesList: GraphSeriesXY[],
  pos: { x: number }
): {
  results: MultiSeriesHoverInfo[];
  time?: GraphSeriesValue;
} => {
  let value, i, series, hoverIndex, hoverDistance, pointTime;

  const results: MultiSeriesHoverInfo[] = [];

  let minDistance, minTime;

  for (i = 0; i < seriesList.length; i++) {
    series = seriesList[i];

    hoverIndex = findHoverIndexFromData(series, pos.x);
    // @ts-ignore
    hoverDistance = pos.x - series.data[hoverIndex][0];
    pointTime = series.data[hoverIndex][0];

    // Take the closest point before the cursor, or if it does not exist, the closest after
    if (
      minDistance === undefined ||
      (hoverDistance >= 0 && (hoverDistance < minDistance || minDistance < 0)) ||
      (hoverDistance < 0 && hoverDistance > minDistance)
    ) {
      minDistance = hoverDistance;
      minTime = pointTime;
    }

    value = series.data[hoverIndex][1];

    results.push({
      value,
      datapointIndex: hoverIndex,
      seriesIndex: i,
      color: series.color,
      label: series.label,
      time: pointTime,
    });
  }

  return {
    results,
    time: minTime,
  };
};
