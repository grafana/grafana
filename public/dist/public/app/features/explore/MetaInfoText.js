import { __makeTemplateObject } from "tslib";
import React, { memo } from 'react';
import { css } from '@emotion/css';
import { useStyles2 } from '@grafana/ui';
var getStyles = function (theme) { return ({
    metaContainer: css(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n    flex: 1;\n    color: ", ";\n    margin-bottom: ", ";\n    min-width: 30%;\n    display: flex;\n    flex-wrap: wrap;\n  "], ["\n    flex: 1;\n    color: ", ";\n    margin-bottom: ", ";\n    min-width: 30%;\n    display: flex;\n    flex-wrap: wrap;\n  "])), theme.colors.text.secondary, theme.spacing(2)),
    metaItem: css(templateObject_2 || (templateObject_2 = __makeTemplateObject(["\n    margin-right: ", ";\n    margin-top: ", ";\n    display: flex;\n    align-items: baseline;\n\n    .logs-meta-item__error {\n      color: ", ";\n    }\n  "], ["\n    margin-right: ", ";\n    margin-top: ", ";\n    display: flex;\n    align-items: baseline;\n\n    .logs-meta-item__error {\n      color: ", ";\n    }\n  "])), theme.spacing(2), theme.spacing(0.5), theme.colors.error.text),
    metaLabel: css(templateObject_3 || (templateObject_3 = __makeTemplateObject(["\n    margin-right: calc(", " / 2);\n    font-size: ", ";\n    font-weight: ", ";\n  "], ["\n    margin-right: calc(", " / 2);\n    font-size: ", ";\n    font-weight: ", ";\n  "])), theme.spacing(2), theme.typography.bodySmall.fontSize, theme.typography.fontWeightMedium),
    metaValue: css(templateObject_4 || (templateObject_4 = __makeTemplateObject(["\n    font-family: ", ";\n    font-size: ", ";\n  "], ["\n    font-family: ", ";\n    font-size: ", ";\n  "])), theme.typography.fontFamilyMonospace, theme.typography.bodySmall.fontSize),
}); };
var MetaInfoItem = memo(function MetaInfoItem(props) {
    var style = useStyles2(getStyles);
    var label = props.label, value = props.value;
    return (React.createElement("div", { className: style.metaItem },
        label && React.createElement("span", { className: style.metaLabel },
            label,
            ":"),
        React.createElement("span", { className: style.metaValue }, value)));
});
export var MetaInfoText = memo(function MetaInfoText(props) {
    var style = useStyles2(getStyles);
    var metaItems = props.metaItems;
    return (React.createElement("div", { className: style.metaContainer }, metaItems.map(function (item, index) { return (React.createElement(MetaInfoItem, { key: index + "-" + item.label, label: item.label, value: item.value })); })));
});
var templateObject_1, templateObject_2, templateObject_3, templateObject_4;
//# sourceMappingURL=MetaInfoText.js.map