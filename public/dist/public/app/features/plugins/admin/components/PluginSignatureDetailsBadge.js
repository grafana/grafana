var _a;
import { __makeTemplateObject } from "tslib";
import React from 'react';
import { css } from '@emotion/css';
import { capitalize } from 'lodash';
import { PluginSignatureType } from '@grafana/data';
import { useStyles2, Icon, Badge } from '@grafana/ui';
var SIGNATURE_ICONS = (_a = {},
    _a[PluginSignatureType.grafana] = 'grafana',
    _a[PluginSignatureType.commercial] = 'shield',
    _a[PluginSignatureType.community] = 'shield',
    _a.DEFAULT = 'shield-exclamation',
    _a);
// Shows more information about a valid signature
export function PluginSignatureDetailsBadge(_a) {
    var signatureType = _a.signatureType, _b = _a.signatureOrg, signatureOrg = _b === void 0 ? '' : _b;
    var styles = useStyles2(getStyles);
    if (!signatureType && !signatureOrg) {
        return null;
    }
    var signatureTypeText = signatureType === PluginSignatureType.grafana ? 'Grafana Labs' : capitalize(signatureType);
    var signatureIcon = SIGNATURE_ICONS[signatureType || ''] || SIGNATURE_ICONS.DEFAULT;
    return (React.createElement(React.Fragment, null,
        React.createElement(DetailsBadge, null,
            React.createElement("strong", { className: styles.strong }, "Level:\u00A0"),
            React.createElement(Icon, { size: "xs", name: signatureIcon }),
            "\u00A0",
            signatureTypeText),
        React.createElement(DetailsBadge, null,
            React.createElement("strong", { className: styles.strong }, "Signed by:"),
            " ",
            signatureOrg)));
}
export var DetailsBadge = function (_a) {
    var children = _a.children;
    var styles = useStyles2(getStyles);
    return React.createElement(Badge, { color: "green", className: styles.badge, text: React.createElement(React.Fragment, null, children) });
};
var getStyles = function (theme) { return ({
    badge: css(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n    background-color: ", ";\n    border-color: ", ";\n    color: ", ";\n    margin-left: ", ";\n  "], ["\n    background-color: ", ";\n    border-color: ", ";\n    color: ", ";\n    margin-left: ", ";\n  "])), theme.colors.background.canvas, theme.colors.border.strong, theme.colors.text.secondary, theme.spacing()),
    strong: css(templateObject_2 || (templateObject_2 = __makeTemplateObject(["\n    color: ", ";\n  "], ["\n    color: ", ";\n  "])), theme.colors.text.primary),
    icon: css(templateObject_3 || (templateObject_3 = __makeTemplateObject(["\n    margin-right: ", ";\n  "], ["\n    margin-right: ", ";\n  "])), theme.spacing(0.5)),
}); };
var templateObject_1, templateObject_2, templateObject_3;
//# sourceMappingURL=PluginSignatureDetailsBadge.js.map