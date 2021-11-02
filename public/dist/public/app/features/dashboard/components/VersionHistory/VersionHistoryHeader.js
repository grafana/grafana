import { __makeTemplateObject } from "tslib";
import React from 'react';
import { css } from '@emotion/css';
import { noop } from 'lodash';
import { Icon, useStyles } from '@grafana/ui';
export var VersionHistoryHeader = function (_a) {
    var _b = _a.isComparing, isComparing = _b === void 0 ? false : _b, _c = _a.onClick, onClick = _c === void 0 ? noop : _c, _d = _a.baseVersion, baseVersion = _d === void 0 ? 0 : _d, _e = _a.newVersion, newVersion = _e === void 0 ? 0 : _e, _f = _a.isNewLatest, isNewLatest = _f === void 0 ? false : _f;
    var styles = useStyles(getStyles);
    return (React.createElement("h3", { className: styles.header },
        React.createElement("span", { onClick: onClick, className: isComparing ? 'pointer' : '' }, "Versions"),
        isComparing && (React.createElement("span", null,
            React.createElement(Icon, { name: "angle-right" }),
            " Comparing ",
            baseVersion,
            " ",
            React.createElement(Icon, { name: "arrows-h" }),
            " ",
            newVersion,
            ' ',
            isNewLatest && React.createElement("cite", { className: "muted" }, "(Latest)")))));
};
var getStyles = function (theme) { return ({
    header: css(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n    font-size: ", ";\n    margin-bottom: ", ";\n  "], ["\n    font-size: ", ";\n    margin-bottom: ", ";\n  "])), theme.typography.heading.h3, theme.spacing.lg),
}); };
var templateObject_1;
//# sourceMappingURL=VersionHistoryHeader.js.map