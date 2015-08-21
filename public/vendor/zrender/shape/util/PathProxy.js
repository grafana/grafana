/**
 * Path 代理，可以在`buildPath`中用于替代`ctx`, 会保存每个path操作的命令到pathCommands属性中
 * 可以用于 isInsidePath 判断以及获取boundingRect
 * 
 * @module zrender/shape/tool/PathProxy
 * @author pissang (http://www.github.com/pissang)
 * 
 * @example
 *     var SomeShape = function() {
 *         this._pathProxy = new PathProxy();
 *         ...
 *     }
 *     SomeShape.prototype.buildPath = function(ctx, style) {
 *         this._pathProxy.begin(ctx);
 *             .moveTo(style.x, style.y);
 *             .lineTo(style.x1, style.y1);
 *         ...
 *             .closePath();
 *     },
 *     SomeShape.prototype.getRect = function(style) {
 *         if (!style._rect) {
 *             // 这里必须要在 buildPath 之后才能调用
 *             style._rect = this._pathProxy.fastBoundingRect();
 *         }
 *         return this.style._rect;
 *     },
 *     SomeShape.prototype.isCover = function(x, y) {
 *         var rect = this.getRect(this.style);
 *         if (x >= rect.x
 *             && x <= (rect.x + rect.width)
 *             && y >= rect.y
 *             && y <= (rect.y + rect.height)
 *         ) {
 *             return area.isInsidePath(
 *                 this._pathProxy.pathCommands, 0, 'fill', x, y
 *             );
 *         }
 *     }
 */
