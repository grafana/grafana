/**
 * zrender: 数学辅助类
 *
 * @author Kener (@Kener-林峰, kener.linfeng@gmail.com)
 *
 * sin：正弦函数
 * cos：余弦函数
 * degreeToRadian：角度转弧度
 * radianToDegree：弧度转角度
 */
define(
    function () {

        var _radians = Math.PI / 180;

        /**
         * @param {number} angle 弧度（角度）参数
         * @param {boolean} isDegrees angle参数是否为角度计算，默认为false，angle为以弧度计量的角度
         */
        function sin(angle, isDegrees) {
            return Math.sin(isDegrees ? angle * _radians : angle);
        }

        /**
         * @param {number} angle 弧度（角度）参数
         * @param {boolean} isDegrees angle参数是否为角度计算，默认为false，angle为以弧度计量的角度
         */
        function cos(angle, isDegrees) {
            return Math.cos(isDegrees ? angle * _radians : angle);
        }

        /**
         * 角度转弧度
         * @param {Object} angle
         */
        function degreeToRadian(angle) {
            return angle * _radians;
        }

        /**
         * 弧度转角度
         * @param {Object} angle
         */
        function radianToDegree(angle) {
            return angle / _radians;
        }

        return {
            sin : sin,
            cos : cos,
            degreeToRadian : degreeToRadian,
            radianToDegree : radianToDegree
        };
    }
);
