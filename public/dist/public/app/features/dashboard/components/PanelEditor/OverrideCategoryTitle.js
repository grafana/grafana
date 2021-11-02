import { __makeTemplateObject } from "tslib";
import React from 'react';
import { HorizontalGroup, Icon, IconButton, useStyles } from '@grafana/ui';
import { css } from '@emotion/css';
export var OverrideCategoryTitle = function (_a) {
    var isExpanded = _a.isExpanded, registry = _a.registry, matcherUi = _a.matcherUi, overrideName = _a.overrideName, override = _a.override, onOverrideRemove = _a.onOverrideRemove;
    var styles = useStyles(getStyles);
    var properties = override.properties.map(function (p) { return registry.getIfExists(p.id); }).filter(function (prop) { return !!prop; });
    var propertyNames = properties.map(function (p) { return p === null || p === void 0 ? void 0 : p.name; }).join(', ');
    var matcherOptions = matcherUi.optionsToLabel(override.matcher.options);
    return (React.createElement("div", null,
        React.createElement(HorizontalGroup, { justify: "space-between" },
            React.createElement("div", null, overrideName),
            isExpanded && React.createElement(IconButton, { name: "trash-alt", onClick: onOverrideRemove, title: "Remove override" })),
        !isExpanded && (React.createElement("div", { className: styles.overrideDetails },
            React.createElement("div", { className: styles.options, title: matcherOptions },
                matcherOptions,
                " ",
                React.createElement(Icon, { name: "angle-right" }),
                " ",
                propertyNames)))));
};
OverrideCategoryTitle.displayName = 'OverrideTitle';
var getStyles = function (theme) {
    return {
        matcherUi: css(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n      padding: ", ";\n    "], ["\n      padding: ", ";\n    "])), theme.spacing.sm),
        propertyPickerWrapper: css(templateObject_2 || (templateObject_2 = __makeTemplateObject(["\n      margin-top: ", "px;\n    "], ["\n      margin-top: ", "px;\n    "])), theme.spacing.formSpacingBase * 2),
        overrideDetails: css(templateObject_3 || (templateObject_3 = __makeTemplateObject(["\n      font-size: ", ";\n      color: ", ";\n      font-weight: ", ";\n    "], ["\n      font-size: ", ";\n      color: ", ";\n      font-weight: ", ";\n    "])), theme.typography.size.sm, theme.colors.textWeak, theme.typography.weight.regular),
        options: css(templateObject_4 || (templateObject_4 = __makeTemplateObject(["\n      overflow: hidden;\n      padding-right: ", ";\n    "], ["\n      overflow: hidden;\n      padding-right: ", ";\n    "])), theme.spacing.xl),
        unknownLabel: css(templateObject_5 || (templateObject_5 = __makeTemplateObject(["\n      margin-bottom: 0;\n    "], ["\n      margin-bottom: 0;\n    "]))),
    };
};
var templateObject_1, templateObject_2, templateObject_3, templateObject_4, templateObject_5;
//# sourceMappingURL=OverrideCategoryTitle.js.map