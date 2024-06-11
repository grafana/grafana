define(['react', '@grafana/data'], (e, t) =>
  (() => {
    'use strict';
    let r = {
        781: (e) => {
          e.exports = t;
        },
        959: (t) => {
          t.exports = e;
        },
      },
      o = {};
    function n(e) {
      let t = o[e];
      if (void 0 !== t) {
        return t.exports;
      }
      let a = (o[e] = { exports: {} });
      return r[e](a, a.exports, n), a.exports;
    }
    (n.n = (e) => {
      let t = e && e.__esModule ? () => e.default : () => e;
      return n.d(t, { a: t }), t;
    }),
      (n.d = (e, t) => {
        for (let r in t) {
          n.o(t, r) && !n.o(e, r) && Object.defineProperty(e, r, { enumerable: !0, get: t[r] });
        }
      }),
      (n.o = (e, t) => Object.prototype.hasOwnProperty.call(e, t)),
      (n.r = (e) => {
        'undefined' !== typeof Symbol &&
          Symbol.toStringTag &&
          Object.defineProperty(e, Symbol.toStringTag, { value: 'Module' }),
          Object.defineProperty(e, '__esModule', { value: !0 });
      });
    let a = {};
    return (
      (() => {
        n.r(a), n.d(a, { plugin: () => p });
        let e = n(959),
          t = n.n(e),
          r = n(781);
        class o extends e.PureComponent {
          render() {
            return e.createElement('div', { className: 'page-container' }, 'Hello Grafana!');
          }
        }
        const i = 'b-app-modal',
          p = new r.AppPlugin().setRootPage(o).configureExtensionLink({
            title: 'Open from B',
            description: 'Open a modal from plugin B',
            extensionPointId: 'plugins/myorg-extensionpoint-app/actions',
            onClick: (e, { openModal: r }) => {
              r({
                title: 'Modal from app B',
                body: () => t().createElement('div', { 'data-testid': i }, 'From plugin B'),
              });
            },
          });
      })(),
      a
    );
  })());
//# sourceMappingURL=module.js.map
