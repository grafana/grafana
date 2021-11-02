import { __makeTemplateObject } from "tslib";
import React from 'react';
import { css } from '@emotion/css';
import { dateTimeFormatTimeAgo } from '@grafana/data';
import { useStyles2 } from '@grafana/ui';
export var VersionList = function (_a) {
    var _b = _a.versions, versions = _b === void 0 ? [] : _b;
    var styles = useStyles2(getStyles);
    if (versions.length === 0) {
        return React.createElement("p", null, "No version history was found.");
    }
    return (React.createElement("table", { className: styles.table },
        React.createElement("thead", null,
            React.createElement("tr", null,
                React.createElement("th", null, "Version"),
                React.createElement("th", null, "Last updated"))),
        React.createElement("tbody", null, versions.map(function (version) {
            return (React.createElement("tr", { key: version.version },
                React.createElement("td", null, version.version),
                React.createElement("td", null, dateTimeFormatTimeAgo(version.createdAt))));
        }))));
};
var getStyles = function (theme) { return ({
    container: css(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n    padding: ", ";\n  "], ["\n    padding: ", ";\n  "])), theme.spacing(2, 4, 3)),
    table: css(templateObject_2 || (templateObject_2 = __makeTemplateObject(["\n    width: 100%;\n    td,\n    th {\n      padding: ", " 0;\n    }\n    th {\n      font-size: ", ";\n    }\n  "], ["\n    width: 100%;\n    td,\n    th {\n      padding: ", " 0;\n    }\n    th {\n      font-size: ", ";\n    }\n  "])), theme.spacing(), theme.typography.h5.fontSize),
}); };
var templateObject_1, templateObject_2;
//# sourceMappingURL=VersionList.js.map