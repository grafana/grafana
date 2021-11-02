var MAX_OBJECTS = 10;
var MAX_LEVELS = 4;
/**
 * @internal
 */
export function pointWithin(px, py, rlft, rtop, rrgt, rbtm) {
    return px >= rlft && px <= rrgt && py >= rtop && py <= rbtm;
}
/**
 * @internal
 */
var Quadtree = /** @class */ (function () {
    function Quadtree(x, y, w, h, l) {
        if (l === void 0) { l = 0; }
        this.x = x;
        this.y = y;
        this.w = w;
        this.h = h;
        this.l = l;
        this.o = [];
        this.q = null;
    }
    Quadtree.prototype.split = function () {
        var t = this, x = t.x, y = t.y, w = t.w / 2, h = t.h / 2, l = t.l + 1;
        t.q = [
            // top right
            new Quadtree(x + w, y, w, h, l),
            // top left
            new Quadtree(x, y, w, h, l),
            // bottom left
            new Quadtree(x, y + h, w, h, l),
            // bottom right
            new Quadtree(x + w, y + h, w, h, l),
        ];
    };
    // invokes callback with index of each overlapping quad
    Quadtree.prototype.quads = function (x, y, w, h, cb) {
        var t = this, q = t.q, hzMid = t.x + t.w / 2, vtMid = t.y + t.h / 2, startIsNorth = y < vtMid, startIsWest = x < hzMid, endIsEast = x + w > hzMid, endIsSouth = y + h > vtMid;
        // top-right quad
        startIsNorth && endIsEast && cb(q[0]);
        // top-left quad
        startIsWest && startIsNorth && cb(q[1]);
        // bottom-left quad
        startIsWest && endIsSouth && cb(q[2]);
        // bottom-right quad
        endIsEast && endIsSouth && cb(q[3]);
    };
    Quadtree.prototype.add = function (o) {
        var t = this;
        if (t.q != null) {
            t.quads(o.x, o.y, o.w, o.h, function (q) {
                q.add(o);
            });
        }
        else {
            var os = t.o;
            os.push(o);
            if (os.length > MAX_OBJECTS && t.l < MAX_LEVELS) {
                t.split();
                var _loop_1 = function (i) {
                    var oi = os[i];
                    t.quads(oi.x, oi.y, oi.w, oi.h, function (q) {
                        q.add(oi);
                    });
                };
                for (var i = 0; i < os.length; i++) {
                    _loop_1(i);
                }
                t.o.length = 0;
            }
        }
    };
    Quadtree.prototype.get = function (x, y, w, h, cb) {
        var t = this;
        var os = t.o;
        for (var i = 0; i < os.length; i++) {
            cb(os[i]);
        }
        if (t.q != null) {
            t.quads(x, y, w, h, function (q) {
                q.get(x, y, w, h, cb);
            });
        }
    };
    Quadtree.prototype.clear = function () {
        this.o.length = 0;
        this.q = null;
    };
    return Quadtree;
}());
export { Quadtree };
//# sourceMappingURL=quadtree.js.map