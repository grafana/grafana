/**
 * 扇形
 * @author Kener (@Kener-林峰, kener.linfeng@gmail.com)
 * @module zrender/shape/Sector
 * @example
 *     var Sector = require('zrender/shape/Sector');
 *     var shape = new Sector({
 *         style: {
 *             x: 100,
 *             y: 100,
 *             r: 60,
 *             r0: 30,
 *             startAngle: 0,
 *             endEngle: 180
 *         } 
 *     });
 *     zr.addShape(shape);
 */

/**
 * @typedef {Object} ISectorStyle
 * @property {number} x 圆心x坐标
 * @property {number} y 圆心y坐标
 * @property {number} r 外圆半径
 * @property {number} [r0=0] 内圆半径，指定后将出现内弧，同时扇边长度为`r - r0`
 * @property {number} startAngle 起始角度，`[0, 360)`
 * @property {number} endAngle 结束角度，`(0, 360]`
 * @property {boolean} [clockWise=false] 是否是顺时针
 * @property {string} [brushType='fill']
 * @property {string} [color='#000000'] 填充颜色
 * @property {string} [strokeColor='#000000'] 描边颜色
 * @property {string} [lineCape='butt'] 线帽样式，可以是 butt, round, square
 * @property {number} [lineWidth=1] 描边宽度
 * @property {number} [opacity=1] 绘制透明度
 * @property {number} [shadowBlur=0] 阴影模糊度，大于0有效
 * @property {string} [shadowColor='#000000'] 阴影颜色
 * @property {number} [shadowOffsetX=0] 阴影横向偏移
 * @property {number} [shadowOffsetY=0] 阴影纵向偏移
 * @property {string} [text] 图形中的附加文本
 * @property {string} [textColor='#000000'] 文本颜色
 * @property {string} [textFont] 附加文本样式，eg:'bold 18px verdana'
 * @property {string} [textPosition='end'] 附加文本位置, 可以是 inside, left, right, top, bottom
 * @property {string} [textAlign] 默认根据textPosition自动设置，附加文本水平对齐。
 *                                可以是start, end, left, right, center
 * @property {string} [textBaseline] 默认根据textPosition自动设置，附加文本垂直对齐。
 *                                可以是top, bottom, middle, alphabetic, hanging, ideographic
 */

define(
    function (require) {

        var math = require('../tool/math');
        var computeBoundingBox = require('../tool/computeBoundingBox');
        var vec2 = require('../tool/vector');
        var Base = require('./Base');
        
        var min0 = vec2.create();
        var min1 = vec2.create();
        var max0 = vec2.create();
        var max1 = vec2.create();
        /**
         * @alias module:zrender/shape/Sector
         * @constructor
         * @extends module:zrender/shape/Base
         * @param {Object} options
         */
        var Sector = function (options) {
            Base.call(this, options);
            /**
             * 扇形绘制样式
             * @name module:zrender/shape/Sector#style
             * @type {module:zrender/shape/Sector~ISectorStyle}
             */
            /**
             * 扇形高亮绘制样式
             * @name module:zrender/shape/Sector#highlightStyle
             * @type {module:zrender/shape/Sector~ISectorStyle}
             */
        };

        Sector.prototype = {
            type: 'sector',

            /**
             * 创建扇形路径
             * @param {CanvasRenderingContext2D} ctx
             * @param {module:zrender/shape/Sector~ISectorStyle} style
             */
            buildPath : function (ctx, style) {
                var x = style.x;   // 圆心x
                var y = style.y;   // 圆心y
                var r0 = style.r0 || 0;     // 形内半径[0,r)
                var r = style.r;            // 扇形外半径(0,r]
                var startAngle = style.startAngle;          // 起始角度[0,360)
                var endAngle = style.endAngle;              // 结束角度(0,360]
                var clockWise = style.clockWise || false;

                startAngle = math.degreeToRadian(startAngle);
                endAngle = math.degreeToRadian(endAngle);

                if (!clockWise) {
                    // 扇形默认是逆时针方向，Y轴向上
                    // 这个跟arc的标准不一样，为了兼容echarts
                    startAngle = -startAngle;
                    endAngle = -endAngle;
                }

                var unitX = math.cos(startAngle);
                var unitY = math.sin(startAngle);
                ctx.moveTo(
                    unitX * r0 + x,
                    unitY * r0 + y
                );

                ctx.lineTo(
                    unitX * r + x,
                    unitY * r + y
                );

                ctx.arc(x, y, r, startAngle, endAngle, !clockWise);

                ctx.lineTo(
                    math.cos(endAngle) * r0 + x,
                    math.sin(endAngle) * r0 + y
                );

                if (r0 !== 0) {
                    ctx.arc(x, y, r0, endAngle, startAngle, clockWise);
                }

                ctx.closePath();

                return;
            },

            /**
             * 返回扇形包围盒矩形
             * @param {module:zrender/shape/Sector~ISectorStyle} style
             * @return {module:zrender/shape/Base~IBoundingRect}
             */
            getRect : function (style) {
                if (style.__rect) {
                    return style.__rect;
                }
                
                var x = style.x;   // 圆心x
                var y = style.y;   // 圆心y
                var r0 = style.r0 || 0;     // 形内半径[0,r)
                var r = style.r;            // 扇形外半径(0,r]
                var startAngle = math.degreeToRadian(style.startAngle);
                var endAngle = math.degreeToRadian(style.endAngle);
                var clockWise = style.clockWise;

                if (!clockWise) {
                    startAngle = -startAngle;
                    endAngle = -endAngle;
                }

                if (r0 > 1) {
                    computeBoundingBox.arc(
                        x, y, r0, startAngle, endAngle, !clockWise, min0, max0
                    );   
                } else {
                    min0[0] = max0[0] = x;
                    min0[1] = max0[1] = y;
                }
                computeBoundingBox.arc(
                    x, y, r, startAngle, endAngle, !clockWise, min1, max1
                );

                vec2.min(min0, min0, min1);
                vec2.max(max0, max0, max1);
                style.__rect = {
                    x: min0[0],
                    y: min0[1],
                    width: max0[0] - min0[0],
                    height: max0[1] - min0[1]
                };
                return style.__rect;
            }
        };


        require('../tool/util').inherits(Sector, Base);
        return Sector;
    }
);
