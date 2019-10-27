import { GraphSeriesXY } from '@grafana/data';

export const findHoverIndexFromData = (posX: number, series: GraphSeriesXY) => {
  let lower = 0;
  let upper = series.data.length - 1;
  let middle;
  while (true) {
    if (lower > upper) {
      return Math.max(upper, 0);
    }
    middle = Math.floor((lower + upper) / 2);
    const xPosition = series.data[middle][0];

    if (xPosition === posX) {
      return middle;
    } else if (xPosition && xPosition < posX) {
      lower = middle + 1;
    } else {
      upper = middle - 1;
    }
  }
};
