/**
 * zrender
 *
 * @author Kener (@Kener-林峰, kener.linfeng@gmail.com)
 *
 * shape类：时间轴线
 */
define(function (require) {
    var Base = require('zrender/shape/Base');
    var IconShape = require('./Icon');

    var dashedLineTo = require('zrender/shape/util/dashedLineTo');
    var zrUtil = require('zrender/tool/util');
    var matrix = require('zrender/tool/matrix');

    function Chain(options) {
        Base.call(this, options);
    }

    Chain.prototype =  {
        type : 'chain',

        /**
         * 画刷
         * @param ctx       画布句柄
         * @param e         形状实体
         * @param isHighlight   是否为高亮状态
         * @param updateCallback 需要异步加载资源的shape可以通过这个callback(e)
         *                       让painter更新视图，base.brush没用，需要的话重载brush
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
            this.buildLinePath(ctx, style);
            ctx.stroke();
            ctx.restore();
            
            this.brushSymbol(ctx, style);

            ctx.restore();
            return;
        },

        /**
         * 创建线条路径
         * @param {Context2D} ctx Canvas 2D上下文
         * @param {Object} style 样式
         */
        buildLinePath : function (ctx, style) {
            var x = style.x;
            var y = style.y + 5;
            var width = style.width;
            var height = style.height / 2 - 10;

            ctx.moveTo(x, y);
            ctx.lineTo(x, y + height);
            ctx.moveTo(x + width, y);
            ctx.lineTo(x + width, y + height);

            ctx.moveTo(x, y + height / 2);
            if (!style.lineType || style.lineType == 'solid') {
                ctx.lineTo(x + width, y + height / 2);
            }
            else if (style.lineType == 'dashed' || style.lineType == 'dotted') {
                var dashLength = (style.lineWidth || 1)
                             * (style.lineType == 'dashed' ? 5 : 1);
                dashedLineTo(ctx, x, y + height / 2, x + width, y + height / 2, dashLength);
            }
        },

        /**
         * 标线始末标注
         */
        brushSymbol : function (ctx, style) {
            var y = style.y + style.height / 4;
            ctx.save();

            var chainPoint = style.chainPoint;
            var curPoint;
            for (var idx = 0, l = chainPoint.length; idx < l; idx++) {
                curPoint = chainPoint[idx];
                if (curPoint.symbol != 'none') {
                    ctx.beginPath();
                    var symbolSize = curPoint.symbolSize;
                    IconShape.prototype.buildPath(
                        ctx,
                        {
                            iconType : curPoint.symbol,
                            x : curPoint.x - symbolSize,
                            y : y - symbolSize,
                            width : symbolSize * 2,
                            height : symbolSize * 2,
                            n : curPoint.n
                        }
                    );
                    ctx.fillStyle = curPoint.isEmpty ? '#fff' : style.strokeColor;
                    ctx.closePath();
                    ctx.fill();
                    ctx.stroke();
                }

                if (curPoint.showLabel) {
                    ctx.font = curPoint.textFont;
                    ctx.fillStyle = curPoint.textColor;
                    ctx.textAlign = curPoint.textAlign;
                    ctx.textBaseline = curPoint.textBaseline;
                    if (curPoint.rotation) {
                        ctx.save();
                        this._updateTextTransform(ctx, curPoint.rotation);
                        ctx.fillText(curPoint.name, curPoint.textX, curPoint.textY);
                        ctx.restore();
                    }
                    else {
                        ctx.fillText(curPoint.name, curPoint.textX, curPoint.textY);
                    }
                }
            }

            ctx.restore();
        },

        _updateTextTransform : function (ctx, rotation) {
            var _transform = matrix.create();
            matrix.identity(_transform);

            if (rotation[0] !== 0) {
                var originX = rotation[1] || 0;
                var originY = rotation[2] || 0;
                if (originX || originY) {
                    matrix.translate(
                        _transform, _transform, [-originX, -originY]
                    );
                }
                matrix.rotate(_transform, _transform, rotation[0]);
                if (originX || originY) {
                    matrix.translate(
                        _transform, _transform, [originX, originY]
                    );
                }
            }

            // 保存这个变换矩阵
            ctx.transform.apply(ctx, _transform);
        },

        isCover : function (x, y) {
            var rect = this.style;
            if (x >= rect.x
                && x <= (rect.x + rect.width)
                && y >= rect.y
                && y <= (rect.y + rect.height)
            ) {
                // 矩形内
                return true;
            }
            else {
                return false;
            }
        }
    };

    zrUtil.inherits(Chain, Base);

    return Chain;
});
