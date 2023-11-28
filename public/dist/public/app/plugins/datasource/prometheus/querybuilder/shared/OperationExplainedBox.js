import { css } from '@emotion/css';
import React from 'react';
import { renderMarkdown } from '@grafana/data';
import { useStyles2 } from '@grafana/ui';
export function OperationExplainedBox({ title, stepNumber, markdown, children }) {
    const styles = useStyles2(getStyles);
    return (React.createElement("div", { className: styles.box },
        stepNumber !== undefined && React.createElement("div", { className: styles.stepNumber }, stepNumber),
        React.createElement("div", { className: styles.boxInner },
            title && (React.createElement("div", { className: styles.header },
                React.createElement("span", null, title))),
            React.createElement("div", { className: styles.body },
                markdown && React.createElement("div", { dangerouslySetInnerHTML: { __html: renderMarkdown(markdown) } }),
                children))));
}
const getStyles = (theme) => {
    return {
        box: css({
            background: theme.colors.background.secondary,
            padding: theme.spacing(1),
            borderRadius: theme.shape.radius.default,
            position: 'relative',
        }),
        boxInner: css({
            marginLeft: theme.spacing(4),
        }),
        stepNumber: css({
            fontWeight: theme.typography.fontWeightMedium,
            background: theme.colors.secondary.main,
            width: '20px',
            height: '20px',
            borderRadius: theme.shape.radius.circle,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            position: 'absolute',
            top: '10px',
            left: '11px',
            fontSize: theme.typography.bodySmall.fontSize,
        }),
        header: css({
            paddingBottom: theme.spacing(0.5),
            display: 'flex',
            alignItems: 'center',
            fontFamily: theme.typography.fontFamilyMonospace,
        }),
        body: css({
            color: theme.colors.text.secondary,
            'p:last-child': {
                margin: 0,
            },
            a: {
                color: theme.colors.text.link,
                textDecoration: 'underline',
            },
        }),
    };
};
//# sourceMappingURL=OperationExplainedBox.js.map