define(['@grafana/data', 'react'], (e, t) =>
  (() => {
    'use strict';
    var o = {
        781: (t) => {
          t.exports = e;
        },
        959: (e) => {
          e.exports = t;
        },
      },
      r = {};
    function n(e) {
      var t = r[e];
      if (void 0 !== t) return t.exports;
      var a = (r[e] = { exports: {} });
      return o[e](a, a.exports, n), a.exports;
    }
    (n.d = (e, t) => {
      for (var o in t) n.o(t, o) && !n.o(e, o) && Object.defineProperty(e, o, { enumerable: !0, get: t[o] });
    }),
      (n.o = (e, t) => Object.prototype.hasOwnProperty.call(e, t)),
      (n.r = (e) => {
        'undefined' != typeof Symbol &&
          Symbol.toStringTag &&
          Object.defineProperty(e, Symbol.toStringTag, { value: 'Module' }),
          Object.defineProperty(e, '__esModule', { value: !0 });
      });
    var a = {};
    return (
      (() => {
        n.r(a), n.d(a, { plugin: () => i });
        var e = n(781),
          t = n(959);
        const o = 'a-app-body';
        class r extends t.PureComponent {
          render() {
            return t.createElement('div', { 'data-testid': o, className: 'page-container' }, 'Hello Grafana!');
          }
        }
        const i = new e.AppPlugin()
          .setRootPage(r)
          .configureExtensionLink({
            title: 'Go to A',
            description: 'Navigating to pluging A',
            extensionPointId: 'plugins/myorg-extensionpoint-app/actions',
            path: '/a/myorg-a-app/',
          });
      })(),
      a
    );
  })());
//# sourceMappingURL=module.js.map
