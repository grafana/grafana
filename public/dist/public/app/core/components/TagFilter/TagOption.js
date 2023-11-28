import { css, cx } from '@emotion/css';
import React from 'react';
import { useStyles2 } from '@grafana/ui';
import { TagBadge } from './TagBadge';
export const TagOption = ({ data, className, label, isFocused, innerProps }) => {
    var _a;
    const styles = useStyles2(getStyles);
    return (React.createElement("div", Object.assign({ className: cx(styles.option, isFocused && styles.optionFocused), "aria-label": "Tag option" }, innerProps),
        React.createElement("div", { className: `tag-filter-option ${className || ''}` }, typeof label === 'string' ? React.createElement(TagBadge, { label: label, removeIcon: false, count: (_a = data.count) !== null && _a !== void 0 ? _a : 0 }) : label)));
};
const getStyles = (theme) => {
    return {
        option: css `
      padding: 8px;
      white-space: nowrap;
      cursor: pointer;
      border-left: 2px solid transparent;
      &:hover {
        background: ${theme.colors.background.secondary};
      }
    `,
        optionFocused: css `
      background: ${theme.colors.background.secondary};
      border-style: solid;
      border-top: 0;
      border-right: 0;
      border-bottom: 0;
      border-left-width: 2px;
    `,
    };
};
//# sourceMappingURL=TagOption.js.map