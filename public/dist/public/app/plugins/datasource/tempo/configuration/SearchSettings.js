import { __assign, __makeTemplateObject } from "tslib";
import { css } from '@emotion/css';
import { updateDatasourcePluginJsonDataOption } from '@grafana/data';
import { InlineField, InlineFieldRow, InlineSwitch, useStyles } from '@grafana/ui';
import React from 'react';
export function SearchSettings(_a) {
    var _b;
    var options = _a.options, onOptionsChange = _a.onOptionsChange;
    var styles = useStyles(getStyles);
    return (React.createElement("div", { className: styles.container },
        React.createElement("h3", { className: "page-heading" }, "Search"),
        React.createElement(InlineFieldRow, { className: styles.row },
            React.createElement(InlineField, { tooltip: "Removes the Search tab from the Tempo query editor.", label: "Hide search", labelWidth: 26 },
                React.createElement(InlineSwitch, { value: (_b = options.jsonData.search) === null || _b === void 0 ? void 0 : _b.hide, onChange: function (event) {
                        return updateDatasourcePluginJsonDataOption({ onOptionsChange: onOptionsChange, options: options }, 'search', __assign(__assign({}, options.jsonData.search), { hide: event.currentTarget.checked }));
                    } })))));
}
var getStyles = function (theme) { return ({
    container: css(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n    label: container;\n    width: 100%;\n  "], ["\n    label: container;\n    width: 100%;\n  "]))),
    row: css(templateObject_2 || (templateObject_2 = __makeTemplateObject(["\n    label: row;\n    align-items: baseline;\n  "], ["\n    label: row;\n    align-items: baseline;\n  "]))),
}); };
var templateObject_1, templateObject_2;
//# sourceMappingURL=SearchSettings.js.map