/**
 * ShapeBundle 捆绑多个 shape 的 buildPath 方法，但是共用同一个样式
 * @author pissang (https://github.com/pissang)
 * @module zrender/shape/ShapeBundle
 * @example
 *     var poly1 = new PolygonShape();
 *     var poly2 = new PolygonShape();
 *     var poly3 = new PolygonShape();
 *     var shapeBundle = new ShapeBundle({
 *         style: {
 *             shapeList: [poly1, poly2, poly3],
 *             color: 'red'
 *         }
 *     });
 *     zr.addShape(shapeBundle);
 */

/**
 * @typedef {Object} IShapeBundleStyle
 * @property {string} shapeList shape列表
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
define(function (require) {

    var Base = require('./Base');

    var ShapeBundle = function (options) {
        Base.call(this, options);
        /**
         * ShapeBundle绘制样式
         * @name module:zrender/shape/ShapeBundle#style
         * @type {module:zrender/shape/ShapeBundle~IShapeBundleStyle}
         */
        /**
         * ShapeBundle高亮绘制样式
         * @name module:zrender/shape/ShapeBundle#highlightStyle
         * @type {module:zrender/shape/ShapeBundle~IShapeBundleStyle}
         */
    };

    ShapeBundle.prototype = {

        constructor: ShapeBundle,

        type: 'shape-bundle',

        brush: function (ctx, isHighlight) {
            var style = this.beforeBrush(ctx, isHighlight);

            ctx.beginPath();
            for (var i = 0; i < style.shapeList.length; i++) {
                var subShape = style.shapeList[i];
                var subShapeStyle = subShape.style;
                if (isHighlight) {
                    subShapeStyle = subShape.getHighlightStyle(
                        subShapeStyle,
                        subShape.highlightStyle || {},
                        subShape.brushTypeOnly
                    );
                }
                subShape.buildPath(ctx, subShapeStyle);
            }
            switch (style.brushType) {
                /* jshint ignore:start */
                case 'both':
                    ctx.fill();
                case 'stroke':
                    style.lineWidth > 0 && ctx.stroke();
                    break;
                /* jshint ignore:end */
                default:
                    ctx.fill();
            }

            this.drawText(ctx, style, this.style);

            this.afterBrush(ctx);
        },

        /**
         * 计算返回多边形包围盒矩阵
         * @param {module:zrender/shape/Polygon~IShapeBundleStyle} style
         * @return {module:zrender/shape/Base~IBoundingRect}
         */
        getRect: function (style) {
            if (style.__rect) {
                return style.__rect;
            }
            var minX = Infinity;
            var maxX = -Infinity;
            var minY = Infinity;
            var maxY = -Infinity;
            for (var i = 0; i < style.shapeList.length; i++) {
                var subShape = style.shapeList[i];
                // TODO Highlight style ?
                var subRect = subShape.getRect(subShape.style);

                var minX = Math.min(subRect.x, minX);
                var minY = Math.min(subRect.y, minY);
                var maxX = Math.max(subRect.x + subRect.width, maxX);
                var maxY = Math.max(subRect.y + subRect.height, maxY);
            }

            style.__rect = {
                x: minX,
                y: minY,
                width: maxX - minX,
                height: maxY - minY
            };

            return style.__rect;
        },

        isCover: function (x, y) {
            var originPos = this.transformCoordToLocal(x, y);
            x = originPos[0];
            y = originPos[1];
            
            if (this.isCoverRect(x, y)) {
                for (var i = 0; i < this.style.shapeList.length; i++) {
                    var subShape = this.style.shapeList[i];
                    if (subShape.isCover(x, y)) {
                        return true;
                    }
                }
            }

            return false;
        }
    };

    require('../tool/util').inherits(ShapeBundle, Base);
    return ShapeBundle;
}); 