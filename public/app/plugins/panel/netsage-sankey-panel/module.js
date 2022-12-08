/*! For license information please see module.js.LICENSE.txt */
/* eslint-disable */
define(['d3', 'react', '@grafana/data', '@grafana/ui'], function (t, e, n, r) {
  return (function (t) {
    var e = {};
    function n(r) {
      if (e[r]) return e[r].exports;
      var o = (e[r] = { i: r, l: !1, exports: {} });
      return t[r].call(o.exports, o, o.exports, n), (o.l = !0), o.exports;
    }
    return (
      (n.m = t),
      (n.c = e),
      (n.d = function (t, e, r) {
        n.o(t, e) || Object.defineProperty(t, e, { enumerable: !0, get: r });
      }),
      (n.r = function (t) {
        'undefined' != typeof Symbol &&
          Symbol.toStringTag &&
          Object.defineProperty(t, Symbol.toStringTag, { value: 'Module' }),
          Object.defineProperty(t, '__esModule', { value: !0 });
      }),
      (n.t = function (t, e) {
        if ((1 & e && (t = n(t)), 8 & e)) return t;
        if (4 & e && 'object' == typeof t && t && t.__esModule) return t;
        var r = Object.create(null);
        if ((n.r(r), Object.defineProperty(r, 'default', { enumerable: !0, value: t }), 2 & e && 'string' != typeof t))
          for (var o in t)
            n.d(
              r,
              o,
              function (e) {
                return t[e];
              }.bind(null, o)
            );
        return r;
      }),
      (n.n = function (t) {
        var e =
          t && t.__esModule
            ? function () {
                return t.default;
              }
            : function () {
                return t;
              };
        return n.d(e, 'a', e), e;
      }),
      (n.o = function (t, e) {
        return Object.prototype.hasOwnProperty.call(t, e);
      }),
      (n.p = '/'),
      n((n.s = 5))
    );
  })([
    function (e, n) {
      e.exports = t;
    },
    function (t, n) {
      t.exports = e;
    },
    function (t, e) {
      t.exports = n;
    },
    function (t, e) {
      t.exports = r;
    },
    ,
    function (t, e, n) {
      'use strict';
      n.r(e);
      var r = n(2);
      var o = function () {
        return (o =
          Object.assign ||
          function (t) {
            for (var e, n = 1, r = arguments.length; n < r; n++)
              for (var o in (e = arguments[n])) Object.prototype.hasOwnProperty.call(e, o) && (t[o] = e[o]);
            return t;
          }).apply(this, arguments);
      };
      Object.create;
      function i(t, e) {
        var n = 'function' == typeof Symbol && t[Symbol.iterator];
        if (!n) return t;
        var r,
          o,
          i = n.call(t),
          a = [];
        try {
          for (; (void 0 === e || e-- > 0) && !(r = i.next()).done; ) a.push(r.value);
        } catch (t) {
          o = { error: t };
        } finally {
          try {
            r && !r.done && (n = i.return) && n.call(i);
          } finally {
            if (o) throw o.error;
          }
        }
        return a;
      }
      Object.create;
      var a = n(1),
        s = n.n(a);
      function l(t, e) {
        let n = 0;
        if (void 0 === e) for (let e of t) (e = +e) && (n += e);
        else {
          let r = -1;
          for (let o of t) (o = +e(o, ++r, t)) && (n += o);
        }
        return n;
      }
      function u(t, e) {
        let n;
        if (void 0 === e) for (const e of t) null != e && (n < e || (void 0 === n && e >= e)) && (n = e);
        else {
          let r = -1;
          for (let o of t) null != (o = e(o, ++r, t)) && (n < o || (void 0 === n && o >= o)) && (n = o);
        }
        return n;
      }
      function c(t, e) {
        let n;
        if (void 0 === e) for (const e of t) null != e && (n > e || (void 0 === n && e >= e)) && (n = e);
        else {
          let r = -1;
          for (let o of t) null != (o = e(o, ++r, t)) && (n > o || (void 0 === n && o >= o)) && (n = o);
        }
        return n;
      }
      function f(t, e) {
        return t.sourceLinks.length ? t.depth : e - 1;
      }
      function d(t) {
        return function () {
          return t;
        };
      }
      function h(t, e) {
        return y(t.source, e.source) || t.index - e.index;
      }
      function p(t, e) {
        return y(t.target, e.target) || t.index - e.index;
      }
      function y(t, e) {
        return t.y0 - e.y0;
      }
      function g(t) {
        return t.value;
      }
      function m(t) {
        return t.index;
      }
      function b(t) {
        return t.nodes;
      }
      function x(t) {
        return t.links;
      }
      function v(t, e) {
        const n = t.get(e);
        if (!n) throw new Error('missing: ' + e);
        return n;
      }
      function k({ nodes: t }) {
        for (const e of t) {
          let t = e.y0,
            n = t;
          for (const n of e.sourceLinks) (n.y0 = t + n.width / 2), (t += n.width);
          for (const t of e.targetLinks) (t.y1 = n + t.width / 2), (n += t.width);
        }
      }
      function w() {
        let t,
          e,
          n,
          r = 0,
          o = 0,
          i = 1,
          a = 1,
          s = 24,
          w = 8,
          _ = m,
          L = f,
          M = b,
          C = x,
          E = 6;
        function S() {
          const t = { nodes: M.apply(null, arguments), links: C.apply(null, arguments) };
          return A(t), P(t), O(t), j(t), N(t), k(t), t;
        }
        function A({ nodes: t, links: e }) {
          for (const [e, n] of t.entries()) (n.index = e), (n.sourceLinks = []), (n.targetLinks = []);
          const r = new Map(t.map((e, n) => [_(e, n, t), e]));
          for (const [t, n] of e.entries()) {
            n.index = t;
            let { source: e, target: o } = n;
            'object' != typeof e && (e = n.source = v(r, e)),
              'object' != typeof o && (o = n.target = v(r, o)),
              e.sourceLinks.push(n),
              o.targetLinks.push(n);
          }
          if (null != n) for (const { sourceLinks: e, targetLinks: r } of t) e.sort(n), r.sort(n);
        }
        function P({ nodes: t }) {
          for (const e of t)
            e.value = void 0 === e.fixedValue ? Math.max(l(e.sourceLinks, g), l(e.targetLinks, g)) : e.fixedValue;
        }
        function O({ nodes: t }) {
          const e = t.length;
          let n = new Set(t),
            r = new Set(),
            o = 0;
          for (; n.size; ) {
            for (const t of n) {
              t.depth = o;
              for (const { target: e } of t.sourceLinks) r.add(e);
            }
            if (++o > e) throw new Error('circular link');
            (n = r), (r = new Set());
          }
        }
        function j({ nodes: t }) {
          const e = t.length;
          let n = new Set(t),
            r = new Set(),
            o = 0;
          for (; n.size; ) {
            for (const t of n) {
              t.height = o;
              for (const { source: e } of t.targetLinks) r.add(e);
            }
            if (++o > e) throw new Error('circular link');
            (n = r), (r = new Set());
          }
        }
        function N(n) {
          const f = (function ({ nodes: t }) {
            const n = u(t, (t) => t.depth) + 1,
              o = (i - r - s) / (n - 1),
              a = new Array(n);
            for (const e of t) {
              const t = Math.max(0, Math.min(n - 1, Math.floor(L.call(null, e, n))));
              (e.layer = t), (e.x0 = r + t * o), (e.x1 = e.x0 + s), a[t] ? a[t].push(e) : (a[t] = [e]);
            }
            if (e) for (const t of a) t.sort(e);
            return a;
          })(n);
          (t = Math.min(w, (a - o) / (u(f, (t) => t.length) - 1))),
            (function (e) {
              const n = c(e, (e) => (a - o - (e.length - 1) * t) / l(e, g));
              for (const r of e) {
                let e = o;
                for (const o of r) {
                  (o.y0 = e), (o.y1 = e + o.value * n), (e = o.y1 + t);
                  for (const t of o.sourceLinks) t.width = t.value * n;
                }
                e = (a - e + t) / (r.length + 1);
                for (let t = 0; t < r.length; ++t) {
                  const n = r[t];
                  (n.y0 += e * (t + 1)), (n.y1 += e * (t + 1));
                }
                B(r);
              }
            })(f);
          for (let t = 0; t < E; ++t) {
            const e = Math.pow(0.99, t),
              n = Math.max(1 - e, (t + 1) / E);
            V(f, e, n), I(f, e, n);
          }
        }
        function I(t, n, r) {
          for (let o = 1, i = t.length; o < i; ++o) {
            const i = t[o];
            for (const t of i) {
              let e = 0,
                r = 0;
              for (const { source: n, value: o } of t.targetLinks) {
                let i = o * (t.layer - n.layer);
                (e += W(n, t) * i), (r += i);
              }
              if (!(r > 0)) continue;
              let o = (e / r - t.y0) * n;
              (t.y0 += o), (t.y1 += o), z(t);
            }
            void 0 === e && i.sort(y), T(i, r);
          }
        }
        function V(t, n, r) {
          for (let o = t.length - 2; o >= 0; --o) {
            const i = t[o];
            for (const t of i) {
              let e = 0,
                r = 0;
              for (const { target: n, value: o } of t.sourceLinks) {
                let i = o * (n.layer - t.layer);
                (e += X(t, n) * i), (r += i);
              }
              if (!(r > 0)) continue;
              let o = (e / r - t.y0) * n;
              (t.y0 += o), (t.y1 += o), z(t);
            }
            void 0 === e && i.sort(y), T(i, r);
          }
        }
        function T(e, n) {
          const r = e.length >> 1,
            i = e[r];
          F(e, i.y0 - t, r - 1, n), D(e, i.y1 + t, r + 1, n), F(e, a, e.length - 1, n), D(e, o, 0, n);
        }
        function D(e, n, r, o) {
          for (; r < e.length; ++r) {
            const i = e[r],
              a = (n - i.y0) * o;
            a > 1e-6 && ((i.y0 += a), (i.y1 += a)), (n = i.y1 + t);
          }
        }
        function F(e, n, r, o) {
          for (; r >= 0; --r) {
            const i = e[r],
              a = (i.y1 - n) * o;
            a > 1e-6 && ((i.y0 -= a), (i.y1 -= a)), (n = i.y0 - t);
          }
        }
        function z({ sourceLinks: t, targetLinks: e }) {
          if (void 0 === n) {
            for (const {
              source: { sourceLinks: t },
            } of e)
              t.sort(p);
            for (const {
              target: { targetLinks: e },
            } of t)
              e.sort(h);
          }
        }
        function B(t) {
          if (void 0 === n) for (const { sourceLinks: e, targetLinks: n } of t) e.sort(p), n.sort(h);
        }
        function W(e, n) {
          let r = e.y0 - ((e.sourceLinks.length - 1) * t) / 2;
          for (const { target: o, width: i } of e.sourceLinks) {
            if (o === n) break;
            r += i + t;
          }
          for (const { source: t, width: o } of n.targetLinks) {
            if (t === e) break;
            r -= o;
          }
          return r;
        }
        function X(e, n) {
          let r = n.y0 - ((n.targetLinks.length - 1) * t) / 2;
          for (const { source: o, width: i } of n.targetLinks) {
            if (o === e) break;
            r += i + t;
          }
          for (const { target: t, width: o } of e.sourceLinks) {
            if (t === n) break;
            r -= o;
          }
          return r;
        }
        return (
          (S.update = function (t) {
            return k(t), t;
          }),
          (S.nodeId = function (t) {
            return arguments.length ? ((_ = 'function' == typeof t ? t : d(t)), S) : _;
          }),
          (S.nodeAlign = function (t) {
            return arguments.length ? ((L = 'function' == typeof t ? t : d(t)), S) : L;
          }),
          (S.nodeSort = function (t) {
            return arguments.length ? ((e = t), S) : e;
          }),
          (S.nodeWidth = function (t) {
            return arguments.length ? ((s = +t), S) : s;
          }),
          (S.nodePadding = function (e) {
            return arguments.length ? ((w = t = +e), S) : w;
          }),
          (S.nodes = function (t) {
            return arguments.length ? ((M = 'function' == typeof t ? t : d(t)), S) : M;
          }),
          (S.links = function (t) {
            return arguments.length ? ((C = 'function' == typeof t ? t : d(t)), S) : C;
          }),
          (S.linkSort = function (t) {
            return arguments.length ? ((n = t), S) : n;
          }),
          (S.size = function (t) {
            return arguments.length ? ((r = o = 0), (i = +t[0]), (a = +t[1]), S) : [i - r, a - o];
          }),
          (S.extent = function (t) {
            return arguments.length
              ? ((r = +t[0][0]), (i = +t[1][0]), (o = +t[0][1]), (a = +t[1][1]), S)
              : [
                  [r, o],
                  [i, a],
                ];
          }),
          (S.iterations = function (t) {
            return arguments.length ? ((E = +t), S) : E;
          }),
          S
        );
      }
      var _ = Math.PI,
        L = 2 * _,
        M = L - 1e-6;
      function C() {
        (this._x0 = this._y0 = this._x1 = this._y1 = null), (this._ = '');
      }
      function E() {
        return new C();
      }
      C.prototype = E.prototype = {
        constructor: C,
        moveTo: function (t, e) {
          this._ += 'M' + (this._x0 = this._x1 = +t) + ',' + (this._y0 = this._y1 = +e);
        },
        closePath: function () {
          null !== this._x1 && ((this._x1 = this._x0), (this._y1 = this._y0), (this._ += 'Z'));
        },
        lineTo: function (t, e) {
          this._ += 'L' + (this._x1 = +t) + ',' + (this._y1 = +e);
        },
        quadraticCurveTo: function (t, e, n, r) {
          this._ += 'Q' + +t + ',' + +e + ',' + (this._x1 = +n) + ',' + (this._y1 = +r);
        },
        bezierCurveTo: function (t, e, n, r, o, i) {
          this._ += 'C' + +t + ',' + +e + ',' + +n + ',' + +r + ',' + (this._x1 = +o) + ',' + (this._y1 = +i);
        },
        arcTo: function (t, e, n, r, o) {
          (t = +t), (e = +e), (n = +n), (r = +r), (o = +o);
          var i = this._x1,
            a = this._y1,
            s = n - t,
            l = r - e,
            u = i - t,
            c = a - e,
            f = u * u + c * c;
          if (o < 0) throw new Error('negative radius: ' + o);
          if (null === this._x1) this._ += 'M' + (this._x1 = t) + ',' + (this._y1 = e);
          else if (f > 1e-6)
            if (Math.abs(c * s - l * u) > 1e-6 && o) {
              var d = n - i,
                h = r - a,
                p = s * s + l * l,
                y = d * d + h * h,
                g = Math.sqrt(p),
                m = Math.sqrt(f),
                b = o * Math.tan((_ - Math.acos((p + f - y) / (2 * g * m))) / 2),
                x = b / m,
                v = b / g;
              Math.abs(x - 1) > 1e-6 && (this._ += 'L' + (t + x * u) + ',' + (e + x * c)),
                (this._ +=
                  'A' +
                  o +
                  ',' +
                  o +
                  ',0,0,' +
                  +(c * d > u * h) +
                  ',' +
                  (this._x1 = t + v * s) +
                  ',' +
                  (this._y1 = e + v * l));
            } else this._ += 'L' + (this._x1 = t) + ',' + (this._y1 = e);
          else;
        },
        arc: function (t, e, n, r, o, i) {
          (t = +t), (e = +e), (i = !!i);
          var a = (n = +n) * Math.cos(r),
            s = n * Math.sin(r),
            l = t + a,
            u = e + s,
            c = 1 ^ i,
            f = i ? r - o : o - r;
          if (n < 0) throw new Error('negative radius: ' + n);
          null === this._x1
            ? (this._ += 'M' + l + ',' + u)
            : (Math.abs(this._x1 - l) > 1e-6 || Math.abs(this._y1 - u) > 1e-6) && (this._ += 'L' + l + ',' + u),
            n &&
              (f < 0 && (f = (f % L) + L),
              f > M
                ? (this._ +=
                    'A' +
                    n +
                    ',' +
                    n +
                    ',0,1,' +
                    c +
                    ',' +
                    (t - a) +
                    ',' +
                    (e - s) +
                    'A' +
                    n +
                    ',' +
                    n +
                    ',0,1,' +
                    c +
                    ',' +
                    (this._x1 = l) +
                    ',' +
                    (this._y1 = u))
                : f > 1e-6 &&
                  (this._ +=
                    'A' +
                    n +
                    ',' +
                    n +
                    ',0,' +
                    +(f >= _) +
                    ',' +
                    c +
                    ',' +
                    (this._x1 = t + n * Math.cos(o)) +
                    ',' +
                    (this._y1 = e + n * Math.sin(o))));
        },
        rect: function (t, e, n, r) {
          this._ +=
            'M' + (this._x0 = this._x1 = +t) + ',' + (this._y0 = this._y1 = +e) + 'h' + +n + 'v' + +r + 'h' + -n + 'Z';
        },
        toString: function () {
          return this._;
        },
      };
      var S = E,
        A = Array.prototype.slice,
        P = function (t) {
          return function () {
            return t;
          };
        };
      function O(t) {
        return t[0];
      }
      function j(t) {
        return t[1];
      }
      function N(t) {
        return t.source;
      }
      function I(t) {
        return t.target;
      }
      function V(t) {
        var e = N,
          n = I,
          r = O,
          o = j,
          i = null;
        function a() {
          var a,
            s = A.call(arguments),
            l = e.apply(this, s),
            u = n.apply(this, s);
          if (
            (i || (i = a = S()),
            t(
              i,
              +r.apply(this, ((s[0] = l), s)),
              +o.apply(this, s),
              +r.apply(this, ((s[0] = u), s)),
              +o.apply(this, s)
            ),
            a)
          )
            return (i = null), a + '' || null;
        }
        return (
          (a.source = function (t) {
            return arguments.length ? ((e = t), a) : e;
          }),
          (a.target = function (t) {
            return arguments.length ? ((n = t), a) : n;
          }),
          (a.x = function (t) {
            return arguments.length ? ((r = 'function' == typeof t ? t : P(+t)), a) : r;
          }),
          (a.y = function (t) {
            return arguments.length ? ((o = 'function' == typeof t ? t : P(+t)), a) : o;
          }),
          (a.context = function (t) {
            return arguments.length ? ((i = null == t ? null : t), a) : i;
          }),
          a
        );
      }
      function T(t, e, n, r, o) {
        t.moveTo(e, n), t.bezierCurveTo((e = (e + r) / 2), n, e, o, r, o);
      }
      function D(t) {
        return [t.source.x1, t.y0];
      }
      function F(t) {
        return [t.target.x0, t.y1];
      }
      var z,
        B = function () {
          return V(T).source(D).target(F);
        },
        W = function (t) {
          var e = t.data,
            n = t.panelId,
            r = B(),
            o = e.color,
            i = n + '-' + e.id,
            a = 'sankey-path' + n;
          return s.a.createElement(
            s.a.Fragment,
            null,
            s.a.createElement('path', {
              d: r(e),
              fill: 'none',
              stroke: o,
              strokeOpacity: 0.8,
              opacity: 0.7,
              strokeWidth: e.width,
              id: i,
              display: e.displayValue,
              className: a,
            })
          );
        },
        X = n(3),
        Y = function (t) {
          var e = t.data,
            n = t.textColor,
            r = t.nodeColor,
            o = t.panelId,
            i = Object(X.useTheme2)(),
            a = e.x0,
            l = e.x1,
            u = e.y0,
            c = e.y1,
            f = e.index,
            d = e.name,
            h = e.value,
            p = l - a,
            y = i.typography.fontSize,
            g = 'sankey-node' + o;
          return s.a.createElement(
            s.a.Fragment,
            null,
            s.a.createElement('rect', {
              x: a,
              y: u,
              rx: 5,
              ry: 5,
              width: p,
              height: c - u,
              stroke: 'black',
              fill: r,
              'data-index': f,
              id: o + ',' + e.id,
              d: h,
              name: d,
              className: g,
            }),
            s.a.createElement(
              'text',
              {
                x: a < p / 2 ? l + 6 : a - 6,
                y: (c + u) / 2,
                style: {
                  fill: n,
                  alignmentBaseline: 'middle',
                  fontSize: y,
                  textAnchor: a < p / 2 ? 'start' : 'end',
                  pointerEvents: 'none',
                  userSelect: 'none',
                },
              },
              d
            )
          );
        },
        q = n(0),
        Z = function (t) {
          var e = t.rowNames,
            n = t.field,
            r = t.panelId,
            o = i(Object(a.useState)({ mouseX: 100, mouseY: 100 }), 2),
            s = o[0],
            l = o[1],
            u = function (t) {
              l({ mouseX: t.clientX, mouseY: t.clientY });
            };
          return (
            Object(a.useEffect)(function () {
              window.addEventListener('mousemove', u);
              var t = '.sankey-path' + r;
              q.selectAll(t)
                .on('mouseover', function (n, r) {
                  var o = this,
                    i = q.select(this).attr('id'),
                    a = i.split('-'),
                    l = e.find(function (t) {
                      return t.name === a[1];
                    }).display;
                  q.selectAll(t).each(function (t) {
                    var e = q.select(this).attr('id'),
                      n = i === e;
                    q.select(this).attr('opacity', n ? 1 : 0.4);
                  });
                  var u = q.select(this).attr('id');
                  q.select('body')
                    .append('div')
                    .attr('class', 'tooltip-' + u)
                    .html(function () {
                      var t = q.select(o).attr('display');
                      return l + ' <br> <b>' + t + '</b>';
                    })
                    .style('padding', '10px 15px')
                    .style('background', 'black')
                    .style('color', 'white')
                    .style('border', '#A8A8A8 solid 5px')
                    .style('border-radius', '5px')
                    .style('left', s.mouseX + 'px')
                    .style('top', s.mouseY + 'px')
                    .style('opacity', 0)
                    .style('position', 'absolute')
                    .transition()
                    .duration(200)
                    .style('opacity', 0.8);
                })
                .on('mouseout', function (e) {
                  var n = q.select(this).attr('id');
                  q
                    .selectAll('.tooltip-' + n)
                    .transition()
                    .duration(300)
                    .remove(),
                    q.selectAll(t).attr('opacity', 0.7);
                });
              var o = '.sankey-node' + r;
              return (
                q
                  .selectAll(o)
                  .on('mouseover', function (e, r) {
                    var o = this,
                      i = q.select(this).attr('id').split(','),
                      a = i[0],
                      l = [];
                    i.forEach(function (t) {
                      l.push(a + '-' + t);
                    }),
                      q.selectAll(t).each(function (t) {
                        var e = q.select(this).attr('id'),
                          n = l.find(function (t) {
                            return t === e;
                          });
                        q.select(this).attr('opacity', n ? 1 : 0.2);
                      });
                    var u = q.select(this).attr('data-index');
                    q.select('body')
                      .append('div')
                      .attr('class', 'tooltip-node' + u)
                      .html(function () {
                        var t = n.display(q.select(o).attr('d')),
                          e = q.select(o).attr('name');
                        return t.suffix
                          ? e + ': <b>' + t.text + ' ' + t.suffix + '</b>'
                          : e + ': <b>' + t.text + '</b>';
                      })
                      .style('padding', '10px 15px')
                      .style('background', 'black')
                      .style('color', 'white')
                      .style('border', '#A8A8A8 solid 5px')
                      .style('border-radius', '5px')
                      .style('left', s.mouseX + 'px')
                      .style('top', s.mouseY + 'px')
                      .style('opacity', 0)
                      .style('position', 'absolute')
                      .transition()
                      .duration(200)
                      .style('opacity', 0.8);
                  })
                  .on('mouseout', function (e) {
                    var n = q.select(this).attr('data-index');
                    q
                      .selectAll('.tooltip-node' + n)
                      .transition()
                      .duration(300)
                      .remove(),
                      q.selectAll(t).attr('opacity', 0.7);
                  }),
                function () {
                  window.removeEventListener('mousemove', u);
                }
              );
            }),
            null
          );
        },
        Q = function (t) {
          var e = t.displayNames,
            n = t.width,
            r = t.id,
            o = t.topMargin,
            i = t.textColor;
          return (
            Object(a.useEffect)(function () {
              q.select('#' + r)
                .selectAll('.header-text')
                .remove();
              var t = q
                  .select('#' + r)
                  .append('g')
                  .attr('id', r + ' header'),
                a = 20,
                s = o / 2;
              if (
                (t
                  .append('text')
                  .attr('class', 'header-text')
                  .attr('transform', 'translate(' + a + ',' + s + ')')
                  .attr('font-size', '14pt')
                  .attr('font-weight', '500')
                  .attr('text-anchor', 'start')
                  .text(e[0])
                  .attr('fill', i),
                t
                  .append('text')
                  .attr('class', 'header-text')
                  .attr('transform', 'translate(' + (n + a) + ',' + s + ')')
                  .attr('font-size', '14pt')
                  .attr('font-weight', '500')
                  .attr('text-anchor', 'end')
                  .text(e[e.length - 2])
                  .attr('fill', i),
                e.length > 3)
              )
                for (var l = n / (e.length - 2), u = 1; u < e.length - 2; u++) {
                  var c = l * u + a;
                  t.append('text')
                    .attr('class', 'header-text')
                    .attr('transform', 'translate(' + c + ',' + s + ')')
                    .attr('font-size', '14pt')
                    .attr('font-weight', '500')
                    .attr('text-anchor', 'middle')
                    .text(e[u])
                    .attr('fill', i);
                }
            }),
            null
          );
        },
        G = function (t) {
          var e = t.data,
            n = t.width,
            r = t.height,
            o = t.displayNames,
            i = t.rowDisplayNames,
            a = t.id,
            l = t.textColor,
            u = t.nodeColor,
            c = t.field,
            f = t.nodeWidth,
            d = t.nodePadding,
            h = t.iteration,
            p = 75,
            y = 20,
            g = n - y - 20,
            m = r - p - 50,
            b = w()
              .iterations(h)
              .nodeWidth(f)
              .nodePadding(d)
              .extent([
                [0, 0],
                [g, m],
              ]);
          if (e) {
            var x = b(e),
              v = x.links,
              k = x.nodes;
            return s.a.createElement(
              'svg',
              { id: 'Chart_' + a, width: n, height: r },
              s.a.createElement(Q, { displayNames: o, width: g, id: 'Chart_' + a, topMargin: p, textColor: l }),
              s.a.createElement(Z, { rowNames: i, field: c, panelId: a }),
              s.a.createElement(
                'g',
                { transform: 'translate(' + y + ', ' + p + ')' },
                v.map(function (t, e) {
                  return s.a.createElement(W, { key: e, data: t, panelId: a });
                })
              ),
              s.a.createElement(
                'g',
                { transform: 'translate(' + y + ', ' + p + ')' },
                k.map(function (t, e) {
                  return s.a.createElement(Y, { data: t, key: e, textColor: l, nodeColor: u, panelId: a });
                })
              )
            );
          }
          return s.a.createElement('div', { id: 'Chart_' + a, style: { height: r, width: n } });
        };
      n.d(e, 'plugin', function () {
        return H;
      });
      var H = new r.PanelPlugin(function (t) {
        var e = t.options,
          n = t.data,
          i = t.width,
          a = t.height,
          l = t.id,
          u = o({}, e),
          c = Object(X.useTheme2)(),
          f = [];
        try {
          f = (function (t, e, n, o) {
            var i = e.valueFieldName;
            function a(t) {
              switch (t) {
                case 'dark-green':
                  t = '#1A7311';
                  break;
                case 'semi-dark-green':
                  t = '#36872D';
                  break;
                case 'light-green':
                  t = '#73BF68';
                  break;
                case 'super-light-green':
                  t = '#96D88C';
                  break;
                case 'dark-yellow':
                  t = 'rgb(207, 159, 0)';
                  break;
                case 'semi-dark-yellow':
                  t = 'rgb(224, 180, 0)';
                  break;
                case 'light-yellow':
                  t = 'rgb(250, 222, 42)';
                  break;
                case 'super-light-yellow':
                  t = 'rgb(255, 238, 82)';
                  break;
                case 'dark-red':
                  t = 'rgb(173, 3, 23)';
                  break;
                case 'semi-dark-red':
                  t = 'rgb(196, 22, 42)';
                  break;
                case 'light-red':
                  t = 'rgb(242, 73, 92)';
                  break;
                case 'super-light-red':
                  t = 'rgb(255, 115, 131)';
                  break;
                case 'dark-blue':
                  t = 'rgb(18, 80, 176)';
                  break;
                case 'semi-dark-blue':
                  t = 'rgb(31, 96, 196)';
                  break;
                case 'light-blue':
                  t = 'rgb(87, 148, 242)';
                  break;
                case 'super-light-blue':
                  t = 'rgb(138, 184, 255)';
                  break;
                case 'dark-orange':
                  t = 'rgb(229, 84, 0)';
                  break;
                case 'semi-dark-orange':
                  t = 'rgb(250, 100, 0)';
                  break;
                case 'light-orange':
                  t = 'rgb(255, 152, 48)';
                  break;
                case 'super-light-orange':
                  t = 'rgb(255, 179, 87)';
                  break;
                case 'dark-purple':
                  t = 'rgb(124, 46, 163)';
                  break;
                case 'semi-dark-purple':
                  t = 'rgb(143, 59, 184)';
                  break;
                case 'light-purple':
                  t = 'rgb(184, 119, 217)';
                  break;
                case 'super-light-purple':
                  t = 'rgb(202, 149, 229)';
              }
              return t;
            }
            var s = [];
            n
              ? s.push(a(o))
              : (s.push('#018EDB'), s.push('#DB8500'), s.push('#7C00DB'), s.push('#DB0600'), s.push('#00DB57'));
            var l = t.series[0].fields,
              u = l.length - 1,
              c = [];
            l.forEach(function (t) {
              c.push(Object(r.getFieldDisplayName)(t));
            });
            var f = i
                ? t.series.map(function (t) {
                    return t.fields.find(function (t) {
                      return t.name === i;
                    });
                  })
                : t.series.map(function (t) {
                    return t.fields.find(function (t) {
                      return 'number' === t.type;
                    });
                  }),
              d = [];
            f[0].values.buffer.map(function (t) {
              d.push([t, f[0].display(t), f[0].name]);
            });
            var h,
              p = t.series[0],
              y = new r.DataFrameView(p),
              g = [],
              m = [],
              b = [],
              x = [],
              v = 0;
            return (
              y.forEach(function (t) {
                for (
                  var e,
                    n = [],
                    r = function (e) {
                      var r = t[e],
                        o = m.findIndex(function (t) {
                          return t.name === r && t.colId === e;
                        });
                      -1 === o
                        ? ((o = m.push({ name: r, id: ['row' + v], colId: e }) - 1),
                          0 === e && ((h = s[b.length % s.length]), b.push({ name: r, index: o, color: h })))
                        : m[o].id.push('row' + v),
                        n.push(o);
                    },
                    o = 0;
                  o < u;
                  o++
                )
                  r(o);
                var i =
                    null ===
                      (e = b.find(function (t) {
                        return t.index === n[0];
                      })) || void 0 === e
                      ? void 0
                      : e.color,
                  a = '' + m[n[0]].name;
                for (o = 0; o < n.length - 1; o++) {
                  var l,
                    c = f[0].display(t[u]);
                  (l = c.suffix ? c.text + ' ' + c.suffix : '' + c.text),
                    g.push({
                      source: n[o],
                      target: n[o + 1],
                      value: t[u],
                      displayValue: l,
                      id: 'row' + v,
                      color: i,
                      node0: n[0],
                    }),
                    (a = a.concat(' -> ' + m[n[o + 1]].name));
                }
                x.push({ name: 'row' + v, display: a }), v++;
              }),
              [{ links: g, nodes: m }, c, x, f[0], a]
            );
          })(n, e, u.monochrome, u.color);
        } catch (t) {}
        var d = f[1],
          h = f[0],
          p = f[2],
          y = f[3],
          g = f[4],
          m = c.colors.text.primary,
          b = g(u.nodeColor);
        return s.a.createElement(
          'g',
          null,
          s.a.createElement(G, {
            data: h,
            displayNames: d,
            rowDisplayNames: p,
            width: i,
            height: a,
            id: l,
            textColor: m,
            nodeColor: b,
            field: y,
            nodeWidth: u.nodeWidth,
            nodePadding: u.nodePadding,
            iteration: u.iteration,
          })
        );
      })
        .setPanelOptions(function (t) {
          var e;
          t.addBooleanSwitch({ path: 'monochrome', name: 'Single Link color only', defaultValue: !1 })
            .addColorPicker({
              path: 'color',
              name: 'Link Color',
              showIf:
                ((e = !0),
                function (t) {
                  return t.monochrome === e;
                }),
              defaultValue: 'blue',
            })
            .addColorPicker({ path: 'nodeColor', name: 'Node color', defaultValue: 'grey' })
            .addSliderInput({
              path: 'nodeWidth',
              name: 'Node width',
              defaultValue: 30,
              settings: { min: 5, max: 100, step: 1 },
            })
            .addSliderInput({
              path: 'nodePadding',
              name: 'Node padding',
              defaultValue: 30,
              settings: { min: 1, max: 100, step: 1 },
            })
            .addSliderInput({
              path: 'iteration',
              name: 'Layout iterations',
              defaultValue: 7,
              settings: { min: 1, max: 30, step: 1 },
            });
        })
        .useFieldConfig({
          disableStandardOptions: [r.FieldConfigProperty.NoValue, r.FieldConfigProperty.Max, r.FieldConfigProperty.Min],
          standardOptions:
            ((z = {}),
            (z[r.FieldConfigProperty.Color] = {
              settings: { byValueSupport: !0, bySeriesSupport: !0, preferThresholdsMode: !0 },
            }),
            z),
        });
    },
  ]);
});
//# sourceMappingURL=module.js.map
/* eslint-enable */
