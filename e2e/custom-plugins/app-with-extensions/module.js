define(['react', '@grafana/data', '@grafana/ui', '@grafana/runtime', '@emotion/css', 'rxjs'], (e, t, n, r, o, i) =>
  (() => {
    'use strict';
    var a = {
        89: (e) => {
          e.exports = o;
        },
        781: (e) => {
          e.exports = t;
        },
        531: (e) => {
          e.exports = r;
        },
        7: (e) => {
          e.exports = n;
        },
        959: (t) => {
          t.exports = e;
        },
        269: (e) => {
          e.exports = i;
        },
      },
      l = {};
    function s(e) {
      var t = l[e];
      if (void 0 !== t) return t.exports;
      var n = (l[e] = { exports: {} });
      return a[e](n, n.exports, s), n.exports;
    }
    (s.n = (e) => {
      var t = e && e.__esModule ? () => e.default : () => e;
      return s.d(t, { a: t }), t;
    }),
      (s.d = (e, t) => {
        for (var n in t) s.o(t, n) && !s.o(e, n) && Object.defineProperty(e, n, { enumerable: !0, get: t[n] });
      }),
      (s.o = (e, t) => Object.prototype.hasOwnProperty.call(e, t)),
      (s.r = (e) => {
        'undefined' != typeof Symbol &&
          Symbol.toStringTag &&
          Object.defineProperty(e, Symbol.toStringTag, { value: 'Module' }),
          Object.defineProperty(e, '__esModule', { value: !0 });
      });
    var c = {};
    return (
      (() => {
        s.r(c), s.d(c, { plugin: () => E });
        var e = s(959),
          t = s.n(e),
          n = s(781);
        const r = 'ape-modal-body',
          o = 'ape-main-page-container';
        class i extends e.PureComponent {
          render() {
            return e.createElement('div', { 'data-testid': o, className: 'page-container' }, 'Hello Grafana!');
          }
        }
        var a = s(7),
          l = s(531),
          u = s(89),
          d = s(269);
        function p(e, t, n, r, o, i, a) {
          try {
            var l = e[i](a),
              s = l.value;
          } catch (e) {
            return void n(e);
          }
          l.done ? t(s) : Promise.resolve(s).then(r, o);
        }
        function f(e) {
          return function () {
            var t = this,
              n = arguments;
            return new Promise(function (r, o) {
              var i = e.apply(t, n);
              function a(e) {
                p(i, r, o, a, l, 'next', e);
              }
              function l(e) {
                p(i, r, o, a, l, 'throw', e);
              }
              a(void 0);
            });
          };
        }
        const m = (e) => ({
            colorWeak: u.css`
    color: ${e.colors.text.secondary};
  `,
            marginTop: u.css`
    margin-top: ${e.spacing(3)};
  `,
          }),
          g =
            ((v = f(function* (e, t) {
              try {
                yield b(e, t), window.location.reload();
              } catch (e) {
                console.error('Error while updating the plugin', e);
              }
            })),
            function (e, t) {
              return v.apply(this, arguments);
            });
        var v;
        const b = (function () {
            var e = f(function* (e, t) {
              const n = (0, l.getBackendSrv)().fetch({ url: `/api/plugins/${e}/settings`, method: 'POST', data: t });
              return (0, d.lastValueFrom)(n);
            });
            return function (t, n) {
              return e.apply(this, arguments);
            };
          })(),
          y = JSON.parse('{"id":"myorg-extensions-app"}');
        function h(e) {
          alert(`You selected query "${e.refId}"`);
        }
        function O(n) {
          const { targets: o = [], onDismiss: i } = n,
            [l, s] = (0, e.useState)(o[0]);
          return t().createElement(
            'div',
            { 'data-testid': r },
            t().createElement(
              'p',
              null,
              'Please select the query you would like to use to create "something" in the plugin.'
            ),
            t().createElement(
              a.HorizontalGroup,
              null,
              o.map((e) =>
                t().createElement(a.FilterPill, {
                  key: e.refId,
                  label: e.refId,
                  selected: e.refId === (null == l ? void 0 : l.refId),
                  onClick: () => s(e),
                })
              )
            ),
            t().createElement(
              a.Modal.ButtonRow,
              null,
              t().createElement(a.Button, { variant: 'secondary', fill: 'outline', onClick: i }, 'Cancel'),
              t().createElement(
                a.Button,
                {
                  disabled: !Boolean(l),
                  onClick: () => {
                    null == i || i(), h(l);
                  },
                },
                'OK'
              )
            )
          );
        }
        function P(e, t, n) {
          return (
            t in e
              ? Object.defineProperty(e, t, { value: n, enumerable: !0, configurable: !0, writable: !0 })
              : (e[t] = n),
            e
          );
        }
        const E = new n.AppPlugin()
          .setRootPage(i)
          .addConfigPage({
            title: 'Configuration',
            icon: 'cog',
            body: ({ plugin: e }) => {
              const n = (0, a.useStyles2)(m),
                { enabled: r, jsonData: o } = e.meta;
              return t().createElement(
                'div',
                null,
                t().createElement(a.Legend, null, 'Enable / Disable '),
                !r &&
                  t().createElement(
                    t().Fragment,
                    null,
                    t().createElement('div', { className: n.colorWeak }, 'The plugin is currently not enabled.'),
                    t().createElement(
                      a.Button,
                      {
                        className: n.marginTop,
                        variant: 'primary',
                        onClick: () => g(e.meta.id, { enabled: !0, pinned: !0, jsonData: o }),
                      },
                      'Enable plugin'
                    )
                  ),
                r &&
                  t().createElement(
                    t().Fragment,
                    null,
                    t().createElement('div', { className: n.colorWeak }, 'The plugin is currently enabled.'),
                    t().createElement(
                      a.Button,
                      {
                        className: n.marginTop,
                        variant: 'destructive',
                        onClick: () => g(e.meta.id, { enabled: !1, pinned: !1, jsonData: o }),
                      },
                      'Disable plugin'
                    )
                  )
              );
            },
            id: 'configuration',
          })
          .configureExtensionLink({
            title: 'Open from time series or pie charts (path)',
            description: 'This link will only be visible on time series and pie charts',
            extensionPointId: n.PluginExtensionPoints.DashboardPanelMenu,
            path: `/a/${y.id}/`,
            configure: (e) => {
              var t;
              if (
                'Link Extensions (path)' ===
                (null == e || null === (t = e.dashboard) || void 0 === t ? void 0 : t.title)
              )
                switch (null == e ? void 0 : e.pluginId) {
                  case 'timeseries':
                    return {};
                  case 'piechart':
                    return { title: `Open from ${e.pluginId}` };
                  default:
                    return;
                }
            },
          })
          .configureExtensionLink({
            title: 'Open from time series or pie charts (onClick)',
            description: 'This link will only be visible on time series and pie charts',
            extensionPointId: n.PluginExtensionPoints.DashboardPanelMenu,
            onClick: (e, { openModal: n, context: r }) => {
              var o;
              const i = null !== (o = null == r ? void 0 : r.targets) && void 0 !== o ? o : [],
                a = null == r ? void 0 : r.title;
              if (!x(r)) return;
              if (i.length > 1)
                return n({
                  title: `Select query from "${a}"`,
                  body: (e) =>
                    t().createElement(
                      O,
                      (function (e, t) {
                        return (
                          (t = null != t ? t : {}),
                          Object.getOwnPropertyDescriptors
                            ? Object.defineProperties(e, Object.getOwnPropertyDescriptors(t))
                            : (function (e, t) {
                                var n = Object.keys(e);
                                if (Object.getOwnPropertySymbols) {
                                  var r = Object.getOwnPropertySymbols(e);
                                  n.push.apply(n, r);
                                }
                                return n;
                              })(Object(t)).forEach(function (n) {
                                Object.defineProperty(e, n, Object.getOwnPropertyDescriptor(t, n));
                              }),
                          e
                        );
                      })(
                        (function (e) {
                          for (var t = 1; t < arguments.length; t++) {
                            var n = null != arguments[t] ? arguments[t] : {},
                              r = Object.keys(n);
                            'function' == typeof Object.getOwnPropertySymbols &&
                              (r = r.concat(
                                Object.getOwnPropertySymbols(n).filter(function (e) {
                                  return Object.getOwnPropertyDescriptor(n, e).enumerable;
                                })
                              )),
                              r.forEach(function (t) {
                                P(e, t, n[t]);
                              });
                          }
                          return e;
                        })({}, e),
                        { targets: i }
                      )
                    ),
                });
              const [l] = i;
              h(l);
            },
            configure: (e) => {
              var t;
              if (
                'Link Extensions (onClick)' ===
                  (null == e || null === (t = e.dashboard) || void 0 === t ? void 0 : t.title) &&
                x(e)
              )
                switch (null == e ? void 0 : e.pluginId) {
                  case 'timeseries':
                    return {};
                  case 'piechart':
                    return { title: `Open from ${e.pluginId}` };
                  default:
                    return;
                }
            },
          });
        function x(e) {
          var t;
          return (null !== (t = null == e ? void 0 : e.targets) && void 0 !== t ? t : []).length > 0;
        }
      })(),
      c
    );
  })());
//# sourceMappingURL=module.js.map
