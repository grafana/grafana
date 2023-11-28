import { css, cx } from '@emotion/css';
import { pickBy } from 'lodash';
import React from 'react';
import { DEFAULT_SAML_NAME } from '@grafana/data';
import { Icon, LinkButton, useStyles2, useTheme2, VerticalGroup } from '@grafana/ui';
import config from 'app/core/config';
const loginServices = () => {
    var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q, _r, _s, _t, _u, _v, _w, _x, _y, _z, _0, _1, _2, _3;
    const oauthEnabled = !!config.oauth;
    return {
        saml: {
            bgColor: '#464646',
            enabled: config.samlEnabled,
            name: config.samlName || DEFAULT_SAML_NAME,
            icon: 'key-skeleton-alt',
        },
        google: {
            bgColor: '#e84d3c',
            enabled: oauthEnabled && Boolean(config.oauth.google),
            name: ((_b = (_a = config.oauth) === null || _a === void 0 ? void 0 : _a.google) === null || _b === void 0 ? void 0 : _b.name) || 'Google',
            icon: ((_d = (_c = config.oauth) === null || _c === void 0 ? void 0 : _c.google) === null || _d === void 0 ? void 0 : _d.icon) || 'google',
        },
        azuread: {
            bgColor: '#2f2f2f',
            enabled: oauthEnabled && Boolean(config.oauth.azuread),
            name: ((_f = (_e = config.oauth) === null || _e === void 0 ? void 0 : _e.azuread) === null || _f === void 0 ? void 0 : _f.name) || 'Microsoft',
            icon: ((_h = (_g = config.oauth) === null || _g === void 0 ? void 0 : _g.azuread) === null || _h === void 0 ? void 0 : _h.icon) || 'microsoft',
        },
        github: {
            bgColor: '#464646',
            enabled: oauthEnabled && Boolean(config.oauth.github),
            name: ((_k = (_j = config.oauth) === null || _j === void 0 ? void 0 : _j.github) === null || _k === void 0 ? void 0 : _k.name) || 'GitHub',
            icon: ((_m = (_l = config.oauth) === null || _l === void 0 ? void 0 : _l.github) === null || _m === void 0 ? void 0 : _m.icon) || 'github',
        },
        gitlab: {
            bgColor: '#fc6d26',
            enabled: oauthEnabled && Boolean(config.oauth.gitlab),
            name: ((_p = (_o = config.oauth) === null || _o === void 0 ? void 0 : _o.gitlab) === null || _p === void 0 ? void 0 : _p.name) || 'GitLab',
            icon: ((_r = (_q = config.oauth) === null || _q === void 0 ? void 0 : _q.gitlab) === null || _r === void 0 ? void 0 : _r.icon) || 'gitlab',
        },
        grafanacom: {
            bgColor: '#262628',
            enabled: oauthEnabled && Boolean(config.oauth.grafana_com),
            name: ((_t = (_s = config.oauth) === null || _s === void 0 ? void 0 : _s.grafana_com) === null || _t === void 0 ? void 0 : _t.name) || 'Grafana.com',
            icon: ((_v = (_u = config.oauth) === null || _u === void 0 ? void 0 : _u.grafana_com) === null || _v === void 0 ? void 0 : _v.icon) || 'grafana',
            hrefName: 'grafana_com',
        },
        okta: {
            bgColor: '#2f2f2f',
            enabled: oauthEnabled && Boolean(config.oauth.okta),
            name: ((_x = (_w = config.oauth) === null || _w === void 0 ? void 0 : _w.okta) === null || _x === void 0 ? void 0 : _x.name) || 'Okta',
            icon: ((_z = (_y = config.oauth) === null || _y === void 0 ? void 0 : _y.okta) === null || _z === void 0 ? void 0 : _z.icon) || 'okta',
        },
        oauth: {
            bgColor: '#262628',
            enabled: oauthEnabled && Boolean(config.oauth.generic_oauth),
            name: ((_1 = (_0 = config.oauth) === null || _0 === void 0 ? void 0 : _0.generic_oauth) === null || _1 === void 0 ? void 0 : _1.name) || 'OAuth',
            icon: ((_3 = (_2 = config.oauth) === null || _2 === void 0 ? void 0 : _2.generic_oauth) === null || _3 === void 0 ? void 0 : _3.icon) || 'signin',
            hrefName: 'generic_oauth',
        },
    };
};
const getServiceStyles = (theme) => {
    return {
        button: css `
      color: #d8d9da;
      position: relative;
    `,
        buttonIcon: css `
      position: absolute;
      left: ${theme.spacing(1)};
      top: 50%;
      transform: translateY(-50%);
    `,
        divider: {
            base: css `
        color: ${theme.colors.text};
        display: flex;
        margin-bottom: ${theme.spacing(1)};
        justify-content: space-between;
        text-align: center;
        width: 100%;
      `,
            line: css `
        width: 100px;
        height: 10px;
        border-bottom: 1px solid ${theme.colors.text};
      `,
        },
    };
};
const LoginDivider = () => {
    const styles = useStyles2(getServiceStyles);
    return (React.createElement(React.Fragment, null,
        React.createElement("div", { className: styles.divider.base },
            React.createElement("div", null,
                React.createElement("div", { className: styles.divider.line })),
            React.createElement("div", null,
                React.createElement("span", null, !config.disableLoginForm && React.createElement("span", null, "or"))),
            React.createElement("div", null,
                React.createElement("div", { className: styles.divider.line }))),
        React.createElement("div", { className: "clearfix" })));
};
function getButtonStyleFor(service, styles, theme) {
    return cx(styles.button, css `
      background-color: ${service.bgColor};
      color: ${theme.colors.getContrastText(service.bgColor)};

      &:hover {
        background-color: ${theme.colors.emphasize(service.bgColor, 0.15)};
        box-shadow: ${theme.shadows.z1};
      }
    `);
}
export const LoginServiceButtons = () => {
    const enabledServices = pickBy(loginServices(), (service) => service.enabled);
    const hasServices = Object.keys(enabledServices).length > 0;
    const theme = useTheme2();
    const styles = useStyles2(getServiceStyles);
    if (hasServices) {
        return (React.createElement(VerticalGroup, null,
            React.createElement(LoginDivider, null),
            Object.entries(enabledServices).map(([key, service]) => (React.createElement(LinkButton, { key: key, className: getButtonStyleFor(service, styles, theme), href: `login/${service.hrefName ? service.hrefName : key}`, target: "_self", fullWidth: true },
                React.createElement(Icon, { className: styles.buttonIcon, name: service.icon }),
                "Sign in with ",
                service.name)))));
    }
    return null;
};
//# sourceMappingURL=LoginServiceButtons.js.map