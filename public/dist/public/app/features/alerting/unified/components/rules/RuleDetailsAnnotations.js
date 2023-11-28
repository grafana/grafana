import { css } from '@emotion/css';
import React from 'react';
import { useStyles2 } from '@grafana/ui';
import { useAnnotationLinks } from '../../utils/annotations';
import { AnnotationDetailsField } from '../AnnotationDetailsField';
export function RuleDetailsAnnotations(props) {
    const styles = useStyles2(getStyles);
    const { annotations } = props;
    const annotationLinks = useAnnotationLinks(annotations);
    if (annotations.length === 0) {
        return null;
    }
    return (React.createElement("div", { className: styles.annotations }, annotations.map(([key, value]) => (React.createElement(AnnotationDetailsField, { key: key, annotationKey: key, value: value, valueLink: annotationLinks.get(key) })))));
}
const getStyles = () => ({
    annotations: css `
    margin-top: 46px;
  `,
});
//# sourceMappingURL=RuleDetailsAnnotations.js.map