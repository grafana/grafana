/**
 * 水滴形状
 * @module zrender/shape/Ellipse
 * @example
 *   var Ellipse = require('zrender/shape/Ellipse');
 *   var shape = new Ellipse({
 *       style: {
 *           x: 100,
 *           y: 100,
 *           a: 40,
 *           b: 20,
 *           brushType: 'both',
 *           color: 'blue',
 *           strokeColor: 'red',
 *           lineWidth: 3,
 *           text: 'Ellipse'
 *       }    
 *   });
 *   zr.addShape(shape);
 */

/**
 * @typedef {Object} IEllipseStyle
 * @property {number} x 圆心x坐标
 * @property {number} y 圆心y坐标
 * @property {number} a 横轴半径
 * @property {number} b 纵轴半径
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
        var Base = require('./Base');

        /**
         * @alias module:zrender/shape/Ellipse
         * @constructor
         * @extends module:zrender/shape/Base
         * @param {Object} options
         */
        var Ellipse = function(options) {
            Base.call(this, options);
            /**
             * 椭圆绘制样式
             * @name module:zrender/shape/Ellipse#style
             * @type {module:zrender/shape/Ellipse~IEllipseStyle}
             */
            /**
             * 椭圆高亮绘制样式
             * @name module:zrender/shape/Ellipse#highlightStyle
             * @type {module:zrender/shape/Ellipse~IEllipseStyle}
             */
        };

        Ellipse.prototype = {
            type: 'ellipse',

            /**
             * 构建椭圆的Path
             * @param {CanvasRenderingContext2D} ctx
             * @param {module:zrender/shape/Ellipse~IEllipseStyle} style
             */
            buildPath : function(ctx, style) {
                var k = 0.5522848;
                var x = style.x;
                var y = style.y;
                var a = style.a;
                var b = style.b;
                var ox = a * k; // 水平控制点偏移量
                var oy = b * k; // 垂直控制点偏移量
                // 从椭圆的左端点开始顺时针绘制四条三次贝塞尔曲线
                ctx.moveTo(x - a, y);
                ctx.bezierCurveTo(x - a, y - oy, x - ox, y - b, x, y - b);
                ctx.bezierCurveTo(x + ox, y - b, x + a, y - oy, x + a, y);
                ctx.bezierCurveTo(x + a, y + oy, x + ox, y + b, x, y + b);
                ctx.bezierCurveTo(x - ox, y + b, x - a, y + oy, x - a, y);
                ctx.closePath();
            },

            /**
            /**
             * 计算返回椭圆包围盒矩形。
             * @param {module:zrender/shape/Ellipse~IEllipseStyle} style
             * @return {module:zrender/shape/Base~IBoundingRect}
             */
            getRect : function(style) {
                if (style.__rect) {
                    return style.__rect;
                }
                
                var lineWidth;
                if (style.brushType == 'stroke' || style.brushType == 'fill') {
                    lineWidth = style.lineWidth || 1;
                }
                else {
                    lineWidth = 0;
                }
                style.__rect = {
                    x : Math.round(style.x - style.a - lineWidth / 2),
                    y : Math.round(style.y - style.b - lineWidth / 2),
                    width : style.a * 2 + lineWidth,
                    height : style.b * 2 + lineWidth
                };
                
                return style.__rect;
            }
        };

        require('../tool/util').inherits(Ellipse, Base);
        return Ellipse;
    }
);
