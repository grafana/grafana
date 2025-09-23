/*
 * jQuery.flot.dashes
 *
 * options = {
 *   series: {
 *     dashes: {
 *
 *       // show
 *       // default: false
 *       // Whether to show dashes for the series.
 *       show: <boolean>,
 *
 *       // lineWidth
 *       // default: 2
 *       // The width of the dashed line in pixels.
 *       lineWidth: <number>,
 *
 *       // dashLength
 *       // default: 10
 *       // Controls the length of the individual dashes and the amount of
 *       // space between them.
 *       // If this is a number, the dashes and spaces will have that length.
 *       // If this is an array, it is read as [ dashLength, spaceLength ]
 *       dashLength: <number> or <array[2]>
 *     }
 *   }
 * }
 */
(function($){

  function init(plot) {

    plot.hooks.processDatapoints.push(function(plot, series, datapoints) {

      if (!series.dashes.show) return;

      plot.hooks.draw.push(function(plot, ctx) {

        var plotOffset = plot.getPlotOffset(),
          axisx = series.xaxis,
          axisy = series.yaxis;

        function plotDashes(xoffset, yoffset) {

          var points = datapoints.points,
            ps = datapoints.pointsize,
            prevx = null,
            prevy = null,
            dashRemainder = 0,
            dashOn = true,
            dashOnLength,
            dashOffLength;

          if (series.dashes.dashLength[0]) {
            dashOnLength = series.dashes.dashLength[0];
            if (series.dashes.dashLength[1]) {
              dashOffLength = series.dashes.dashLength[1];
            } else {
              dashOffLength = dashOnLength;
            }
          } else {
            dashOffLength = dashOnLength = series.dashes.dashLength;
          }

          ctx.beginPath();

          for (var i = ps; i < points.length; i += ps) {

            var x1 = points[i - ps],
              y1 = points[i - ps + 1],
              x2 = points[i],
              y2 = points[i + 1];

            if (x1 == null || x2 == null) continue;

            // clip with ymin
            if (y1 <= y2 && y1 < axisy.min) {
              if (y2 < axisy.min) continue;   // line segment is outside
              // compute new intersection point
              x1 = (axisy.min - y1) / (y2 - y1) * (x2 - x1) + x1;
              y1 = axisy.min;
            } else if (y2 <= y1 && y2 < axisy.min) {
              if (y1 < axisy.min) continue;
              x2 = (axisy.min - y1) / (y2 - y1) * (x2 - x1) + x1;
              y2 = axisy.min;
            }

            // clip with ymax
            if (y1 >= y2 && y1 > axisy.max) {
              if (y2 > axisy.max) continue;
              x1 = (axisy.max - y1) / (y2 - y1) * (x2 - x1) + x1;
              y1 = axisy.max;
            } else if (y2 >= y1 && y2 > axisy.max) {
              if (y1 > axisy.max) continue;
              x2 = (axisy.max - y1) / (y2 - y1) * (x2 - x1) + x1;
              y2 = axisy.max;
            }

            // clip with xmin
            if (x1 <= x2 && x1 < axisx.min) {
              if (x2 < axisx.min) continue;
              y1 = (axisx.min - x1) / (x2 - x1) * (y2 - y1) + y1;
              x1 = axisx.min;
            } else if (x2 <= x1 && x2 < axisx.min) {
              if (x1 < axisx.min) continue;
              y2 = (axisx.min - x1) / (x2 - x1) * (y2 - y1) + y1;
              x2 = axisx.min;
            }

            // clip with xmax
            if (x1 >= x2 && x1 > axisx.max) {
              if (x2 > axisx.max) continue;
              y1 = (axisx.max - x1) / (x2 - x1) * (y2 - y1) + y1;
              x1 = axisx.max;
            } else if (x2 >= x1 && x2 > axisx.max) {
              if (x1 > axisx.max) continue;
              y2 = (axisx.max - x1) / (x2 - x1) * (y2 - y1) + y1;
              x2 = axisx.max;
            }

            if (x1 != prevx || y1 != prevy) {
              ctx.moveTo(axisx.p2c(x1) + xoffset, axisy.p2c(y1) + yoffset);
            }

            var ax1 = axisx.p2c(x1) + xoffset,
              ay1 = axisy.p2c(y1) + yoffset,
              ax2 = axisx.p2c(x2) + xoffset,
              ay2 = axisy.p2c(y2) + yoffset,
              dashOffset;

            function lineSegmentOffset(segmentLength) {

              var c = Math.sqrt(Math.pow(ax2 - ax1, 2) + Math.pow(ay2 - ay1, 2));

              if (c <= segmentLength) {
                return {
                  deltaX: ax2 - ax1,
                  deltaY: ay2 - ay1,
                  distance: c,
                  remainder: segmentLength - c
                }
              } else {
                var xsign = ax2 > ax1 ? 1 : -1,
                  ysign = ay2 > ay1 ? 1 : -1;
                return {
                  deltaX: xsign * Math.sqrt(Math.pow(segmentLength, 2) / (1 + Math.pow((ay2 - ay1)/(ax2 - ax1), 2))),
                  deltaY: ysign * Math.sqrt(Math.pow(segmentLength, 2) - Math.pow(segmentLength, 2) / (1 + Math.pow((ay2 - ay1)/(ax2 - ax1), 2))),
                  distance: segmentLength,
                  remainder: 0
                };
              }
            }
            //-end lineSegmentOffset

            do {

              dashOffset = lineSegmentOffset(
                dashRemainder > 0 ? dashRemainder :
                  dashOn ? dashOnLength : dashOffLength);

              if (dashOffset.deltaX != 0 || dashOffset.deltaY != 0) {
                if (dashOn) {
                  ctx.lineTo(ax1 + dashOffset.deltaX, ay1 + dashOffset.deltaY);
                } else {
                  ctx.moveTo(ax1 + dashOffset.deltaX, ay1 + dashOffset.deltaY);
                }
              }

              dashOn = !dashOn;
              dashRemainder = dashOffset.remainder;
              ax1 += dashOffset.deltaX;
              ay1 += dashOffset.deltaY;

            } while (dashOffset.distance > 0);

            prevx = x2;
            prevy = y2;
          }

          ctx.stroke();
        }
        //-end plotDashes

        ctx.save();
        ctx.translate(plotOffset.left, plotOffset.top);
        ctx.lineJoin = 'round';

        var lw = series.dashes.lineWidth,
          sw = series.shadowSize;

        // FIXME: consider another form of shadow when filling is turned on
        if (lw > 0 && sw > 0) {
          // draw shadow as a thick and thin line with transparency
          ctx.lineWidth = sw;
          ctx.strokeStyle = "rgba(0,0,0,0.1)";
          // position shadow at angle from the mid of line
          var angle = Math.PI/18;
          plotDashes(Math.sin(angle) * (lw/2 + sw/2), Math.cos(angle) * (lw/2 + sw/2));
          ctx.lineWidth = sw/2;
          plotDashes(Math.sin(angle) * (lw/2 + sw/4), Math.cos(angle) * (lw/2 + sw/4));
        }

        ctx.lineWidth = lw;
        ctx.strokeStyle = series.color;

        if (lw > 0) {
          plotDashes(0, 0);
        }

        ctx.restore();

      });
      //-end draw hook

    });
    //-end processDatapoints hook

  }
  //-end init

  $.plot.plugins.push({
    init: init,
    options: {
      series: {
        dashes: {
          show: false,
          lineWidth: 2,
          dashLength: 10
        }
      }
    },
    name: 'dashes',
    version: '0.1'
  });

})(jQuery)
