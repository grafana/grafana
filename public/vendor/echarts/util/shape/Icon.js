/**
 * echarts扩展zrender shape
 *
 * @author Kener (@Kener-林峰, kener.linfeng@gmail.com)
 *
 * shape类：icon
 * 可配图形属性：
   {
       // 基础属性
       shape  : 'icon',       // 必须，shape类标识，需要显式指定
       id     : {string},       // 必须，图形唯一标识，可通过'zrender/tool/guid'方法生成
       zlevel : {number},       // 默认为0，z层level，决定绘画在哪层canvas中
       invisible : {boolean},   // 默认为false，是否可见

       // 样式属性，默认状态样式样式属性
       style  : {
           x             : {number},  // 必须，左上角横坐标
           y             : {number},  // 必须，左上角纵坐标
           width         : {number},  // 必须，宽度
           height        : {number},  // 必须，高度
           iconType      : {string},  // 必须，icon类型
       },

       // 样式属性，高亮样式属性，当不存在highlightStyle时使用基于默认样式扩展显示
       highlightStyle : {
           // 同style
       }

       // 交互属性，详见shape.Base

       // 事件属性，详见shape.Base
   }
 */
define(function (require) {
    var zrUtil = require('zrender/tool/util');
    
    function _iconMark(ctx, style) {
        var x = style.x;
        var y = style.y;
        var dx = style.width / 16;
        var dy = style.height / 16;
        ctx.moveTo(x,                 y + style.height);
        ctx.lineTo(x + 5 * dx,        y + 14 * dy);
        ctx.lineTo(x + style.width,   y + 3 * dy);
        ctx.lineTo(x + 13 * dx,       y);
        ctx.lineTo(x + 2 * dx,        y + 11 * dy);
        ctx.lineTo(x,                 y + style.height);

        ctx.moveTo(x + 6 * dx,        y + 10 * dy);
        ctx.lineTo(x + 14 * dx,       y + 2 * dy);

        ctx.moveTo(x + 10 * dx,       y + 13 * dy);
        ctx.lineTo(x + style.width,   y + 13 * dy);

        ctx.moveTo(x + 13 * dx,       y + 10 * dy);
        ctx.lineTo(x + 13 * dx,       y + style.height);
    }

    function _iconMarkUndo(ctx, style) {
        var x = style.x;
        var y = style.y;
        var dx = style.width / 16;
        var dy = style.height / 16;
        ctx.moveTo(x,                 y + style.height);
        ctx.lineTo(x + 5 * dx,        y + 14 * dy);
        ctx.lineTo(x + style.width,   y + 3 * dy);
        ctx.lineTo(x + 13 * dx,       y);
        ctx.lineTo(x + 2 * dx,        y + 11 * dy);
        ctx.lineTo(x,                 y + style.height);

        ctx.moveTo(x + 6 * dx,        y + 10 * dy);
        ctx.lineTo(x + 14 * dx,       y + 2 * dy);

        ctx.moveTo(x + 10 * dx,       y + 13 * dy);
        ctx.lineTo(x + style.width,   y + 13 * dy);
    }

    function _iconMarkClear(ctx, style) {
        var x = style.x;
        var y = style.y;
        var dx = style.width / 16;
        var dy = style.height / 16;

        ctx.moveTo(x + 4 * dx,        y + 15 * dy);
        ctx.lineTo(x + 9 * dx,        y + 13 * dy);
        ctx.lineTo(x + 14 * dx,       y + 8 * dy);
        ctx.lineTo(x + 11 * dx,       y + 5 * dy);
        ctx.lineTo(x + 6 * dx,        y + 10 * dy);
        ctx.lineTo(x + 4 * dx,        y + 15 * dy);

        ctx.moveTo(x + 5 * dx,        y);
        ctx.lineTo(x + 11 * dx,       y);
        ctx.moveTo(x + 5 * dx,        y + dy);
        ctx.lineTo(x + 11 * dx,       y + dy);
        ctx.moveTo(x,                 y + 2 * dy);
        ctx.lineTo(x + style.width,   y + 2 * dy);

        ctx.moveTo(x,                 y + 5 * dy);
        ctx.lineTo(x + 3 * dx,        y + style.height);
        ctx.lineTo(x + 13 * dx,       y + style.height);
        ctx.lineTo(x + style.width,   y + 5 * dy);
    }

    function _iconDataZoom(ctx, style) {
        var x = style.x;
        var y = style.y;
        var dx = style.width / 16;
        var dy = style.height / 16;

        ctx.moveTo(x,               y + 3 * dy);
        ctx.lineTo(x + 6 * dx,      y + 3 * dy);
        
        ctx.moveTo(x + 3 * dx,      y);
        ctx.lineTo(x + 3 * dx,      y + 6 * dy);

        ctx.moveTo(x + 3 * dx,      y + 8 * dy);
        ctx.lineTo(x + 3 * dx,      y + style.height);
        ctx.lineTo(x + style.width, y + style.height);
        ctx.lineTo(x + style.width, y + 3 * dy);
        ctx.lineTo(x + 8 * dx,      y + 3 * dy);
    }
    
    function _iconDataZoomReset(ctx, style) {
        var x = style.x;
        var y = style.y;
        var dx = style.width / 16;
        var dy = style.height / 16;

        ctx.moveTo(x + 6 * dx,      y);
        ctx.lineTo(x + 2 * dx,      y + 3 * dy);
        ctx.lineTo(x + 6 * dx,      y + 6 * dy);
        
        ctx.moveTo(x + 2 * dx,      y + 3 * dy);
        ctx.lineTo(x + 14 * dx,     y + 3 * dy);
        ctx.lineTo(x + 14 * dx,     y + 11 * dy);
        
        ctx.moveTo(x + 2 * dx,      y + 5 * dy);
        ctx.lineTo(x + 2 * dx,      y + 13 * dy);
        ctx.lineTo(x + 14 * dx,     y + 13 * dy);
        
        ctx.moveTo(x + 10 * dx,     y + 10 * dy);
        ctx.lineTo(x + 14 * dx,     y + 13 * dy);
        ctx.lineTo(x + 10 * dx,     y + style.height);
    }
    
    function _iconRestore(ctx, style) {
        var x = style.x;
        var y = style.y;
        var dx = style.width / 16;
        var dy = style.height / 16;
        var r = style.width / 2;
        
        ctx.lineWidth = 1.5;

        ctx.arc(x + r, y + r, r - dx, 0, Math.PI * 2 / 3);
        ctx.moveTo(x + 3 * dx,        y + style.height);
        ctx.lineTo(x + 0 * dx,        y + 12 * dy);
        ctx.lineTo(x + 5 * dx,        y + 11 * dy);

        ctx.moveTo(x, y + 8 * dy);
        ctx.arc(x + r, y + r, r - dx, Math.PI, Math.PI * 5 / 3);
        ctx.moveTo(x + 13 * dx,       y);
        ctx.lineTo(x + style.width,   y + 4 * dy);
        ctx.lineTo(x + 11 * dx,       y + 5 * dy);
    }

    function _iconLineChart(ctx, style) {
        var x = style.x;
        var y = style.y;
        var dx = style.width / 16;
        var dy = style.height / 16;

        ctx.moveTo(x, y);
        ctx.lineTo(x, y + style.height);
        ctx.lineTo(x + style.width, y + style.height);

        ctx.moveTo(x + 2 * dx,    y + 14 * dy);
        ctx.lineTo(x + 7 * dx,    y + 6 * dy);
        ctx.lineTo(x + 11 * dx,   y + 11 * dy);
        ctx.lineTo(x + 15 * dx,   y + 2 * dy);
    }

    function _iconBarChart(ctx, style) {
        var x = style.x;
        var y = style.y;
        var dx = style.width / 16;
        var dy = style.height / 16;

        ctx.moveTo(x, y);
        ctx.lineTo(x, y + style.height);
        ctx.lineTo(x + style.width, y + style.height);

        ctx.moveTo(x + 3 * dx,        y + 14 * dy);
        ctx.lineTo(x + 3 * dx,        y + 6 * dy);
        ctx.lineTo(x + 4 * dx,        y + 6 * dy);
        ctx.lineTo(x + 4 * dx,        y + 14 * dy);
        ctx.moveTo(x + 7 * dx,        y + 14 * dy);
        ctx.lineTo(x + 7 * dx,        y + 2 * dy);
        ctx.lineTo(x + 8 * dx,        y + 2 * dy);
        ctx.lineTo(x + 8 * dx,        y + 14 * dy);
        ctx.moveTo(x + 11 * dx,       y + 14 * dy);
        ctx.lineTo(x + 11 * dx,       y + 9 * dy);
        ctx.lineTo(x + 12 * dx,       y + 9 * dy);
        ctx.lineTo(x + 12 * dx,       y + 14 * dy);
    }
    
    function _iconPieChart(ctx, style) {
        var x = style.x;
        var y = style.y;
        var width = style.width - 2;
        var height = style.height - 2;
        var r = Math.min(width, height) / 2;
        y += 2;
        ctx.moveTo(x + r + 3, y + r - 3);
        ctx.arc(x + r + 3, y + r - 3, r - 1, 0, -Math.PI / 2, true);
        ctx.lineTo(x + r + 3, y + r - 3);
      
        ctx.moveTo(x + r, y);
        ctx.lineTo(x + r, y + r);
        ctx.arc(x + r, y + r, r, -Math.PI / 2, Math.PI * 2, true);
        ctx.lineTo(x + r, y + r);
        ctx.lineWidth = 1.5;
    }
    
    function _iconFunnelChart(ctx, style) {
        var x = style.x;
        var y = style.y;
        var dx = style.width / 16;
        var dy = style.height / 16;
        y -= dy;
        ctx.moveTo(x + 1 * dx,      y + 2 * dy);
        ctx.lineTo(x + 15 * dx,     y + 2 * dy);
        ctx.lineTo(x + 14 * dx,     y + 3 * dy);
        ctx.lineTo(x + 2 * dx,      y + 3 * dy);
        
        ctx.moveTo(x + 3 * dx,      y + 6 * dy);
        ctx.lineTo(x + 13 * dx,     y + 6 * dy);
        ctx.lineTo(x + 12 * dx,     y + 7 * dy);
        ctx.lineTo(x + 4 * dx,      y + 7 * dy);
        
        ctx.moveTo(x + 5 * dx,      y + 10 * dy);
        ctx.lineTo(x + 11 * dx,      y + 10 * dy);
        ctx.lineTo(x + 10 * dx,      y + 11 * dy);
        ctx.lineTo(x + 6 * dx,      y + 11 * dy);
        
        ctx.moveTo(x + 7 * dx,      y + 14 * dy);
        ctx.lineTo(x + 9 * dx,      y + 14 * dy);
        ctx.lineTo(x + 8 * dx,      y + 15 * dy);
        ctx.lineTo(x + 7 * dx,      y + 15 * dy);
    }
    
    function _iconForceChart(ctx, style) {
        var x = style.x;
        var y = style.y;
        var width = style.width;
        var height = style.height;
        var dx = width / 16;
        var dy = height / 16;
        var r = Math.min(dx, dy) * 2;

        ctx.moveTo(x + dx + r, y + dy + r);
        ctx.arc(x + dx, y + dy, r, Math.PI / 4, Math.PI * 3);
        
        ctx.lineTo(x + 7 * dx - r, y + 6 * dy - r);
        ctx.arc(x + 7 * dx, y + 6 * dy, r, Math.PI / 4 * 5, Math.PI * 4);
        ctx.arc(x + 7 * dx, y + 6 * dy, r / 2, Math.PI / 4 * 5, Math.PI * 4);
        
        ctx.moveTo(x + 7 * dx - r / 2, y + 6 * dy + r);
        ctx.lineTo(x + dx + r, y + 14 * dy - r);
        ctx.arc(x + dx, y + 14 * dy, r, -Math.PI / 4, Math.PI * 2);
        
        ctx.moveTo(x + 7 * dx + r / 2, y + 6 * dy);
        ctx.lineTo(x + 14 * dx - r, y + 10 * dy - r / 2);
        ctx.moveTo(x + 16 * dx, y + 10 * dy);
        ctx.arc(x + 14 * dx, y + 10 * dy, r, 0, Math.PI * 3);
        ctx.lineWidth = 1.5;
    }
    
    function _iconChordChart(ctx, style) {
        var x = style.x;
        var y = style.y;
        var width = style.width;
        var height = style.height;
        var r = Math.min(width, height) / 2;

        ctx.moveTo(x + width, y + height / 2);
        ctx.arc(x + r, y + r, r, 0, Math.PI * 2);
        
        ctx.arc(x + r, y, r, Math.PI / 4, Math.PI / 5 * 4);
        ctx.arc(x, y + r, r, -Math.PI / 3, Math.PI / 3);
        ctx.arc(x + width, y + height, r, Math.PI, Math.PI / 2 * 3);
        ctx.lineWidth = 1.5;
    }

    function _iconStackChart(ctx, style) {
        var x = style.x;
        var y = style.y;
        var width = style.width;
        var height = style.height;
        var dy = Math.round(height / 3);
        var delta = Math.round((dy - 2) / 2);
        var len = 3;
        while (len--) {
            ctx.rect(x, y + dy * len + delta, width, 2);
        }
    }
    
    function _iconTiledChart(ctx, style) {
        var x = style.x;
        var y = style.y;
        var width = style.width;
        var height = style.height;
        var dx = Math.round(width / 3);
        var delta = Math.round((dx - 2) / 2);
        var len = 3;
        while (len--) {
            ctx.rect(x + dx * len + delta, y, 2, height);
        }
    }
    
    function _iconDataView(ctx, style) {
        var x = style.x;
        var y = style.y;
        var dx = style.width / 16;

        ctx.moveTo(x + dx, y);
        ctx.lineTo(x + dx, y + style.height);
        ctx.lineTo(x + 15 * dx, y + style.height);
        ctx.lineTo(x + 15 * dx, y);
        ctx.lineTo(x + dx, y);

        ctx.moveTo(x + 3 * dx, y + 3 * dx);
        ctx.lineTo(x + 13 * dx, y + 3 * dx);

        ctx.moveTo(x + 3 * dx, y + 6 * dx);
        ctx.lineTo(x + 13 * dx, y + 6 * dx);

        ctx.moveTo(x + 3 * dx, y + 9 * dx);
        ctx.lineTo(x + 13 * dx, y + 9 * dx);

        ctx.moveTo(x + 3 * dx, y + 12 * dx);
        ctx.lineTo(x + 9 * dx, y + 12 * dx);
    }
    
    function _iconSave(ctx, style) {
        var x = style.x;
        var y = style.y;
        var dx = style.width / 16;
        var dy = style.height / 16;

        ctx.moveTo(x, y);
        ctx.lineTo(x, y + style.height);
        ctx.lineTo(x + style.width, y + style.height);
        ctx.lineTo(x + style.width, y);
        ctx.lineTo(x, y);

        ctx.moveTo(x + 4 * dx,    y);
        ctx.lineTo(x + 4 * dx,    y + 8 * dy);
        ctx.lineTo(x + 12 * dx,   y + 8 * dy);
        ctx.lineTo(x + 12 * dx,   y);
        
        ctx.moveTo(x + 6 * dx,    y + 11 * dy);
        ctx.lineTo(x + 6 * dx,    y + 13 * dy);
        ctx.lineTo(x + 10 * dx,   y + 13 * dy);
        ctx.lineTo(x + 10 * dx,   y + 11 * dy);
        ctx.lineTo(x + 6 * dx,    y + 11 * dy);
    }
    
    function _iconCross(ctx, style) {
        var x = style.x;
        var y = style.y;
        var width = style.width;
        var height = style.height;
        ctx.moveTo(x, y + height / 2);
        ctx.lineTo(x + width, y + height / 2);
        
        ctx.moveTo(x + width / 2, y);
        ctx.lineTo(x + width / 2, y + height);
    }
    
    function _iconCircle(ctx, style) {
        var width = style.width / 2;
        var height = style.height / 2;
        var r = Math.min(width, height);
        ctx.moveTo(
            style.x + width + r, 
            style.y + height
        );
        ctx.arc(
            style.x + width, 
            style.y + height, 
            r,
            0, 
            Math.PI * 2
        );
        ctx.closePath();
    }
    
    function _iconRectangle(ctx, style) {
        ctx.rect(style.x, style.y, style.width, style.height);
        ctx.closePath();
    }
    
    function _iconTriangle(ctx, style) {
        var width = style.width / 2;
        var height = style.height / 2;
        var x = style.x + width;
        var y = style.y + height;
        var symbolSize = Math.min(width, height);
        ctx.moveTo(x, y - symbolSize);
        ctx.lineTo(x + symbolSize, y + symbolSize);
        ctx.lineTo(x - symbolSize, y + symbolSize);
        ctx.lineTo(x, y - symbolSize);
        ctx.closePath();
    }
    
    function _iconDiamond(ctx, style) {
        var width = style.width / 2;
        var height = style.height / 2;
        var x = style.x + width;
        var y = style.y + height;
        var symbolSize = Math.min(width, height);
        ctx.moveTo(x, y - symbolSize);
        ctx.lineTo(x + symbolSize, y);
        ctx.lineTo(x, y + symbolSize);
        ctx.lineTo(x - symbolSize, y);
        ctx.lineTo(x, y - symbolSize);
        ctx.closePath();
    }
    
    function _iconArrow(ctx, style) {
        var x = style.x;
        var y = style.y;
        var dx = style.width / 16;
        ctx.moveTo(x + 8 * dx,  y);
        ctx.lineTo(x + dx,      y + style.height);
        ctx.lineTo(x + 8 * dx,  y + style.height / 4 * 3);
        ctx.lineTo(x + 15 * dx, y + style.height);
        ctx.lineTo(x + 8 * dx,  y);
        ctx.closePath();
    }
    
    function _iconStar(ctx, style) {
        var StarShape = require('zrender/shape/Star');
        var width = style.width / 2;
        var height = style.height / 2;
        StarShape.prototype.buildPath(ctx, {
            x : style.x + width,
            y : style.y + height,
            r : Math.min(width, height),
            n : style.n || 5
        });
    }
    
    function _iconHeart(ctx, style) {
        var HeartShape = require('zrender/shape/Heart');
        HeartShape.prototype.buildPath(ctx, {
            x : style.x + style.width / 2,
            y : style.y + style.height * 0.2,
            a : style.width / 2,
            b : style.height * 0.8
        });
    }
    
    function _iconDroplet(ctx, style) {
        var DropletShape = require('zrender/shape/Droplet');
        DropletShape.prototype.buildPath(ctx, {
            x : style.x + style.width * 0.5,
            y : style.y + style.height * 0.5,
            a : style.width * 0.5,
            b : style.height * 0.8
        });
    }
    
    function _iconPin(ctx, style) {
        var x = style.x;
        var y = style.y - style.height / 2 * 1.5;
        var width = style.width / 2;
        var height = style.height / 2;
        var r = Math.min(width, height);
        ctx.arc(
            x + width, 
            y + height, 
            r,
            Math.PI / 5 * 4, 
            Math.PI / 5
        );
        ctx.lineTo(x + width, y + height + r * 1.5);
        ctx.closePath();
    }
    
    function _iconImage(ctx, style, refreshNextFrame) {
        var ImageShape = require('zrender/shape/Image');
        this._imageShape = this._imageShape || new ImageShape({
            style: {}
        });
        for (var name in style) {
            this._imageShape.style[name] = style[name];
        }
        this._imageShape.brush(ctx, false, refreshNextFrame);
    }
    
    var Base = require('zrender/shape/Base');
    
    function Icon(options) {
        Base.call(this, options);
    }

    Icon.prototype =  {
        type : 'icon',
        iconLibrary : {
            mark : _iconMark,
            markUndo : _iconMarkUndo,
            markClear : _iconMarkClear,
            dataZoom : _iconDataZoom,
            dataZoomReset : _iconDataZoomReset,
            restore : _iconRestore,
            lineChart : _iconLineChart,
            barChart : _iconBarChart,
            pieChart : _iconPieChart,
            funnelChart : _iconFunnelChart,
            forceChart : _iconForceChart,
            chordChart : _iconChordChart,
            stackChart : _iconStackChart,
            tiledChart : _iconTiledChart,
            dataView : _iconDataView,
            saveAsImage : _iconSave,
            
            cross : _iconCross,
            circle : _iconCircle,
            rectangle : _iconRectangle,
            triangle : _iconTriangle,
            diamond : _iconDiamond,
            arrow : _iconArrow,
            star : _iconStar,
            heart : _iconHeart,
            droplet : _iconDroplet,
            pin : _iconPin,
            image : _iconImage
        },
        brush: function (ctx, isHighlight, refreshNextFrame) {
            var style = isHighlight ? this.highlightStyle : this.style;
            style = style || {};
            var iconType = style.iconType || this.style.iconType;
            if (iconType === 'image') {
                var ImageShape = require('zrender/shape/Image');
                ImageShape.prototype.brush.call(this, ctx, isHighlight, refreshNextFrame);

            } else {

                var style = this.beforeBrush(ctx, isHighlight);

                ctx.beginPath();
                this.buildPath(ctx, style, refreshNextFrame);

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
            }
        },
        /**
         * 创建矩形路径
         * @param {Context2D} ctx Canvas 2D上下文
         * @param {Object} style 样式
         */
        buildPath : function (ctx, style, refreshNextFrame) {
            if (this.iconLibrary[style.iconType]) {
                this.iconLibrary[style.iconType].call(this, ctx, style, refreshNextFrame);
            }
            else {
                ctx.moveTo(style.x, style.y);
                ctx.lineTo(style.x + style.width, style.y);
                ctx.lineTo(style.x + style.width, style.y + style.height);
                ctx.lineTo(style.x, style.y + style.height);
                ctx.lineTo(style.x, style.y);
                ctx.closePath();
            }

            return;
        },

        /**
         * 返回矩形区域，用于局部刷新和文字定位
         * @param {Object} style
         */
        getRect : function (style) {
            if (style.__rect) {
                return style.__rect;
            }
            
            // pin比较特殊，让尖端在目标x,y上
            style.__rect = {
                x : Math.round(style.x),
                y : Math.round(style.y - (style.iconType == 'pin' 
                                         ? (style.height / 2 * 1.5) : 0)
                               ),
                width : style.width,
                height : style.height * (
                    style.iconType === 'pin' ? 1.25 : 1
                )
            };
            
            return style.__rect;
        },

        isCover : function (x, y) {
            var originPos = this.transformCoordToLocal(x, y);
            x = originPos[0];
            y = originPos[1];

            // 快速预判并保留判断矩形
            var rect = this.style.__rect;
            if (!rect) {
                rect = this.style.__rect = this.getRect(this.style);
            }
            // 提高交互体验，太小的图形包围盒四向扩大4px
            var delta = (rect.height < 8 || rect.width < 8 ) ? 4 : 0;
            return x >= rect.x - delta
                && x <= (rect.x + rect.width + delta)
                && y >= rect.y - delta
                && y <= (rect.y + rect.height + delta);
        }
    };

    zrUtil.inherits(Icon, Base);
    
    return Icon;
});