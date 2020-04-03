import _ from 'lodash';

/**
 * To align two Y axes by Y level
 * @param yAxes data [{min: min_y1, min: max_y1}, {min: min_y2, max: max_y2}]
 * @param level Y level
 */
export function alignYLevel(yAxes: any, level: any) {
  if (isNaN(level) || !checkCorrectAxis(yAxes)) {
    return;
  }

  const [yLeft, yRight] = yAxes;
  moveLevelToZero(yLeft, yRight, level);

  expandStuckValues(yLeft, yRight);

  // one of graphs on zero
  const zero = yLeft.min === 0 || yRight.min === 0 || yLeft.max === 0 || yRight.max === 0;

  const oneSide = checkOneSide(yLeft, yRight);

  if (zero && oneSide) {
    yLeft.min = yLeft.max > 0 ? 0 : yLeft.min;
    yLeft.max = yLeft.max > 0 ? yLeft.max : 0;
    yRight.min = yRight.max > 0 ? 0 : yRight.min;
    yRight.max = yRight.max > 0 ? yRight.max : 0;
  } else {
    if (checkOppositeSides(yLeft, yRight)) {
      if (yLeft.min >= 0) {
        yLeft.min = -yLeft.max;
        yRight.max = -yRight.min;
      } else {
        yLeft.max = -yLeft.min;
        yRight.min = -yRight.max;
      }
    } else {
      const rate = getRate(yLeft, yRight);

      if (oneSide) {
        // all graphs above the Y level
        if (yLeft.min > 0) {
          yLeft.min = yLeft.max / rate;
          yRight.min = yRight.max / rate;
        } else {
          yLeft.max = yLeft.min / rate;
          yRight.max = yRight.min / rate;
        }
      } else {
        if (checkTwoCross(yLeft, yRight)) {
          yLeft.min = yRight.min ? yRight.min * rate : yLeft.min;
          yRight.min = yLeft.min ? yLeft.min / rate : yRight.min;
          yLeft.max = yRight.max ? yRight.max * rate : yLeft.max;
          yRight.max = yLeft.max ? yLeft.max / rate : yRight.max;
        } else {
          yLeft.min = yLeft.min > 0 ? yRight.min * rate : yLeft.min;
          yRight.min = yRight.min > 0 ? yLeft.min / rate : yRight.min;
          yLeft.max = yLeft.max < 0 ? yRight.max * rate : yLeft.max;
          yRight.max = yRight.max < 0 ? yLeft.max / rate : yRight.max;
        }
      }
    }
  }

  restoreLevelFromZero(yLeft, yRight, level);
}

function expandStuckValues(yLeft: { max: number; min: number }, yRight: { max: number; min: number }) {
  // wide Y min and max using increased wideFactor
  const wideFactor = 0.25;
  if (yLeft.max === yLeft.min) {
    yLeft.min -= wideFactor;
    yLeft.max += wideFactor;
  }
  if (yRight.max === yRight.min) {
    yRight.min -= wideFactor;
    yRight.max += wideFactor;
  }
}

function moveLevelToZero(yLeft: { min: number; max: number }, yRight: { min: number; max: number }, level: number) {
  if (level !== 0) {
    yLeft.min -= level;
    yLeft.max -= level;
    yRight.min -= level;
    yRight.max -= level;
  }
}

function restoreLevelFromZero(
  yLeft: { min: number; max: number },
  yRight: { min: number; max: number },
  level: number
) {
  if (level !== 0) {
    yLeft.min += level;
    yLeft.max += level;
    yRight.min += level;
    yRight.max += level;
  }
}

interface AxisSide {
  max: number;
  min: number;
}

function checkCorrectAxis(axis: any[]) {
  return axis.length === 2 && checkCorrectAxes(axis[0]) && checkCorrectAxes(axis[1]);
}

function checkCorrectAxes(axes: any) {
  return 'min' in axes && 'max' in axes;
}

function checkOneSide(yLeft: AxisSide, yRight: AxisSide) {
  // on the one hand with respect to zero
  return (yLeft.min >= 0 && yRight.min >= 0) || (yLeft.max <= 0 && yRight.max <= 0);
}

function checkTwoCross(yLeft: AxisSide, yRight: AxisSide) {
  // both across zero
  return yLeft.min <= 0 && yLeft.max >= 0 && yRight.min <= 0 && yRight.max >= 0;
}

function checkOppositeSides(yLeft: AxisSide, yRight: AxisSide) {
  // on the opposite sides with respect to zero
  return (yLeft.min >= 0 && yRight.max <= 0) || (yLeft.max <= 0 && yRight.min >= 0);
}

function getRate(yLeft: AxisSide, yRight: AxisSide): number {
  if (checkTwoCross(yLeft, yRight)) {
    const rateLeft = yRight.min ? yLeft.min / yRight.min : 0;
    const rateRight = yRight.max ? yLeft.max / yRight.max : 0;

    return rateLeft > rateRight ? rateLeft : rateRight;
  }

  if (checkOneSide(yLeft, yRight)) {
    const absLeftMin = Math.abs(yLeft.min);
    const absLeftMax = Math.abs(yLeft.max);
    const absRightMin = Math.abs(yRight.min);
    const absRightMax = Math.abs(yRight.max);
    const upLeft = _.max([absLeftMin, absLeftMax]);
    const downLeft = _.min([absLeftMin, absLeftMax]);
    const upRight = _.max([absRightMin, absRightMax]);
    const downRight = _.min([absRightMin, absRightMax]);

    const rateLeft = downLeft ? upLeft / downLeft : upLeft;
    const rateRight = downRight ? upRight / downRight : upRight;

    return rateLeft > rateRight ? rateLeft : rateRight;
  }

  if (yLeft.min > 0 || yRight.min > 0) {
    return yLeft.max / yRight.max;
  } else {
    return yLeft.min / yRight.min;
  }
}
