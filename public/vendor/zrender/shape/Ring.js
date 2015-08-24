/**
 * 圆环
 * @module zrender/shape/Ring
 * @author Kener (@Kener-林峰, kener.linfeng@gmail.com)
 *
 * @example
 *     var Ring = require('zrender/shape/Ring');
 *     var shape = new Ring({
 *         style: {
 *             x: 100,
 *             y: 100,
 *             r0: 30,
 *             r: 50
 *         }
 *     });
 *     zr.addShape(shape);
 */

/**
 * @typedef {Object} IRingStyle
 * @property {number} x 圆心x坐标
 * @property {number} y 圆心y坐标
 * @property {number} r0 内圆半径
 * @property {number} r 外圆半径
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
         * @alias module:zrender/shape/Ring
         * @constructor
         * @extends module:zrender/shape/Base
         * @param {Object} options
         */
        var Ring = function (options) {
            Base.call(this, options);
            /**
             * 圆环绘制样式
             * @name module:zrender/shape/Ring#style
             * @type {module:zrender/shape/Ring~IRingStyle}
             */
            /**
             * 圆环高亮绘制样式
             * @name module:zrender/shape/Ring#highlightStyle
             * @type {module:zrender/shape/Ring~IRingStyle}
             */
        };

        Ring.prototype = {
            type: 'ring',

            /**
             * 创建圆环路径
             * @param {CanvasRenderingContext2D} ctx
             * @param {module:zrender/shape/Ring~IRingStyle} style
             */
            buildPath : function (ctx, style) {
                // 非零环绕填充优化
                ctx.arc(style.x, style.y, style.r, 0, Math.PI * 2, false);
                ctx.moveTo(style.x + style.r0, style.y);
                ctx.arc(style.x, style.y, style.r0, 0, Math.PI * 2, true);
                return;
            },

            /**
             * 计算返回圆环包围盒矩阵
             * @param {module:zrender/shape/Ring~IRingStyle} style
             * @return {module:zrender/shape/Base~IBoundingRect}
             */
            getRect : function (style) {
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
                    x : Math.round(style.x - style.r - lineWidth / 2),
                    y : Math.round(style.y - style.r - lineWidth / 2),
                    width : style.r * 2 + lineWidth,
                    height : style.r * 2 + lineWidth
                };
                
                return style.__rect;
            }
        };

        require('../tool/util').inherits(Ring, Base);
        return Ring;
    }
);
