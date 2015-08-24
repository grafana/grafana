/**
 * @author Kener (@Kener-林峰, kener.linfeng@gmail.com)
 *         pissang(https://github.com/pissang)
 *         errorrik (errorrik@gmail.com)
 */
define(
    function (require) {
        var vec2 = require('./vector');
        var curve = require('./curve');

        /**
         * 从顶点数组中计算出最小包围盒，写入`min`和`max`中
         * @module zrender/tool/computeBoundingBox
         * @param {Array<Object>} points 顶点数组
         * @param {number} min
         * @param {number} max
         */
        function computeBoundingBox(points, min, max) {
            if (points.length === 0) {
                return;
            }
            var left = points[0][0];
            var right = points[0][0];
            var top = points[0][1];
            var bottom = points[0][1];
            
            for (var i = 1; i < points.length; i++) {
                var p = points[i];
                if (p[0] < left) {
                    left = p[0];
                }
                if (p[0] > right) {
                    right = p[0];
                }
                if (p[1] < top) {
                    top = p[1];
                }
                if (p[1] > bottom) {
                    bottom = p[1];
                }
            }

            min[0] = left;
            min[1] = top;
            max[0] = right;
            max[1] = bottom;
        }

        /**
         * 从三阶贝塞尔曲线(p0, p1, p2, p3)中计算出最小包围盒，写入`min`和`max`中
         * @memberOf module:zrender/tool/computeBoundingBox
         * @param {Array.<number>} p0
         * @param {Array.<number>} p1
         * @param {Array.<number>} p2
         * @param {Array.<number>} p3
         * @param {Array.<number>} min
         * @param {Array.<number>} max
         */
        function computeCubeBezierBoundingBox(p0, p1, p2, p3, min, max) {
            var xDim = [];
            curve.cubicExtrema(p0[0], p1[0], p2[0], p3[0], xDim);
            for (var i = 0; i < xDim.length; i++) {
                xDim[i] = curve.cubicAt(p0[0], p1[0], p2[0], p3[0], xDim[i]);
            }
            var yDim = [];
            curve.cubicExtrema(p0[1], p1[1], p2[1], p3[1], yDim);
            for (var i = 0; i < yDim.length; i++) {
                yDim[i] = curve.cubicAt(p0[1], p1[1], p2[1], p3[1], yDim[i]);
            }

            xDim.push(p0[0], p3[0]);
            yDim.push(p0[1], p3[1]);

            var left = Math.min.apply(null, xDim);
            var right = Math.max.apply(null, xDim);
            var top = Math.min.apply(null, yDim);
            var bottom = Math.max.apply(null, yDim);

            min[0] = left;
            min[1] = top;
            max[0] = right;
            max[1] = bottom;
        }

        /**
         * 从二阶贝塞尔曲线(p0, p1, p2)中计算出最小包围盒，写入`min`和`max`中
         * @memberOf module:zrender/tool/computeBoundingBox
         * @param {Array.<number>} p0
         * @param {Array.<number>} p1
         * @param {Array.<number>} p2
         * @param {Array.<number>} min
         * @param {Array.<number>} max
         */
        function computeQuadraticBezierBoundingBox(p0, p1, p2, min, max) {
            // Find extremities, where derivative in x dim or y dim is zero
            var t1 = curve.quadraticExtremum(p0[0], p1[0], p2[0]);
            var t2 = curve.quadraticExtremum(p0[1], p1[1], p2[1]);

            t1 = Math.max(Math.min(t1, 1), 0);
            t2 = Math.max(Math.min(t2, 1), 0);

            var ct1 = 1 - t1;
            var ct2 = 1 - t2;

            var x1 = ct1 * ct1 * p0[0] 
                     + 2 * ct1 * t1 * p1[0] 
                     + t1 * t1 * p2[0];
            var y1 = ct1 * ct1 * p0[1] 
                     + 2 * ct1 * t1 * p1[1] 
                     + t1 * t1 * p2[1];

            var x2 = ct2 * ct2 * p0[0] 
                     + 2 * ct2 * t2 * p1[0] 
                     + t2 * t2 * p2[0];
            var y2 = ct2 * ct2 * p0[1] 
                     + 2 * ct2 * t2 * p1[1] 
                     + t2 * t2 * p2[1];
            min[0] = Math.min(p0[0], p2[0], x1, x2);
            min[1] = Math.min(p0[1], p2[1], y1, y2);
            max[0] = Math.max(p0[0], p2[0], x1, x2);
            max[1] = Math.max(p0[1], p2[1], y1, y2);
        }

        var start = vec2.create();
        var end = vec2.create();
        var extremity = vec2.create();
        /**
         * 从圆弧中计算出最小包围盒，写入`min`和`max`中
         * @method
         * @memberOf module:zrender/tool/computeBoundingBox
         * @param {Array.<number>} center 圆弧中心点
         * @param {number} radius 圆弧半径
         * @param {number} startAngle 圆弧开始角度
         * @param {number} endAngle 圆弧结束角度
         * @param {number} anticlockwise 是否是顺时针
         * @param {Array.<number>} min
         * @param {Array.<number>} max
         */
        var computeArcBoundingBox = function (
            x, y, r, startAngle, endAngle, anticlockwise, min, max
        ) { 
            if (Math.abs(startAngle - endAngle) >= Math.PI * 2) {
                // Is a circle
                min[0] = x - r;
                min[1] = y - r;
                max[0] = x + r;
                max[1] = y + r;
                return;
            }

            start[0] = Math.cos(startAngle) * r + x;
            start[1] = Math.sin(startAngle) * r + y;

            end[0] = Math.cos(endAngle) * r + x;
            end[1] = Math.sin(endAngle) * r + y;

            vec2.min(min, start, end);
            vec2.max(max, start, end);
            
            // Thresh to [0, Math.PI * 2]
            startAngle = startAngle % (Math.PI * 2);
            if (startAngle < 0) {
                startAngle = startAngle + Math.PI * 2;
            }
            endAngle = endAngle % (Math.PI * 2);
            if (endAngle < 0) {
                endAngle = endAngle + Math.PI * 2;
            }

            if (startAngle > endAngle && !anticlockwise) {
                endAngle += Math.PI * 2;
            } else if (startAngle < endAngle && anticlockwise) {
                startAngle += Math.PI * 2;
            }
            if (anticlockwise) {
                var tmp = endAngle;
                endAngle = startAngle;
                startAngle = tmp;
            }

            // var number = 0;
            // var step = (anticlockwise ? -Math.PI : Math.PI) / 2;
            for (var angle = 0; angle < endAngle; angle += Math.PI / 2) {
                if (angle > startAngle) {
                    extremity[0] = Math.cos(angle) * r + x;
                    extremity[1] = Math.sin(angle) * r + y;

                    vec2.min(min, extremity, min);
                    vec2.max(max, extremity, max);
                }
            }
        };

        computeBoundingBox.cubeBezier = computeCubeBezierBoundingBox;
        computeBoundingBox.quadraticBezier = computeQuadraticBezierBoundingBox;
        computeBoundingBox.arc = computeArcBoundingBox;

        return computeBoundingBox;
    }
);
