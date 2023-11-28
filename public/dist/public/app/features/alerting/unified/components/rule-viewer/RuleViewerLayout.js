import { css } from '@emotion/css';
import React from 'react';
import { useStyles2 } from '@grafana/ui';
import { Page } from 'app/core/components/Page/Page';
const defaultPageNav = {
    icon: 'bell',
    id: 'alert-rule-view',
};
export function RuleViewerLayout(props) {
    const { wrapInContent = true, children, title } = props;
    const styles = useStyles2(getPageStyles);
    return (React.createElement(Page, { pageNav: Object.assign(Object.assign({}, defaultPageNav), { text: title }), navId: "alert-list" },
        React.createElement(Page.Contents, null,
            React.createElement("div", { className: styles.content }, wrapInContent ? React.createElement(RuleViewerLayoutContent, Object.assign({}, props)) : children))));
}
export function RuleViewerLayoutContent({ children, padding = 2 }) {
    const styles = useStyles2(getContentStyles(padding));
    return React.createElement("div", { className: styles.wrapper }, children);
}
const getPageStyles = (theme) => {
    return {
        content: css `
      max-width: ${theme.breakpoints.values.xxl}px;
    `,
    };
};
const getContentStyles = (padding) => (theme) => {
    return {
        wrapper: css `
      background: ${theme.colors.background.primary};
      border: 1px solid ${theme.colors.border.weak};
      border-radius: ${theme.shape.radius.default};
      padding: ${theme.spacing(padding)};
    `,
    };
};
//# sourceMappingURL=RuleViewerLayout.js.map