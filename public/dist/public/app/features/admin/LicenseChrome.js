import { __assign, __makeTemplateObject } from "tslib";
import React from 'react';
import { stylesFactory, useTheme } from '@grafana/ui';
import { css } from '@emotion/css';
var title = { fontWeight: 500, fontSize: '26px', lineHeight: '123%' };
var getStyles = stylesFactory(function (theme) {
    var backgroundUrl = theme.isDark ? 'public/img/licensing/header_dark.svg' : 'public/img/licensing/header_light.svg';
    var footerBg = theme.isDark ? theme.palette.dark9 : theme.palette.gray6;
    return {
        container: css(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n      padding: 36px 79px;\n      background: ", ";\n    "], ["\n      padding: 36px 79px;\n      background: ", ";\n    "])), theme.colors.panelBg),
        footer: css(templateObject_2 || (templateObject_2 = __makeTemplateObject(["\n      text-align: center;\n      padding: 16px;\n      background: ", ";\n    "], ["\n      text-align: center;\n      padding: 16px;\n      background: ", ";\n    "])), footerBg),
        header: css(templateObject_3 || (templateObject_3 = __makeTemplateObject(["\n      height: 137px;\n      padding: 40px 0 0 79px;\n      position: relative;\n      background: url('", "') right;\n    "], ["\n      height: 137px;\n      padding: 40px 0 0 79px;\n      position: relative;\n      background: url('", "') right;\n    "])), backgroundUrl),
    };
});
export var LicenseChrome = function (_a) {
    var header = _a.header, editionNotice = _a.editionNotice, subheader = _a.subheader, children = _a.children;
    var theme = useTheme();
    var styles = getStyles(theme);
    return (React.createElement(React.Fragment, null,
        React.createElement("div", { className: styles.header },
            React.createElement("h2", { style: title }, header),
            subheader && React.createElement("h3", null, subheader),
            React.createElement(Circle, { size: "128px", style: {
                    boxShadow: '0px 0px 24px rgba(24, 58, 110, 0.45)',
                    background: '#0A1C36',
                    position: 'absolute',
                    top: '19px',
                    left: '71%',
                } },
                React.createElement("img", { src: "public/img/grafana_icon.svg", alt: "Grafana", width: "80px", style: { position: 'absolute', left: '23px', top: '20px' } }))),
        React.createElement("div", { className: styles.container }, children),
        editionNotice && React.createElement("div", { className: styles.footer }, editionNotice)));
};
export var Circle = function (_a) {
    var size = _a.size, style = _a.style, children = _a.children;
    return (React.createElement("div", { style: __assign({ width: size, height: size, position: 'absolute', bottom: 0, right: 0, borderRadius: '50%' }, style) }, children));
};
var templateObject_1, templateObject_2, templateObject_3;
//# sourceMappingURL=LicenseChrome.js.map