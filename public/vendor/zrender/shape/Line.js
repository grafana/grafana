/**
 * 直线
 * @module zrender/shape/Line
 * @author Kener (@Kener-林峰, kener.linfeng@gmail.com)
 * @example
 *   var Line = require('zrender/shape/Line');
 *   var shape = new Line({
 *       style: {
 *           xStart: 0,
 *           yStart: 0,
 *           xEnd: 100,
 *           yEnd: 100,
 *           strokeColor: '#000',
 *           lineWidth: 10
 *       }
 *   });
 *   zr.addShape(line);
 */
/**
 * @typedef {Object} ILineStyle
 * @property {number} xStart 起点x坐标
 * @property {number} yStart 起点y坐标
 * @property {number} xEnd 终止点x坐标
 * @property {number} yEnd 终止点y坐标
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
        var dashedLineTo = require('./util/dashedLineTo');
        
        /**
         * @alias module:zrender/shape/Line
         * @param {Object} options
         * @constructor
         * @extends module:zrender/shape/Base
         */
        var Line = function (options) {
            this.brushTypeOnly = 'stroke';  // 线条只能描边，填充后果自负
            this.textPosition = 'end';
            Base.call(this, options);

            /**
             * 直线绘制样式
             * @name module:zrender/shape/Line#style
             * @type {module:zrender/shape/Line~ILineStyle}
             */
            /**
             * 直线高亮绘制样式
             * @name module:zrender/shape/Line#highlightStyle
             * @type {module:zrender/shape/Line~ILineStyle}
             */
        };

        Line.prototype =  {
            type: 'line',

            /**
             * 创建线条路径
             * @param {CanvasRenderingContext2D} ctx
             * @param {module:zrender/shape/Line~ILineStyle} style
             */
            buildPath : function (ctx, style) {
                if (!style.lineType || style.lineType == 'solid') {
                    // 默认为实线
                    ctx.moveTo(style.xStart, style.yStart);
                    ctx.lineTo(style.xEnd, style.yEnd);
                }
                else if (style.lineType == 'dashed'
                        || style.lineType == 'dotted'
                ) {
                    var dashLength = (style.lineWidth || 1)  
                                     * (style.lineType == 'dashed' ? 5 : 1);
                    dashedLineTo(
                        ctx,
                        style.xStart, style.yStart,
                        style.xEnd, style.yEnd,
                        dashLength
                    );
                }
            },

            /**
             * 计算返回线条的包围盒矩形
             * @param {module:zrender/shape/Line~ILineStyle} style
             * @return {module:zrender/shape/Base~IBoundingRect}
             */
            getRect : function (style) {
                if (style.__rect) {
                    return style.__rect;
                }
                
                var lineWidth = style.lineWidth || 1;
                style.__rect = {
                    x : Math.min(style.xStart, style.xEnd) - lineWidth,
                    y : Math.min(style.yStart, style.yEnd) - lineWidth,
                    width : Math.abs(style.xStart - style.xEnd)
                            + lineWidth,
                    height : Math.abs(style.yStart - style.yEnd)
                             + lineWidth
                };
                
                return style.__rect;
            }
        };

        require('../tool/util').inherits(Line, Base);
        return Line;
    }
);
