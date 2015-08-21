/**
 * 贝塞尔平滑曲线 
 * @module zrender/shape/util/smoothBezier
 * @author pissang (https://www.github.com/pissang) 
 *         Kener (@Kener-林峰, kener.linfeng@gmail.com)
 *         errorrik (errorrik@gmail.com)
 */
define(
    function (require) {
        var vector = require('../../tool/vector');

        /**
         * 贝塞尔平滑曲线
         * @alias module:zrender/shape/util/smoothBezier
         * @param {Array} points 线段顶点数组
         * @param {number} smooth 平滑等级, 0-1
         * @param {boolean} isLoop
         * @param {Array} constraint 将计算出来的控制点约束在一个包围盒内
         *                           比如 [[0, 0], [100, 100]], 这个包围盒会与
         *                           整个折线的包围盒做一个并集用来约束控制点。
         * @param {Array} 计算出来的控制点数组
         */
        return function (points, smooth, isLoop, constraint) {
            var cps = [];

            var v = [];
            var v1 = [];
            var v2 = [];
            var prevPoint;
            var nextPoint;

            var hasConstraint = !!constraint;
            var min, max;
            if (hasConstraint) {
                min = [Infinity, Infinity];
                max = [-Infinity, -Infinity];
                for (var i = 0, len = points.length; i < len; i++) {
                    vector.min(min, min, points[i]);
                    vector.max(max, max, points[i]);
                }
                // 与指定的包围盒做并集
                vector.min(min, min, constraint[0]);
                vector.max(max, max, constraint[1]);
            }

            for (var i = 0, len = points.length; i < len; i++) {
                var point = points[i];
                var prevPoint;
                var nextPoint;

                if (isLoop) {
                    prevPoint = points[i ? i - 1 : len - 1];
                    nextPoint = points[(i + 1) % len];
                } 
                else {
                    if (i === 0 || i === len - 1) {
                        cps.push(vector.clone(points[i]));
                        continue;
                    } 
                    else {
                        prevPoint = points[i - 1];
                        nextPoint = points[i + 1];
                    }
                }

                vector.sub(v, nextPoint, prevPoint);

                // use degree to scale the handle length
                vector.scale(v, v, smooth);

                var d0 = vector.distance(point, prevPoint);
                var d1 = vector.distance(point, nextPoint);
                var sum = d0 + d1;
                if (sum !== 0) {
                    d0 /= sum;
                    d1 /= sum;
                }

                vector.scale(v1, v, -d0);
                vector.scale(v2, v, d1);
                var cp0 = vector.add([], point, v1);
                var cp1 = vector.add([], point, v2);
                if (hasConstraint) {
                    vector.max(cp0, cp0, min);
                    vector.min(cp0, cp0, max);
                    vector.max(cp1, cp1, min);
                    vector.min(cp1, cp1, max);
                }
                cps.push(cp0);
                cps.push(cp1);
            }
            
            if (isLoop) {
                cps.push(vector.clone(cps.shift()));
            }

            return cps;
        };
    }
);
