import { css, cx } from '@emotion/css';
import React from 'react';
import { stylesFactory, useTheme } from '@grafana/ui';
export const getFieldStyles = stylesFactory((theme) => ({
    label: css `
    font-size: ${theme.typography.size.md};
    font-weight: ${theme.typography.weight.semibold};
    line-height: 1.25;
    margin: ${theme.spacing.formLabelMargin};
    padding: ${theme.spacing.formLabelPadding};
    color: ${theme.colors.formLabel};
    max-width: 480px;
  `,
    labelContent: css `
    display: flex;
    align-items: center;
  `,
    field: css `
    display: flex;
    flex-direction: column;
    margin-bottom: ${theme.spacing.formSpacingBase * 2}px;
  `,
    fieldHorizontal: css `
    flex-direction: row;
    justify-content: space-between;
    flex-wrap: wrap;
  `,
    fieldValidationWrapper: css `
    margin-top: ${theme.spacing.formSpacingBase / 2}px;
  `,
    fieldValidationWrapperHorizontal: css `
    flex: 1 1 100%;
  `,
}));
export const Field = ({ label, invalid, loading, disabled, required, children, className }) => {
    const theme = useTheme();
    let inputId;
    const styles = getFieldStyles(theme);
    // Get the first, and only, child to retrieve form input's id
    const child = React.Children.map(children, (c) => c)[0];
    if (child) {
        // Retrieve input's id to apply on the label for correct click interaction
        inputId = child.props.id;
    }
    return (React.createElement("div", { className: cx(styles.field, className) },
        label && (React.createElement("div", { className: cx(styles.label, className) },
            React.createElement("label", { htmlFor: inputId },
                React.createElement("div", { className: styles.labelContent }, `${label}${required ? ' *' : ''}`)))),
        React.createElement("div", null, React.cloneElement(children, { invalid, disabled, loading }))));
};
//# sourceMappingURL=Field.js.map