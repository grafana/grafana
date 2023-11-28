import { css } from '@emotion/css';
import React from 'react';
import { Input, useStyles2 } from '@grafana/ui';
const CustomAnnotationHeaderField = ({ field }) => {
    const styles = useStyles2(getStyles);
    return (React.createElement("div", null,
        React.createElement("span", { className: styles.annotationTitle }, "Custom annotation name and content"),
        React.createElement(Input, Object.assign({ placeholder: "Enter custom annotation name...", width: 18 }, field, { className: styles.customAnnotationInput }))));
};
const getStyles = (theme) => ({
    annotationTitle: css `
    color: ${theme.colors.text.primary};
    margin-bottom: 3px;
  `,
    customAnnotationInput: css `
    margin-top: 5px;
    width: 100%;
  `,
});
export default CustomAnnotationHeaderField;
//# sourceMappingURL=CustomAnnotationHeaderField.js.map