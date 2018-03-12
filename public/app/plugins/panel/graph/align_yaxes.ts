import _ from 'lodash';

/**
 * To align two Y axes by Y level
 * @param yaxis data [{min: min_y1, min: max_y1}, {min: min_y2, max: max_y2}]
 * @param align Y level
 */
export function alignYLevel(yaxis, alignLevel) {
  moveLevelToZero(yaxis, alignLevel);

  expandStuckValues(yaxis);

  // one of graphs on zero
  var zero = yaxis[0].min === 0 || yaxis[1].min === 0 || yaxis[0].max === 0 || yaxis[1].max === 0;

  var oneSide = checkOneSide(yaxis);

  if (zero && oneSide) {
    yaxis[0].min = yaxis[0].max > 0 ? 0 : yaxis[0].min;
    yaxis[0].max = yaxis[0].max > 0 ? yaxis[0].max : 0;
    yaxis[1].min = yaxis[1].max > 0 ? 0 : yaxis[1].min;
    yaxis[1].max = yaxis[1].max > 0 ? yaxis[1].max : 0;
  } else {
    // on the opposite sides with respect to zero
    if ((yaxis[0].min >= 0 && yaxis[1].max <= 0) || (yaxis[0].max <= 0 && yaxis[1].min >= 0)) {
      if (yaxis[0].min >= 0) {
        yaxis[0].min = -yaxis[0].max;
        yaxis[1].max = -yaxis[1].min;
      } else {
        yaxis[0].max = -yaxis[0].min;
        yaxis[1].min = -yaxis[1].max;
      }
    } else {
      var rate = getRate(yaxis);

      if (oneSide) {
        if (yaxis[0].min > 0) {
          yaxis[0].min = yaxis[0].max / rate;
          yaxis[1].min = yaxis[1].max / rate;
        } else {
          yaxis[0].max = yaxis[0].min / rate;
          yaxis[1].max = yaxis[1].min / rate;
        }
      } else {
        if (checkTwoCross(yaxis)) {
          yaxis[0].min = yaxis[1].min ? yaxis[1].min * rate : yaxis[0].min;
          yaxis[1].min = yaxis[0].min ? yaxis[0].min / rate : yaxis[1].min;
          yaxis[0].max = yaxis[1].max ? yaxis[1].max * rate : yaxis[0].max;
          yaxis[1].max = yaxis[0].max ? yaxis[0].max / rate : yaxis[1].max;
        } else {
          yaxis[0].min = yaxis[0].min > 0 ? yaxis[1].min * rate : yaxis[0].min;
          yaxis[1].min = yaxis[1].min > 0 ? yaxis[0].min / rate : yaxis[1].min;
          yaxis[0].max = yaxis[0].max < 0 ? yaxis[1].max * rate : yaxis[0].max;
          yaxis[1].max = yaxis[1].max < 0 ? yaxis[0].max / rate : yaxis[1].max;
        }
      }
    }
  }

  restoreLevelFromZero(yaxis, alignLevel);
}

function expandStuckValues(yaxis) {
  // wide Y min and max using increased wideFactor
  var wideFactor = 0.25;
  if (yaxis[0].max === yaxis[0].min) {
    yaxis[0].min -= wideFactor;
    yaxis[0].max += wideFactor;
  }
  if (yaxis[1].max === yaxis[1].min) {
    yaxis[1].min -= wideFactor;
    yaxis[1].max += wideFactor;
  }
}

function moveLevelToZero(yaxis, alignLevel) {
  if (alignLevel !== 0) {
    yaxis[0].min -= alignLevel;
    yaxis[0].max -= alignLevel;
    yaxis[1].min -= alignLevel;
    yaxis[1].max -= alignLevel;
  }
}

function restoreLevelFromZero(yaxis, alignLevel) {
  if (alignLevel !== 0) {
    yaxis[0].min += alignLevel;
    yaxis[0].max += alignLevel;
    yaxis[1].min += alignLevel;
    yaxis[1].max += alignLevel;
  }
}

function checkOneSide(yaxis) {
  // on the one hand with respect to zero
  return (yaxis[0].min >= 0 && yaxis[1].min >= 0) || (yaxis[0].max <= 0 && yaxis[1].max <= 0);
}

function checkTwoCross(yaxis) {
  // both across zero
  return yaxis[0].min <= 0 && yaxis[0].max >= 0 && yaxis[1].min <= 0 && yaxis[1].max >= 0;
}

function getRate(yaxis) {
  var rateLeft, rateRight, rate;
  if (checkTwoCross(yaxis)) {
    rateLeft = yaxis[1].min ? yaxis[0].min / yaxis[1].min : 0;
    rateRight = yaxis[1].max ? yaxis[0].max / yaxis[1].max : 0;
  } else {
    if (checkOneSide(yaxis)) {
      var absLeftMin = Math.abs(yaxis[0].min);
      var absLeftMax = Math.abs(yaxis[0].max);
      var absRightMin = Math.abs(yaxis[1].min);
      var absRightMax = Math.abs(yaxis[1].max);
      var upLeft = _.max([absLeftMin, absLeftMax]);
      var downLeft = _.min([absLeftMin, absLeftMax]);
      var upRight = _.max([absRightMin, absRightMax]);
      var downRight = _.min([absRightMin, absRightMax]);

      rateLeft = downLeft ? upLeft / downLeft : upLeft;
      rateRight = downRight ? upRight / downRight : upRight;
    } else {
      if (yaxis[0].min > 0 || yaxis[1].min > 0) {
        rateLeft = yaxis[0].max / yaxis[1].max;
        rateRight = 0;
      } else {
        rateLeft = 0;
        rateRight = yaxis[0].min / yaxis[1].min;
      }
    }
  }

  rate = rateLeft > rateRight ? rateLeft : rateRight;

  return rate;
}
