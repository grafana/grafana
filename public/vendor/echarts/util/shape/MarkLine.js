/**
 * zrender
 *
 * @author Kener (@Kener-林峰, kener.linfeng@gmail.com)
 *         Yi Shen(https://github.com/pissang)
 *
 * shape类：标线
 */

/**
 * @typedef {Object} IMarkLineStyle
 * @property {number} xStart 起点x坐标
 * @property {number} yStart 起点y坐标
 * @property {number} xEnd 终止点x坐标
 * @property {number} yEnd 终止点y坐标
 * @property {number} cpX1 控制点x坐标，可以使用updatePoints自动根据curveness计算
 * @property {number} cpY1 控制点y坐标，可以使用updatePoints自动根据curveness计算
 * @property {number} curveness 曲度
 * @property {Array.<string>} symbol
 * @property {Array.<number>} symbolRotate
 */
define(function (require) {
    var Base = require('zrender/shape/Base');
    var IconShape = require('./Icon');
    var LineShape = require('zrender/shape/Line');
    var lineInstance = new LineShape({});
    var CurveShape = require('zrender/shape/BezierCurve');
    var curveInstance = new CurveShape({});

    var area = require('zrender/tool/area');
    var dashedLineTo = require('zrender/shape/util/dashedLineTo');
    var zrUtil = require('zrender/tool/util');
    var curveTool = require('zrender/tool/curve');

    function MarkLine(options) {
        Base.call(this, options);

        if (this.style.curveness > 0) {
            this.updatePoints(this.style);
        }
        if (this.highlightStyle.curveness > 0) {
            this.updatePoints(this.highlightStyle);
        }
    }

    MarkLine.prototype =  {
        type : 'mark-line',
        /**
         * 画刷
         * @param ctx 画布句柄
         * @param isHighlight   是否为高亮状态
         * @param updateCallback 让painter更新视图，base.brush没用，需要的话重载brush
         */
        brush : function (ctx, isHighlight) {
            var style = this.style;

            if (isHighlight) {
                // 根据style扩展默认高亮样式
                style = this.getHighlightStyle(
                    style,
                    this.highlightStyle || {}
                );
            }

            ctx.save();
            this.setContext(ctx, style);

            // 设置transform
            this.setTransform(ctx);

            ctx.save();
            ctx.beginPath();
            this.buildPath(ctx, style);
            ctx.stroke();
            ctx.restore();

            this.brushSymbol(ctx, style, 0);
            this.brushSymbol(ctx, style, 1);

            this.drawText(ctx, style, this.style);

            ctx.restore();
        },

        /**
         * 创建线条路径
         * @param {Context2D} ctx Canvas 2D上下文
         * @param {Object} style 样式
         */
        buildPath : function (ctx, style) {
            var lineType = style.lineType || 'solid';

            ctx.moveTo(style.xStart, style.yStart);
            if (style.curveness > 0) {
                // FIXME Bezier 在少部分浏览器上暂时不支持虚线
                var lineDash = null;
                switch (lineType) {
                    case 'dashed':
                        lineDash = [5, 5];
                        break;
                    case'dotted':
                        lineDash = [1, 1];
                        break;
                }
                if (lineDash && ctx.setLineDash) {
                    ctx.setLineDash(lineDash);
                }
                
                ctx.quadraticCurveTo(
                    style.cpX1, style.cpY1, style.xEnd, style.yEnd
                );
            }
            else {
                if (lineType == 'solid') {
                    ctx.lineTo(style.xEnd, style.yEnd);
                }
                else {
                    var dashLength = (style.lineWidth || 1) 
                        * (style.lineType == 'dashed' ? 5 : 1);
                    dashedLineTo(
                        ctx, style.xStart, style.yStart,
                        style.xEnd, style.yEnd, dashLength
                    );
                }
            }
        },

        /**
         * Update cpX1 and cpY1 according to curveniss
         * @param  {Object} style
         */
        updatePoints: function (style) {
            var curveness = style.curveness || 0;
            var inv = 1;

            var x0 = style.xStart;
            var y0 = style.yStart;
            var x2 = style.xEnd;
            var y2 = style.yEnd;
            var x1 = (x0 + x2) / 2 - inv * (y0 - y2) * curveness;
            var y1 =(y0 + y2) / 2 - inv * (x2 - x0) * curveness;

            style.cpX1 = x1;
            style.cpY1 = y1;
        },

        /**
         * 标线始末标注
         */
        brushSymbol : function (ctx, style, idx) {
            if (style.symbol[idx] == 'none') {
                return;
            }
            ctx.save();
            ctx.beginPath();

            ctx.lineWidth = style.symbolBorder;
            ctx.strokeStyle = style.symbolBorderColor;
            // symbol
            var symbol = style.symbol[idx].replace('empty', '')
                                              .toLowerCase();
            if (style.symbol[idx].match('empty')) {
                ctx.fillStyle = '#fff'; //'rgba(0, 0, 0, 0)';
            }

            // symbolRotate
            var x0 = style.xStart;
            var y0 = style.yStart;
            var x2 = style.xEnd;
            var y2 = style.yEnd;
            var x = idx === 0 ? x0 : x2;
            var y = idx === 0 ? y0 : y2;
            var curveness = style.curveness || 0;
            var rotate = style.symbolRotate[idx] != null ? (style.symbolRotate[idx] - 0) : 0;
            rotate = rotate / 180 * Math.PI;

            if (symbol == 'arrow' && rotate === 0) {
                if (curveness === 0) {
                    var sign = idx === 0 ? -1 : 1; 
                    rotate = Math.PI / 2 + Math.atan2(
                        sign * (y2 - y0), sign * (x2 - x0)
                    );
                }
                else {
                    var x1 = style.cpX1;
                    var y1 = style.cpY1;

                    var quadraticDerivativeAt = curveTool.quadraticDerivativeAt;
                    var dx = quadraticDerivativeAt(x0, x1, x2, idx);
                    var dy = quadraticDerivativeAt(y0, y1, y2, idx);

                    rotate = Math.PI / 2 + Math.atan2(dy, dx);
                }
            }
            
            ctx.translate(x, y);

            if (rotate !== 0) {
                ctx.rotate(rotate);
            }

            // symbolSize
            var symbolSize = style.symbolSize[idx];
            IconShape.prototype.buildPath(ctx, {
                x: -symbolSize,
                y: -symbolSize,
                width: symbolSize * 2,
                height: symbolSize * 2,
                iconType: symbol
            });

            ctx.closePath();
            ctx.fill();
            ctx.stroke();
            ctx.restore();
        },

        /**
         * 返回矩形区域，用于局部刷新和文字定位
         * @param {Object} style
         */
        getRect : function (style) {
            style.curveness > 0 ? curveInstance.getRect(style)
                : lineInstance.getRect(style);
            return style.__rect;
        },

        isCover : function (x, y) {
            var originPos = this.transformCoordToLocal(x, y);
            x = originPos[0];
            y = originPos[1];

            // 快速预判并保留判断矩形
            if (this.isCoverRect(x, y)) {
                // 矩形内
                return this.style.curveness > 0
                       ? area.isInside(curveInstance, this.style, x, y)
                       : area.isInside(lineInstance, this.style, x, y);
            }

            return false;
        }
    };

    zrUtil.inherits(MarkLine, Base);

    return MarkLine;
});
