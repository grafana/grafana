import _ from 'lodash';

/**
 * To align two Y axes by Y level
 * @param yaxis data [{min: min_y1, min: max_y1}, {min: min_y2, max: max_y2}]
 * @param align Y level
 */
export function alignYLevel(yaxis, alignLevel) {
  var minLeft = yaxis[0].min;
  var maxLeft = yaxis[0].max;
  var minRight = yaxis[1].min;
  var maxRight = yaxis[1].max;

  if (alignLevel !== 0) {
    minLeft -= alignLevel;
    maxLeft -= alignLevel;
    minRight -= alignLevel;
    maxRight -= alignLevel;
  }

  // wide Y min and max using increased wideFactor
  var deltaLeft = maxLeft - minLeft;
  var deltaRight = maxRight - minRight;
  var wideFactor = 0.25;
  if (deltaLeft === 0) {
    minLeft -= wideFactor;
    maxLeft += wideFactor;
  }
  if (deltaRight === 0) {
    minRight -= wideFactor;
    maxRight += wideFactor;
  }

  // one of graphs on zero
  var zero = minLeft === 0 || minRight === 0 || maxLeft === 0 || maxRight === 0;

  // on the one hand with respect to zero
  var oneSide = (minLeft >= 0 && minRight >= 0) || (maxLeft <= 0 && maxRight <= 0);

  if (zero && oneSide) {
    minLeft = maxLeft > 0 ? 0 : minLeft;
    maxLeft = maxLeft > 0 ? maxLeft : 0;
    minRight = maxRight > 0 ? 0 : minRight;
    maxRight = maxRight > 0 ? maxRight : 0;
  } else {
    // on the opposite sides with respect to zero
    if ((minLeft >= 0 && maxRight <= 0) || (maxLeft <= 0 && minRight >= 0)) {
      if (minLeft >= 0) {
        minLeft = -maxLeft;
        maxRight = -minRight;
      } else {
        maxLeft = -minLeft;
        minRight = -maxRight;
      }
    } else {
      // both across zero
      var twoCross = minLeft <= 0 && maxLeft >= 0 && minRight <= 0 && maxRight >= 0;

      var rateLeft, rateRight, rate;
      if (twoCross) {
        rateLeft = minRight ? minLeft / minRight : 0;
        rateRight = maxRight ? maxLeft / maxRight : 0;
      } else {
        if (oneSide) {
          var absLeftMin = Math.abs(minLeft);
          var absLeftMax = Math.abs(maxLeft);
          var absRightMin = Math.abs(minRight);
          var absRightMax = Math.abs(maxRight);
          var upLeft = _.max([absLeftMin, absLeftMax]);
          var downLeft = _.min([absLeftMin, absLeftMax]);
          var upRight = _.max([absRightMin, absRightMax]);
          var downRight = _.min([absRightMin, absRightMax]);

          rateLeft = downLeft ? upLeft / downLeft : upLeft;
          rateRight = downRight ? upRight / downRight : upRight;
        } else {
          if (minLeft > 0 || minRight > 0) {
            rateLeft = maxLeft / maxRight;
            rateRight = 0;
          } else {
            rateLeft = 0;
            rateRight = minLeft / minRight;
          }
        }
      }
      rate = rateLeft > rateRight ? rateLeft : rateRight;

      if (oneSide) {
        if (minLeft > 0) {
          minLeft = maxLeft / rate;
          minRight = maxRight / rate;
        } else {
          maxLeft = minLeft / rate;
          maxRight = minRight / rate;
        }
      } else {
        if (twoCross) {
          minLeft = minRight ? minRight * rate : minLeft;
          minRight = minLeft ? minLeft / rate : minRight;
          maxLeft = maxRight ? maxRight * rate : maxLeft;
          maxRight = maxLeft ? maxLeft / rate : maxRight;
        } else {
          minLeft = minLeft > 0 ? minRight * rate : minLeft;
          minRight = minRight > 0 ? minLeft / rate : minRight;
          maxLeft = maxLeft < 0 ? maxRight * rate : maxLeft;
          maxRight = maxRight < 0 ? maxLeft / rate : maxRight;
        }
      }
    }
  }

  if (alignLevel !== 0) {
    minLeft += alignLevel;
    maxLeft += alignLevel;
    minRight += alignLevel;
    maxRight += alignLevel;
  }

  yaxis[0].min = minLeft;
  yaxis[0].max = maxLeft;
  yaxis[1].min = minRight;
  yaxis[1].max = maxRight;
}
