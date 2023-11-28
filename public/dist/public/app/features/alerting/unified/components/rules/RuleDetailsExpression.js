import { css, cx } from '@emotion/css';
import React from 'react';
import { isCloudRulesSource } from '../../utils/datasource';
import { DetailsField } from '../DetailsField';
import { Expression } from '../Expression';
export function RuleDetailsExpression(props) {
    const { annotations, rulesSource, rule } = props;
    const styles = getStyles();
    if (!isCloudRulesSource(rulesSource)) {
        return null;
    }
    return (React.createElement(DetailsField, { label: "Expression", horizontal: true, className: cx({ [styles.exprRow]: !!annotations.length }) },
        React.createElement(Expression, { expression: rule.query, rulesSource: rulesSource })));
}
const getStyles = () => ({
    exprRow: css `
    margin-bottom: 46px;
  `,
});
//# sourceMappingURL=RuleDetailsExpression.js.map