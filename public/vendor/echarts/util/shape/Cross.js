/**
 * zrender
 *
 * @author Kener (@Kener-林峰, kener.linfeng@gmail.com)
 *
 * shape类：十字准星
 * 可配图形属性：
   {
       // 基础属性
       shape  : 'cross',       // 必须，shape类标识，需要显式指定
       id     : {string},       // 必须，图形唯一标识，可通过'zrender/tool/guid'方法生成
       zlevel : {number},       // 默认为0，z层level，决定绘画在哪层canvas中
       invisible : {boolean},   // 默认为false，是否可见

       // 样式属性，默认状态样式样式属性
       style  : {
           rect      : {Object},  // 必须，对角框
           x         : {number},  // 必须，横坐标
           y         : {number},  // 必须，纵坐标
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
    var LineShape = require('zrender/shape/Line');
    var zrUtil = require('zrender/tool/util');

    function Cross(options) {
        Base.call(this, options);
    }

    Cross.prototype =  {
        type : 'cross',

        /**
         * 创建矩形路径
         * @param {Context2D} ctx Canvas 2D上下文
         * @param {Object} style 样式
         */
        buildPath : function (ctx, style) {
            var rect = style.rect;
            style.xStart = rect.x;
            style.xEnd = rect.x + rect.width;
            style.yStart = style.yEnd = style.y;
            LineShape.prototype.buildPath(ctx, style);
            style.xStart = style.xEnd = style.x;
            style.yStart = rect.y;
            style.yEnd = rect.y + rect.height;
            LineShape.prototype.buildPath(ctx, style);
        },

        /**
         * 返回矩形区域，用于局部刷新和文字定位
         * @param {Object} style
         */
        getRect : function (style) {
            return style.rect;
        },

        isCover : require('./normalIsCover')
    };

    zrUtil.inherits(Cross, Base);

    return Cross;
});
