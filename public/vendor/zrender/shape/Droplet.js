/**
 * 水滴形状
 * @module zrender/shape/Droplet
 * @author Kener (@Kener-林峰, kener.linfeng@gmail.com)
 * @example
 *   var Droplet = require('zrender/shape/Droplet');
 *   var shape = new Droplet({
 *       style: {
 *           x: 100,
 *           y: 100,
 *           a: 40,
 *           b: 40,
 *           brushType: 'both',
 *           color: 'blue',
 *           strokeColor: 'red',
 *           lineWidth: 3,
 *           text: 'Droplet'
 *       }    
 *   });
 *   zr.addShape(shape);
 */

/**
 * @typedef {Object} IDropletStyle
 * @property {number} x 水滴中心x坐标
 * @property {number} y 水滴中心y坐标
 * @property {number} a 水滴横宽（中心到水平边缘最宽处距离）
 * @property {number} b 水滴纵高（中心到尖端距离）
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
         * @alias module:zrender/shape/Droplet
         * @constructor
         * @extends module:zrender/shape/Base
         * @param {Object} options
         */
        var Droplet = function(options) {
            Base.call(this, options);
            this._pathProxy = new PathProxy();
            /**
             * 水滴绘制样式
             * @name module:zrender/shape/Droplet#style
             * @type {module:zrender/shape/Droplet~IDropletStyle}
             */
            /**
             * 水滴高亮绘制样式
             * @name module:zrender/shape/Droplet#highlightStyle
             * @type {module:zrender/shape/Droplet~IDropletStyle}
             */
        };

        Droplet.prototype = {
            type: 'droplet',

            /**
             * 创建水滴路径
             * @param {CanvasRenderingContext2D} ctx
             * @param {module:zrender/shape/Droplet~IDropletStyle} style
             */
            buildPath : function(ctx, style) {
                var path = this._pathProxy || new PathProxy();
                path.begin(ctx);

                path.moveTo(style.x, style.y + style.a);
                path.bezierCurveTo(
                    style.x + style.a,
                    style.y + style.a,
                    style.x + style.a * 3 / 2,
                    style.y - style.a / 3,
                    style.x,
                    style.y - style.b
                );
                path.bezierCurveTo(
                    style.x - style.a * 3 / 2,
                    style.y - style.a / 3,
                    style.x - style.a,
                    style.y + style.a,
                    style.x,
                    style.y + style.a
                );
                path.closePath();
            },

            /**
             * 计算返回水滴的包围盒矩形
             * @param {module:zrender/shape/Droplet~IDropletStyle} style
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

        require('../tool/util').inherits(Droplet, Base);
        return Droplet;
    }
);
