/**
 * 贝塞尔曲线
 * @module zrender/shape/BezierCurve
 * @author Neil (杨骥, 511415343@qq.com)
 * @example
 *     var BezierCurve = require('zrender/shape/BezierCurve');
 *     var shape = new BezierCurve({
 *         style: {
 *             xStart: 0,
 *             yStart: 0,
 *             cpX1: 100,
 *             cpY1: 0,
 *             cpX2: 0,
 *             cpY2: 100,
 *             xEnd: 100,
 *             yEnd: 100,
 *             strokeColor: 'red'
 *         }
 *     });
 *     zr.addShape(shape);
 */

/**
 * @typedef {Object} IBezierCurveStyle
 * @property {number} xStart 起点x坐标
 * @property {number} yStart 起点y坐标
 * @property {number} cpX1 第一个控制点x坐标
 * @property {number} cpY1 第一个控制点y坐标
 * @property {number} [cpX2] 第二个控制点x坐标，如果不给则为二次贝塞尔曲线
 * @property {number} [cpY2] 第二个控制点y坐标，如果不给则为二次贝塞尔曲线
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
        'use strict';

        var Base = require('./Base');
        
        /**
         * @alias module:zrender/shape/BezierCurve
         * @constructor
         * @extends module:zrender/shape/Base
         * @param {Object} options
         */
        var BezierCurve = function(options) {
            this.brushTypeOnly = 'stroke';  // 线条只能描边，填充后果自负
            this.textPosition = 'end';
            Base.call(this, options);
            /**
             * 贝赛尔曲线绘制样式
             * @name module:zrender/shape/BezierCurve#style
             * @type {module:zrender/shape/BezierCurve~IBezierCurveStyle}
             */
            /**
             * 贝赛尔曲线高亮绘制样式
             * @name module:zrender/shape/BezierCurve#highlightStyle
             * @type {module:zrender/shape/BezierCurve~IBezierCurveStyle}
             */
        };

        BezierCurve.prototype = {
            type: 'bezier-curve',

            /**
             * 创建贝塞尔曲线路径
             * @param {CanvasRenderingContext2D} ctx
             * @param {module:zrender/shape/BezierCurve~IBezierCurveStyle} style
             */
            buildPath : function(ctx, style) {
                ctx.moveTo(style.xStart, style.yStart);
                if (typeof style.cpX2 != 'undefined'
                    && typeof style.cpY2 != 'undefined'
                ) {
                    ctx.bezierCurveTo(
                        style.cpX1, style.cpY1,
                        style.cpX2, style.cpY2,
                        style.xEnd, style.yEnd
                    );
                }
                else {
                    ctx.quadraticCurveTo(
                        style.cpX1, style.cpY1,
                        style.xEnd, style.yEnd
                    );
                }
            },

            /**
             * 计算返回贝赛尔曲线包围盒矩形。
             * 该包围盒是直接从四个控制点计算，并非最小包围盒。
             * @param {module:zrender/shape/BezierCurve~IBezierCurveStyle} style
             * @return {module:zrender/shape/Base~IBoundingRect}
             */
            getRect : function(style) {
                if (style.__rect) {
                    return style.__rect;
                }
                
                var _minX = Math.min(style.xStart, style.xEnd, style.cpX1);
                var _minY = Math.min(style.yStart, style.yEnd, style.cpY1);
                var _maxX = Math.max(style.xStart, style.xEnd, style.cpX1);
                var _maxY = Math.max(style.yStart, style.yEnd, style.cpY1);
                var _x2 = style.cpX2;
                var _y2 = style.cpY2;

                if (typeof _x2 != 'undefined'
                    && typeof _y2 != 'undefined'
                ) {
                    _minX = Math.min(_minX, _x2);
                    _minY = Math.min(_minY, _y2);
                    _maxX = Math.max(_maxX, _x2);
                    _maxY = Math.max(_maxY, _y2);
                }

                var lineWidth = style.lineWidth || 1;
                style.__rect = {
                    x : _minX - lineWidth,
                    y : _minY - lineWidth,
                    width : _maxX - _minX + lineWidth,
                    height : _maxY - _minY + lineWidth
                };
                
                return style.__rect;
            }
        };

        require('../tool/util').inherits(BezierCurve, Base);
        return BezierCurve;
    }
);
