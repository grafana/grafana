import _ from 'lodash';

/**
 * To align two Y axes by Y level
 * @param yAxes data [{min: min_y1, min: max_y1}, {min: min_y2, max: max_y2}]
 * @param level Y level
 */
export function alignYLevel(yAxes, level) {
  if (isNaN(level) || !checkCorrectAxis(yAxes)) {
    return;
  }

  var [yLeft, yRight] = yAxes;
  moveLevelToZero(yLeft, yRight, level);

  expandStuckValues(yLeft, yRight);

  // one of graphs on zero
  var zero = yLeft.min === 0 || yRight.min === 0 || yLeft.max === 0 || yRight.max === 0;

  var oneSide = checkOneSide(yLeft, yRight);

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
      var rate = getRate(yLeft, yRight);

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

function expandStuckValues(yLeft, yRight) {
  // wide Y min and max using increased wideFactor
  var wideFactor = 0.25;
  if (yLeft.max === yLeft.min) {
    yLeft.min -= wideFactor;
    yLeft.max += wideFactor;
  }
  if (yRight.max === yRight.min) {
    yRight.min -= wideFactor;
    yRight.max += wideFactor;
  }
}

function moveLevelToZero(yLeft, yRight, level) {
  if (level !== 0) {
    yLeft.min -= level;
    yLeft.max -= level;
    yRight.min -= level;
    yRight.max -= level;
  }
}

function restoreLevelFromZero(yLeft, yRight, level) {
  if (level !== 0) {
    yLeft.min += level;
    yLeft.max += level;
    yRight.min += level;
    yRight.max += level;
  }
}

function checkCorrectAxis(axis) {
  return axis.length === 2 && checkCorrectAxes(axis[0]) && checkCorrectAxes(axis[1]);
}

function checkCorrectAxes(axes) {
  return 'min' in axes && 'max' in axes;
}

function checkOneSide(yLeft, yRight) {
  // on the one hand with respect to zero
  return (yLeft.min >= 0 && yRight.min >= 0) || (yLeft.max <= 0 && yRight.max <= 0);
}

function checkTwoCross(yLeft, yRight) {
  // both across zero
  return yLeft.min <= 0 && yLeft.max >= 0 && yRight.min <= 0 && yRight.max >= 0;
}

function checkOppositeSides(yLeft, yRight) {
  // on the opposite sides with respect to zero
  return (yLeft.min >= 0 && yRight.max <= 0) || (yLeft.max <= 0 && yRight.min >= 0);
}

function getRate(yLeft, yRight) {
  var rateLeft, rateRight, rate;
  if (checkTwoCross(yLeft, yRight)) {
    rateLeft = yRight.min ? yLeft.min / yRight.min : 0;
    rateRight = yRight.max ? yLeft.max / yRight.max : 0;
  } else {
    if (checkOneSide(yLeft, yRight)) {
      var absLeftMin = Math.abs(yLeft.min);
      var absLeftMax = Math.abs(yLeft.max);
      var absRightMin = Math.abs(yRight.min);
      var absRightMax = Math.abs(yRight.max);
      var upLeft = _.max([absLeftMin, absLeftMax]);
      var downLeft = _.min([absLeftMin, absLeftMax]);
      var upRight = _.max([absRightMin, absRightMax]);
      var downRight = _.min([absRightMin, absRightMax]);

      rateLeft = downLeft ? upLeft / downLeft : upLeft;
      rateRight = downRight ? upRight / downRight : upRight;
    } else {
      if (yLeft.min > 0 || yRight.min > 0) {
        rateLeft = yLeft.max / yRight.max;
        rateRight = 0;
      } else {
        rateLeft = 0;
        rateRight = yLeft.min / yRight.min;
      }
    }
  }

  rate = rateLeft > rateRight ? rateLeft : rateRight;

  return rate;
}
