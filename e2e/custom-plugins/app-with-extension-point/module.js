define(['@grafana/data', 'react', '@grafana/ui', '@grafana/runtime'], (e, t, n, a) =>
  (() => {
    'use strict';
    var o = {
        781: (t) => {
          t.exports = e;
        },
        531: (e) => {
          e.exports = a;
        },
        7: (e) => {
          e.exports = n;
        },
        959: (e) => {
          e.exports = t;
        },
      },
      r = {};
    function i(e) {
      var t = r[e];
      if (void 0 !== t) return t.exports;
      var n = (r[e] = { exports: {} });
      return o[e](n, n.exports, i), n.exports;
    }
    (i.n = (e) => {
      var t = e && e.__esModule ? () => e.default : () => e;
      return i.d(t, { a: t }), t;
    }),
      (i.d = (e, t) => {
        for (var n in t) i.o(t, n) && !i.o(e, n) && Object.defineProperty(e, n, { enumerable: !0, get: t[n] });
      }),
      (i.g = (function () {
        if ('object' == typeof globalThis) return globalThis;
        try {
          return this || new Function('return this')();
        } catch (e) {
          if ('object' == typeof window) return window;
        }
      })()),
      (i.o = (e, t) => Object.prototype.hasOwnProperty.call(e, t)),
      (i.r = (e) => {
        'undefined' != typeof Symbol &&
          Symbol.toStringTag &&
          Object.defineProperty(e, Symbol.toStringTag, { value: 'Module' }),
          Object.defineProperty(e, '__esModule', { value: !0 });
      });
    var l = {};
    return (
      (() => {
        i.r(l), i.d(l, { plugin: () => p });
        var e = i(781),
          t = i(959),
          n = i.n(t),
          a = i(7),
          o = i(531);
        const r = {
          container: 'main-app-body',
          actions: { button: 'action-button' },
          modal: { container: 'container', open: 'open-link' },
          appA: { container: 'a-app-body' },
          appB: { modal: 'b-app-modal' },
        };
        function s(t) {
          const { onDismiss: l, title: s, path: c } = t;
          return n().createElement(
            a.Modal,
            { 'data-testid': r.modal.container, title: s, isOpen: !0, onDismiss: l },
            n().createElement(
              a.VerticalGroup,
              { spacing: 'sm' },
              n().createElement('p', null, 'Do you want to proceed in the current tab or open a new tab?')
            ),
            n().createElement(
              a.Modal.ButtonRow,
              null,
              n().createElement(a.Button, { onClick: l, fill: 'outline', variant: 'secondary' }, 'Cancel'),
              n().createElement(
                a.Button,
                {
                  type: 'submit',
                  variant: 'secondary',
                  onClick: () => {
                    i.g.open(e.locationUtil.assureBaseUrl(c), '_blank'), l();
                  },
                  icon: 'external-link-alt',
                },
                'Open in new tab'
              ),
              n().createElement(
                a.Button,
                {
                  'data-testid': r.modal.open,
                  type: 'submit',
                  variant: 'primary',
                  onClick: () => o.locationService.push(c),
                  icon: 'apps',
                },
                'Open'
              )
            )
          );
        }
        function c(e) {
          const i =
            ((l = e.extensions),
            (0, t.useMemo)(
              () =>
                l.reduce(
                  (e, t) => (
                    (0, o.isPluginExtensionLink)(t) && e.push({ label: t.title, title: t.title, value: t }), e
                  ),
                  []
                ),
              [l]
            ));
          var l;
          const [c, u] = (0, t.useState)();
          return 0 === i.length
            ? n().createElement(a.Button, null, 'Run default action')
            : n().createElement(
                n().Fragment,
                null,
                n().createElement(
                  a.ButtonGroup,
                  null,
                  n().createElement(
                    a.ToolbarButton,
                    {
                      key: 'default-action',
                      variant: 'canvas',
                      onClick: () => alert('You triggered the default action'),
                    },
                    'Run default action'
                  ),
                  n().createElement(a.ButtonSelect, {
                    'data-testid': r.actions.button,
                    key: 'select-extension',
                    variant: 'canvas',
                    options: i,
                    onChange: (e) => {
                      const t = e.value;
                      if ((0, o.isPluginExtensionLink)(t)) {
                        if (t.path) return u(t);
                        if (t.onClick) return t.onClick();
                      }
                    },
                  })
                ),
                c &&
                  (null == c ? void 0 : c.path) &&
                  n().createElement(s, { title: c.title, path: c.path, onDismiss: () => u(void 0) })
              );
        }
        class u extends n().PureComponent {
          render() {
            const { extensions: e } = (0, o.getPluginExtensions)({
              extensionPointId: 'plugins/myorg-extensionpoint-app/actions',
              context: {},
            });
            return n().createElement(
              'div',
              { 'data-testid': r.container, style: { marginTop: '5%' } },
              n().createElement(
                a.HorizontalGroup,
                { align: 'flex-start', justify: 'center' },
                n().createElement(
                  a.HorizontalGroup,
                  null,
                  n().createElement(
                    'span',
                    null,
                    'Hello Grafana! These are the actions you can trigger from this plugin'
                  ),
                  n().createElement(c, { extensions: e })
                )
              )
            );
          }
        }
        const p = new e.AppPlugin().setRootPage(u);
      })(),
      l
    );
  })());
//# sourceMappingURL=module.js.map
