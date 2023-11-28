import { css } from '@emotion/css';
import React from 'react';
import { textUtil } from '@grafana/data';
import { Tooltip, useStyles2 } from '@grafana/ui';
import { annotationLabels } from '../utils/constants';
import { DetailsField } from './DetailsField';
import { Tokenize } from './Tokenize';
import { Well } from './Well';
const wellableAnnotationKeys = ['message', 'description'];
export const AnnotationDetailsField = ({ annotationKey, value, valueLink }) => {
    const label = annotationLabels[annotationKey] ? (React.createElement(Tooltip, { content: annotationKey, placement: "top", theme: "info" },
        React.createElement("span", null, annotationLabels[annotationKey]))) : (annotationKey);
    return (React.createElement(DetailsField, { label: label, horizontal: true },
        React.createElement(AnnotationValue, { annotationKey: annotationKey, value: value, valueLink: valueLink })));
};
const AnnotationValue = ({ annotationKey, value, valueLink }) => {
    const styles = useStyles2(getStyles);
    const needsWell = wellableAnnotationKeys.includes(annotationKey);
    const needsExternalLink = value && value.startsWith('http');
    const tokenizeValue = React.createElement(Tokenize, { input: value, delimiter: ['{{', '}}'] });
    if (valueLink) {
        return (React.createElement("a", { href: textUtil.sanitizeUrl(valueLink), className: styles.link }, value));
    }
    if (needsWell) {
        return React.createElement(Well, { className: styles.well }, tokenizeValue);
    }
    if (needsExternalLink) {
        return (React.createElement("a", { href: textUtil.sanitizeUrl(value), target: "__blank", className: styles.link }, value));
    }
    return React.createElement(React.Fragment, null, tokenizeValue);
};
export const getStyles = (theme) => ({
    well: css `
    word-break: break-word;
  `,
    link: css `
    word-break: break-all;
    color: ${theme.colors.primary.text};
  `,
});
//# sourceMappingURL=AnnotationDetailsField.js.map