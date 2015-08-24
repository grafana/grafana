/**
 * zrender
 *
 * @author Kener (@Kener-林峰, kener.linfeng@gmail.com)
 *
 * shape类：handlePolygon，dataRange手柄
 */
define(function (require) {
    var Base = require('zrender/shape/Base');
    var PolygonShape = require('zrender/shape/Polygon');
    var zrUtil = require('zrender/tool/util');

    function HandlePolygon(options) {
        Base.call(this, options);
    }

    HandlePolygon.prototype = {
        type : 'handle-polygon',
        /**
         * 创建多边形路径
         * @param {Context2D} ctx Canvas 2D上下文
         * @param {Object} style 样式
         */
        buildPath : function (ctx, style) {
            PolygonShape.prototype.buildPath(
                ctx, style
            );
        },
        isCover : function (x, y) {
            var originPos = this.transformCoordToLocal(x, y);
            x = originPos[0];
            y = originPos[1];

            // 不能缓存rect！
            var rect = this.style.rect;
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
    zrUtil.inherits(HandlePolygon, Base);

    return HandlePolygon;
});
