/**
 * zrender
 *
 * @author Kener (@Kener-林峰, kener.linfeng@gmail.com)
 *
 * shape类：蜡烛
 * 可配图形属性：
   {
       // 基础属性
       shape  : 'candle',       // 必须，shape类标识，需要显式指定
       id     : {string},       // 必须，图形唯一标识，可通过'zrender/tool/guid'方法生成
       zlevel : {number},       // 默认为0，z层level，决定绘画在哪层canvas中
       invisible : {boolean},   // 默认为false，是否可见

       // 样式属性，默认状态样式样式属性
       style  : {
           x             : {number},  // 必须，横坐标
           y             : {Array},   // 必须，纵坐标数组
       },

       // 样式属性，高亮样式属性，当不存在highlightStyle时使用基于默认样式扩展显示
       highlightStyle : {
           // 同style
       }

       // 交互属性，详见shape.Base

       // 事件属性，详见shape.Base
   }
         例子：
   {
       shape  : 'candle',
       id     : '123456',
       zlevel : 1,
       style  : {
           x : 200,
           y : [100,123,90,125],
           width : 150,
           color : '#eee',
           text : 'Baidu'
       },
       myName : 'kener',  // 可自带任何有效自定义属性

       clickable : true,
       onClick : function (eventPacket) {
           alert(eventPacket.target.myName);
       }
   }
 */
define(function (require) {
    var Base = require('zrender/shape/Base');
    var zrUtil = require('zrender/tool/util');

    function Candle(options) {
        Base.call(this, options);
    }

    Candle.prototype =  {
        type: 'candle',
        _numberOrder : function (a, b) {
            return b - a;
        },

        /**
         * 创建矩形路径
         * @param {Context2D} ctx Canvas 2D上下文
         * @param {Object} style 样式
         */
        buildPath : function (ctx, style) {
            var yList = zrUtil.clone(style.y).sort(this._numberOrder);

            ctx.moveTo(style.x, yList[3]);
            ctx.lineTo(style.x, yList[2]);
            ctx.moveTo(style.x - style.width / 2, yList[2]);
            ctx.rect(
                style.x - style.width / 2,
                yList[2],
                style.width,
                yList[1] - yList[2]
            );
            ctx.moveTo(style.x, yList[1]);
            ctx.lineTo(style.x, yList[0]);
        },

        /**
         * 返回矩形区域，用于局部刷新和文字定位
         * @param {Object} style
         */
        getRect : function (style) {
            if (!style.__rect) {
                var lineWidth = 0;
                if (style.brushType == 'stroke' || style.brushType == 'fill') {
                    lineWidth = style.lineWidth || 1;
                }

                var yList = zrUtil.clone(style.y).sort(this._numberOrder);
                style.__rect = {
                    x : Math.round(style.x - style.width / 2 - lineWidth / 2),
                    y : Math.round(yList[3] - lineWidth / 2),
                    width : style.width + lineWidth,
                    height : yList[0] - yList[3] + lineWidth
                };
            }

            return style.__rect;
        },


        isCover : require('./normalIsCover')
    };

    zrUtil.inherits(Candle, Base);

    return Candle;
});
