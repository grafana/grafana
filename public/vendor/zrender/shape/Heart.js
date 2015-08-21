/**
 * @module zrender/shape/Heart
 * @author Kener (@Kener-林峰, kener.linfeng@gmail.com)
 * @example
 *   var Heart = require('zrender/shape/Heart');
 *   var shape = new Heart({
 *       style: {
 *           x: 100,
 *           y: 100,
 *           a: 40,
 *           b: 40,
 *           brushType: 'both',
 *           color: 'blue',
 *           strokeColor: 'red',
 *           lineWidth: 3,
 *           text: 'Heart'
 *       }    
 *   });
 *   zr.addShape(shape);
 */

/**
 * @typedef {Object} IHeartStyle
 * @property {number} x 心形内部尖端横坐标
 * @property {number} y 心形内部尖端纵坐标
 * @property {number} a 心形横宽（中轴线到水平边缘最宽处距离）
 * @property {number} b 心形纵高（内尖到外尖距离）
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
        'use strict';
        
        var Base = require('./Base');
        var PathProxy = require('./util/PathProxy');
        var area = require('../tool/area');
        
        /**
         * @alias module:zrender/shape/Heart
         * @constructor
         * @extends module:zrender/shape/Base
         * @param {Object} options
         */
        var Heart = function (options) {
            Base.call(this, options);

            this._pathProxy = new PathProxy();
            /**
             * 心形绘制样式
             * @name module:zrender/shape/Heart#style
             * @type {module:zrender/shape/Heart~IHeartStyle}
             */
            /**
             * 心形高亮绘制样式
             * @name module:zrender/shape/Heart#highlightStyle
             * @type {module:zrender/shape/Heart~IHeartStyle}
             */
        };

        Heart.prototype = {
            type: 'heart',

            /**
             * 创建扇形路径
             * @param {CanvasRenderingContext2D} ctx
             * @param {module:zrender/shape/Heart~IHeartStyle} style
             */
            buildPath : function (ctx, style) {
                var path = this._pathProxy || new PathProxy();
                path.begin(ctx);

                path.moveTo(style.x, style.y);
                path.bezierCurveTo(
                    style.x + style.a / 2,
                    style.y - style.b * 2 / 3,
                    style.x + style.a * 2,
                    style.y + style.b / 3,
                    style.x,
                    style.y + style.b
                );
                path.bezierCurveTo(
                    style.x - style.a *  2,
                    style.y + style.b / 3,
                    style.x - style.a / 2,
                    style.y - style.b * 2 / 3,
                    style.x,
                    style.y
                );
                path.closePath();
                return;
            },

            /**
             * 计算返回心形的包围盒矩形
             * @param {module:zrender/shape/Heart~IHeartStyle} style
             * @return {module:zrender/shape/Base~IBoundingRect}
             */
            getRect : function (style) {
                if (style.__rect) {
                    return style.__rect;
                }
                if (!this._pathProxy.isEmpty()) {
                    this.buildPath(null, style);
                }
                return this._pathProxy.fastBoundingRect();
            },

            isCover: function (x, y) {
                var originPos = this.transformCoordToLocal(x, y);
                x = originPos[0];
                y = originPos[1];
                
                if (this.isCoverRect(x, y)) {
                    return area.isInsidePath(
                        this._pathProxy.pathCommands, this.style.lineWidth, this.style.brushType, x, y
                    );
                }
            }
        };

        require('../tool/util').inherits(Heart, Base);
        return Heart;
    }
);
