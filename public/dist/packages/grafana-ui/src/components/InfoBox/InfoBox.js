import { __assign, __makeTemplateObject, __rest } from "tslib";
import React from 'react';
import { css, cx } from '@emotion/css';
import { Icon } from '../Icon/Icon';
import { Alert } from '../Alert/Alert';
import { stylesFactory, useStyles2 } from '../../themes';
/** @deprecated use Alert with severity info */
export var InfoBox = React.memo(React.forwardRef(function (_a, ref) {
    var title = _a.title, className = _a.className, children = _a.children, branded = _a.branded, url = _a.url, urlTitle = _a.urlTitle, onDismiss = _a.onDismiss, _b = _a.severity, severity = _b === void 0 ? 'info' : _b, otherProps = __rest(_a, ["title", "className", "children", "branded", "url", "urlTitle", "onDismiss", "severity"]);
    var styles = useStyles2(getStyles);
    return (React.createElement(Alert, __assign({ severity: severity, className: className }, otherProps, { ref: ref, title: title }),
        React.createElement("div", null, children),
        url && (React.createElement("a", { href: url, className: cx('external-link', styles.docsLink), target: "_blank", rel: "noreferrer" },
            React.createElement(Icon, { name: "book" }),
            " ",
            urlTitle || 'Read more'))));
}));
InfoBox.displayName = 'InfoBox';
var getStyles = stylesFactory(function (theme) {
    return {
        docsLink: css(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n      display: inline-block;\n      margin-top: ", ";\n    "], ["\n      display: inline-block;\n      margin-top: ", ";\n    "])), theme.spacing(2)),
    };
});
var templateObject_1;
//# sourceMappingURL=InfoBox.js.map