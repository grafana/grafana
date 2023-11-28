import { css } from '@emotion/css';
import React from 'react';
import { HorizontalGroup, Icon, IconButton, useStyles2 } from '@grafana/ui';
export const OverrideCategoryTitle = ({ isExpanded, registry, matcherUi, overrideName, override, onOverrideRemove, }) => {
    const styles = useStyles2(getStyles);
    const properties = override.properties.map((p) => registry.getIfExists(p.id)).filter((prop) => !!prop);
    const propertyNames = properties.map((p) => p === null || p === void 0 ? void 0 : p.name).join(', ');
    const matcherOptions = matcherUi.optionsToLabel(override.matcher.options);
    return (React.createElement("div", null,
        React.createElement(HorizontalGroup, { justify: "space-between" },
            React.createElement("div", null, overrideName),
            React.createElement(IconButton, { name: "trash-alt", onClick: onOverrideRemove, tooltip: "Remove override" })),
        !isExpanded && (React.createElement("div", { className: styles.overrideDetails },
            React.createElement("div", { className: styles.options, title: matcherOptions },
                matcherOptions,
                " ",
                React.createElement(Icon, { name: "angle-right" }),
                " ",
                propertyNames)))));
};
OverrideCategoryTitle.displayName = 'OverrideTitle';
const getStyles = (theme) => {
    return {
        matcherUi: css `
      padding: ${theme.spacing(1)};
    `,
        propertyPickerWrapper: css `
      margin-top: ${theme.spacing(2)};
    `,
        overrideDetails: css `
      font-size: ${theme.typography.bodySmall.fontSize};
      color: ${theme.colors.text.secondary};
      font-weight: ${theme.typography.fontWeightRegular};
    `,
        options: css `
      overflow: hidden;
      padding-right: ${theme.spacing(4)};
    `,
        unknownLabel: css `
      margin-bottom: 0;
    `,
    };
};
//# sourceMappingURL=OverrideCategoryTitle.js.map