import { FlotPosition } from 'app/types/events';
// import { TimeSeriesVM } from 'app/types';

export function findHoverIndexFromDataPoints(posX, series, last) {
  const ps = series.datapoints.pointsize;
  const initial = last * ps;
  const len = series.datapoints.points.length;
  let j;
  for (j = initial; j < len; j += ps) {
    // Special case of a non stepped line, highlight the very last point just before a null point
    if (
      (!series.lines.steps && series.datapoints.points[initial] != null && series.datapoints.points[j] == null) ||
      //normal case
      series.datapoints.points[j] > posX
    ) {
      return Math.max(j - ps, 0) / ps;
    }
  }
  return j / ps - 1;
}

export function findHoverIndexFromData(posX, series): number {
  let lower = 0;
  let upper = series.data.length - 1;
  let middle;
  while (true) {
    if (lower > upper) {
      return Math.max(upper, 0);
    }
    middle = Math.floor((lower + upper) / 2);
    if (series.data[middle][0] === posX) {
      return middle;
    } else if (series.data[middle][0] < posX) {
      lower = middle + 1;
    } else {
      upper = middle - 1;
    }
  }
}

interface GetPlotHoverInfoOptions {
  hideEmpty?: boolean;
  hideZero?: boolean;
  tooltipValueType?: 'individual' | string;
}

export interface PlotHoverInfoItem {
  value: number;
  hidden?: boolean;
  hoverIndex?: number;
  color?: string;
  label?: string;
  time?: number;
  distance?: number;
  index: number;
}

export interface PlotHoverInfo extends Array<PlotHoverInfoItem> {
  time: number;
}

export function getMultiSeriesPlotHoverInfo(
  seriesList: any[],
  pos: FlotPosition,
  options: GetPlotHoverInfoOptions
): PlotHoverInfo {
  let value, i, series, hoverIndex, hoverDistance, pointTime, yaxis;
  // 3 sub-arrays, 1st for hidden series, 2nd for left yaxis, 3rd for right yaxis.
  let results: any = [[], [], []];

  //now we know the current X (j) position for X and Y values
  let lastValue = 0; //needed for stacked values

  let minDistance, minTime;

  for (i = 0; i < seriesList.length; i++) {
    series = seriesList[i];

    if (!series.data.length || (options.hideEmpty && series.allIsNull)) {
      // Init value so that it does not brake series sorting
      results[0].push({ hidden: true, value: 0 });
      continue;
    }

    if (!series.data.length || (options.hideZero && series.allIsZero)) {
      // Init value so that it does not brake series sorting
      results[0].push({ hidden: true, value: 0 });
      continue;
    }

    if (series.hideTooltip) {
      results[0].push({ hidden: true, value: 0 });
      continue;
    }

    hoverIndex = findHoverIndexFromData(pos.x, series);
    hoverDistance = pos.x - series.data[hoverIndex][0];
    pointTime = series.data[hoverIndex][0];

    // Take the closest point before the cursor, or if it does not exist, the closest after
    if (
      !minDistance ||
      (hoverDistance >= 0 && (hoverDistance < minDistance || minDistance < 0)) ||
      (hoverDistance < 0 && hoverDistance > minDistance)
    ) {
      minDistance = hoverDistance;
      minTime = pointTime;
    }

    if (series.stack) {
      if (options.tooltipValueType === 'individual') {
        value = series.data[hoverIndex][1];
      } else if (!series.stack) {
        value = series.data[hoverIndex][1];
      } else {
        lastValue += series.data[hoverIndex][1];
        value = lastValue;
      }
    } else {
      value = series.data[hoverIndex][1];
    }

    // Highlighting multiple Points depending on the plot type
    if (series.lines.steps || series.stack) {
      // stacked and steppedLine plots can have series with different length.
      // Stacked series can increase its length on each new stacked serie if null points found,
      // to speed the index search we begin always on the last found hoverIndex.
      hoverIndex = findHoverIndexFromDataPoints(pos.x, series, hoverIndex);
    }

    // Be sure we have a yaxis so that it does not brake series sorting
    yaxis = 0;
    if (series.yaxis) {
      yaxis = series.yaxis.n || series.yaxis;
    }

    results[yaxis].push({
      value: value,
      hoverIndex: hoverIndex,
      color: series.color,
      label: series.alias,
      time: pointTime,
      distance: hoverDistance,
      index: i,
    });
  }

  // Contat the 3 sub-arrays
  results = results[0].concat(results[1], results[2]);

  // Time of the point closer to pointer
  results.time = minTime;

  return results;
}