define(function (require) {
    
    var vector = require('../../tool/vector');
    // var computeBoundingBox = require('../../tool/computeBoundingBox');

    var PathSegment = function(command, points) {
        this.command = command;
        this.points = points || null;
    };

    /**
     * @alias module:zrender/shape/tool/PathProxy
     * @constructor
     */
    var PathProxy = function () {

        /**
         * Path描述的数组，用于`isInsidePath`的判断
         * @type {Array.<Object>}
         */
        this.pathCommands = [];

        this._ctx = null;

        this._min = [];
        this._max = [];
    };

    /**
     * 快速计算Path包围盒（并不是最小包围盒）
     * @return {Object}
     */
    PathProxy.prototype.fastBoundingRect = function () {
        var min = this._min;
        var max = this._max;
        min[0] = min[1] = Infinity;
        max[0] = max[1] = -Infinity;
        for (var i = 0; i < this.pathCommands.length; i++) {
            var seg = this.pathCommands[i];
            var p = seg.points;
            switch (seg.command) {
                case 'M':
                    vector.min(min, min, p);
                    vector.max(max, max, p);
                    break;
                case 'L':
                    vector.min(min, min, p);
                    vector.max(max, max, p);
                    break;
                case 'C':
                    for (var j = 0; j < 6; j += 2) {
                        min[0] = Math.min(min[0], min[0], p[j]);
                        min[1] = Math.min(min[1], min[1], p[j + 1]);
                        max[0] = Math.max(max[0], max[0], p[j]);
                        max[1] = Math.max(max[1], max[1], p[j + 1]);
                    }
                    break;
                case 'Q':
                    for (var j = 0; j < 4; j += 2) {
                        min[0] = Math.min(min[0], min[0], p[j]);
                        min[1] = Math.min(min[1], min[1], p[j + 1]);
                        max[0] = Math.max(max[0], max[0], p[j]);
                        max[1] = Math.max(max[1], max[1], p[j + 1]);
                    }
                    break;
                case 'A':
                    var cx = p[0];
                    var cy = p[1];
                    var rx = p[2];
                    var ry = p[3];
                    min[0] = Math.min(min[0], min[0], cx - rx);
                    min[1] = Math.min(min[1], min[1], cy - ry);
                    max[0] = Math.max(max[0], max[0], cx + rx);
                    max[1] = Math.max(max[1], max[1], cy + ry);
                    break;
            }
        }

        return {
            x: min[0],
            y: min[1],
            width: max[0] - min[0],
            height: max[1] - min[1]
        };
    };

    /**
     * @param  {CanvasRenderingContext2D} ctx
     * @return {module:zrender/shape/util/PathProxy}
     */
    PathProxy.prototype.begin = function (ctx) {
        this._ctx = ctx || null;
        // 清空pathCommands
        this.pathCommands.length = 0;

        return this;
    };

    /**
     * @param  {number} x
     * @param  {number} y
     * @return {module:zrender/shape/util/PathProxy}
     */
    PathProxy.prototype.moveTo = function (x, y) {
        this.pathCommands.push(new PathSegment('M', [x, y]));
        if (this._ctx) {
            this._ctx.moveTo(x, y);
        }
        return this;
    };

    /**
     * @param  {number} x
     * @param  {number} y
     * @return {module:zrender/shape/util/PathProxy}
     */
    PathProxy.prototype.lineTo = function (x, y) {
        this.pathCommands.push(new PathSegment('L', [x, y]));
        if (this._ctx) {
            this._ctx.lineTo(x, y);
        }
        return this;
    };

    /**
     * @param  {number} x1
     * @param  {number} y1
     * @param  {number} x2
     * @param  {number} y2
     * @param  {number} x3
     * @param  {number} y3
     * @return {module:zrender/shape/util/PathProxy}
     */
    PathProxy.prototype.bezierCurveTo = function (x1, y1, x2, y2, x3, y3) {
        this.pathCommands.push(new PathSegment('C', [x1, y1, x2, y2, x3, y3]));
        if (this._ctx) {
            this._ctx.bezierCurveTo(x1, y1, x2, y2, x3, y3);
        }
        return this;
    };

    /**
     * @param  {number} x1
     * @param  {number} y1
     * @param  {number} x2
     * @param  {number} y2
     * @return {module:zrender/shape/util/PathProxy}
     */
    PathProxy.prototype.quadraticCurveTo = function (x1, y1, x2, y2) {
        this.pathCommands.push(new PathSegment('Q', [x1, y1, x2, y2]));
        if (this._ctx) {
            this._ctx.quadraticCurveTo(x1, y1, x2, y2);
        }
        return this;
    };

    /**
     * @param  {number} cx
     * @param  {number} cy
     * @param  {number} r
     * @param  {number} startAngle
     * @param  {number} endAngle
     * @param  {boolean} anticlockwise
     * @return {module:zrender/shape/util/PathProxy}
     */
    PathProxy.prototype.arc = function (cx, cy, r, startAngle, endAngle, anticlockwise) {
        this.pathCommands.push(new PathSegment(
            'A', [cx, cy, r, r, startAngle, endAngle - startAngle, 0, anticlockwise ? 0 : 1]
        ));
        if (this._ctx) {
            this._ctx.arc(cx, cy, r, startAngle, endAngle, anticlockwise);
        }
        return this;
    };

    // TODO
    PathProxy.prototype.arcTo = function (x1, y1, x2, y2, radius) {
        if (this._ctx) {
            this._ctx.arcTo(x1, y1, x2, y2, radius);
        }
        return this;
    };

    // TODO
    PathProxy.prototype.rect = function (x, y, w, h) {
        if (this._ctx) {
            this._ctx.rect(x, y, w, h);
        }
        return this;
    };

    /**
     * @return {module:zrender/shape/util/PathProxy}
     */
    PathProxy.prototype.closePath = function () {
        this.pathCommands.push(new PathSegment('z'));
        if (this._ctx) {
            this._ctx.closePath();
        }
        return this;
    };

    /**
     * 是否没有Path命令
     * @return {boolean}
     */
    PathProxy.prototype.isEmpty = function() {
        return this.pathCommands.length === 0;
    };

    PathProxy.PathSegment = PathSegment;

    return PathProxy;
});