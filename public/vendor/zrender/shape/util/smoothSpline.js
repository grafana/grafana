/**
 * Catmull-Rom spline 插值折线
 * @module zrender/shape/util/smoothSpline
 * @author pissang (https://www.github.com/pissang) 
 *         Kener (@Kener-林峰, kener.linfeng@gmail.com)
 *         errorrik (errorrik@gmail.com)
 */
define(
    function (require) {
        var vector = require('../../tool/vector');

        /**
         * @inner
         */
        function interpolate(p0, p1, p2, p3, t, t2, t3) {
            var v0 = (p2 - p0) * 0.5;
            var v1 = (p3 - p1) * 0.5;
            return (2 * (p1 - p2) + v0 + v1) * t3 
                    + (-3 * (p1 - p2) - 2 * v0 - v1) * t2
                    + v0 * t + p1;
        }

        /**
         * @alias module:zrender/shape/util/smoothSpline
         * @param {Array} points 线段顶点数组
         * @param {boolean} isLoop
         * @param {Array} constraint 
         * @return {Array}
         */
        return function (points, isLoop, constraint) {
            var len = points.length;
            var ret = [];

            var distance = 0;
            for (var i = 1; i < len; i++) {
                distance += vector.distance(points[i - 1], points[i]);
            }
            
            var segs = distance / 5;
            segs = segs < len ? len : segs;
            for (var i = 0; i < segs; i++) {
                var pos = i / (segs - 1) * (isLoop ? len : len - 1);
                var idx = Math.floor(pos);

                var w = pos - idx;

                var p0;
                var p1 = points[idx % len];
                var p2;
                var p3;
                if (!isLoop) {
                    p0 = points[idx === 0 ? idx : idx - 1];
                    p2 = points[idx > len - 2 ? len - 1 : idx + 1];
                    p3 = points[idx > len - 3 ? len - 1 : idx + 2];
                }
                else {
                    p0 = points[(idx - 1 + len) % len];
                    p2 = points[(idx + 1) % len];
                    p3 = points[(idx + 2) % len];
                }

                var w2 = w * w;
                var w3 = w * w2;

                ret.push([
                    interpolate(p0[0], p1[0], p2[0], p3[0], w, w2, w3),
                    interpolate(p0[1], p1[1], p2[1], p3[1], w, w2, w3)
                ]);
            }
            return ret;
        };
    }
);
