/**
 * zrender
 *
 * @author Kener (@Kener-林峰, kener.linfeng@gmail.com)
 *
 * shape类：大规模散点图图形
 * 可配图形属性：
   {
       // 基础属性
       shape  : 'symbol',       // 必须，shape类标识，需要显式指定
       id     : {string},       // 必须，图形唯一标识，可通过'zrender/tool/guid'方法生成
       zlevel : {number},       // 默认为0，z层level，决定绘画在哪层canvas中
       invisible : {boolean},   // 默认为false，是否可见

       // 样式属性，默认状态样式样式属性
       style  : {
           pointList     : {Array},   // 必须，二维数组，二维内容如下
               x         : {number},  // 必须，横坐标
               y         : {number},  // 必须，纵坐标数组
               size      : {number},  // 必须，半宽
               type      : {string=}, // 默认为'circle',图形类型
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
    var Base = require('zrender/shape/Base');
    var PolygonShape = require('zrender/shape/Polygon');
    var polygonInstance = new PolygonShape({});
    var zrUtil = require('zrender/tool/util');

    function Symbol(options) {
        Base.call(this, options);
    }

    Symbol.prototype =  {
        type : 'symbol',
        /**
         * 创建矩形路径
         * @param {Context2D} ctx Canvas 2D上下文
         * @param {Object} style 样式
         */
        buildPath : function (ctx, style) {
            var pointList = style.pointList;
            var len = pointList.length;
            if (len === 0) {
                return;
            }

            var subSize = 10000;
            var subSetLength = Math.ceil(len / subSize);
            var sub;
            var subLen;
            var isArray = pointList[0] instanceof Array;
            var size = style.size ? style.size : 2;
            var curSize = size;
            var halfSize = size / 2;
            var PI2 = Math.PI * 2;
            var percent;
            var x;
            var y;
            for (var j = 0; j < subSetLength; j++) {
                ctx.beginPath();
                sub = j * subSize;
                subLen = sub + subSize;
                subLen = subLen > len ? len : subLen;
                for (var i = sub; i < subLen; i++) {
                    if (style.random) {
                        percent = style['randomMap' + (i % 20)] / 100;
                        curSize = size * percent * percent;
                        halfSize = curSize / 2;
                    }
                    if (isArray) {
                        x = pointList[i][0];
                        y = pointList[i][1];
                    }
                    else {
                        x = pointList[i].x;
                        y = pointList[i].y;
                    }
                    if (curSize < 3) {
                        // 小于3像素视觉误差
                        ctx.rect(x - halfSize, y - halfSize, curSize, curSize);
                    }
                    else {
                        // 大于3像素才考虑图形
                        switch (style.iconType) {
                            case 'circle' :
                                ctx.moveTo(x, y);
                                ctx.arc(x, y, halfSize, 0, PI2, true);
                                break;
                            case 'diamond' :
                                ctx.moveTo(x, y - halfSize);
                                ctx.lineTo(x + halfSize / 3, y - halfSize / 3);
                                ctx.lineTo(x + halfSize, y);
                                ctx.lineTo(x + halfSize / 3, y + halfSize / 3);
                                ctx.lineTo(x, y + halfSize);
                                ctx.lineTo(x - halfSize / 3, y + halfSize / 3);
                                ctx.lineTo(x - halfSize, y);
                                ctx.lineTo(x - halfSize / 3, y - halfSize / 3);
                                ctx.lineTo(x, y - halfSize);
                                break;
                            default :
                                ctx.rect(x - halfSize, y - halfSize, curSize, curSize);
                        }
                    }
                }
                ctx.closePath();
                if (j < (subSetLength - 1)) {
                    switch (style.brushType) {
                        case 'both':
                            ctx.fill();
                            style.lineWidth > 0 && ctx.stroke();  // js hint -_-"
                            break;
                        case 'stroke':
                            style.lineWidth > 0 && ctx.stroke();
                            break;
                        default:
                            ctx.fill();
                    }
                }
            }
        },

        /* 像素模式
        buildPath : function (ctx, style) {
            var pointList = style.pointList;
            var rect = this.getRect(style);
            var ratio = window.devicePixelRatio || 1;
            // console.log(rect)
            // var ti = new Date();
            // bbox取整
            rect = {
                x : Math.floor(rect.x),
                y : Math.floor(rect.y),
                width : Math.floor(rect.width),
                height : Math.floor(rect.height)
            };
            var pixels = ctx.getImageData(
                rect.x * ratio, rect.y * ratio,
                rect.width * ratio, rect.height * ratio
            );
            var data = pixels.data;
            var idx;
            var zrColor = require('zrender/tool/color');
            var color = zrColor.toArray(style.color);
            var r = color[0];
            var g = color[1];
            var b = color[2];
            var width = rect.width;

            for (var i = 1, l = pointList.length; i < l; i++) {
                idx = ((Math.floor(pointList[i][0]) - rect.x) * ratio
                       + (Math.floor(pointList[i][1])- rect.y) * width * ratio * ratio
                      ) * 4;
                data[idx] = r;
                data[idx + 1] = g;
                data[idx + 2] = b;
                data[idx + 3] = 255;
            }
            ctx.putImageData(pixels, rect.x * ratio, rect.y * ratio);
            // console.log(new Date() - ti);
            return;
        },
        */

        /**
         * 返回矩形区域，用于局部刷新和文字定位
         * @param {Object} style
         */
        getRect : function (style) {
            return style.__rect || polygonInstance.getRect(style);
        },

        isCover : require('./normalIsCover')
    };

    zrUtil.inherits(Symbol, Base);

    return Symbol;
});
