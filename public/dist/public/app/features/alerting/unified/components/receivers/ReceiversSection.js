import { __makeTemplateObject } from "tslib";
import { css, cx } from '@emotion/css';
import { Button, useStyles2 } from '@grafana/ui';
import React from 'react';
import { Link } from 'react-router-dom';
export var ReceiversSection = function (_a) {
    var className = _a.className, title = _a.title, description = _a.description, addButtonLabel = _a.addButtonLabel, addButtonTo = _a.addButtonTo, children = _a.children, _b = _a.showButton, showButton = _b === void 0 ? true : _b;
    var styles = useStyles2(getStyles);
    return (React.createElement(React.Fragment, null,
        React.createElement("div", { className: cx(styles.heading, className) },
            React.createElement("div", null,
                React.createElement("h4", null, title),
                React.createElement("p", { className: styles.description }, description)),
            showButton && (React.createElement(Link, { to: addButtonTo },
                React.createElement(Button, { icon: "plus" }, addButtonLabel)))),
        children));
};
var getStyles = function (theme) { return ({
    heading: css(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n    display: flex;\n    justify-content: space-between;\n  "], ["\n    display: flex;\n    justify-content: space-between;\n  "]))),
    description: css(templateObject_2 || (templateObject_2 = __makeTemplateObject(["\n    color: ", ";\n  "], ["\n    color: ", ";\n  "])), theme.colors.text.secondary),
}); };
var templateObject_1, templateObject_2;
//# sourceMappingURL=ReceiversSection.js.map