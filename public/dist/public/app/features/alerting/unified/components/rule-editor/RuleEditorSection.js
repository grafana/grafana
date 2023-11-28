import { css, cx } from '@emotion/css';
import React from 'react';
import { Stack } from '@grafana/experimental';
import { FieldSet, Text, useStyles2 } from '@grafana/ui';
export const RuleEditorSection = ({ title, stepNo, children, fullWidth = false, description, }) => {
    const styles = useStyles2(getStyles);
    return (React.createElement("div", { className: styles.parent },
        React.createElement(FieldSet, { className: cx(fullWidth && styles.fullWidth), label: React.createElement(Text, { variant: "h3" },
                stepNo,
                ". ",
                title) },
            React.createElement(Stack, { direction: "column" },
                description && React.createElement("div", { className: styles.description }, description),
                children))));
};
const getStyles = (theme) => ({
    parent: css `
    display: flex;
    flex-direction: row;
    max-width: ${theme.breakpoints.values.xl}px;
    border: solid 1px ${theme.colors.border.weak};
    border-radius: ${theme.shape.radius.default};
    padding: ${theme.spacing(2)} ${theme.spacing(3)};
  `,
    description: css `
    margin-top: -${theme.spacing(2)};
  `,
    fullWidth: css `
    width: 100%;
  `,
});
//# sourceMappingURL=RuleEditorSection.js.map