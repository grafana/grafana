import { css } from '@emotion/css';
import React, { useMemo } from 'react';
import { useStyles2 } from '@grafana/ui';
import { isExpressionQuery } from 'app/features/expressions/guards';
import { Expression } from '../expressions/Expression';
import { errorFromPreviewData, warningFromSeries } from './util';
export const ExpressionsEditor = ({ condition, onSetCondition, queries, panelData, onUpdateRefId, onRemoveExpression, onUpdateExpressionType, onUpdateQueryExpression, }) => {
    const expressionQueries = useMemo(() => {
        return queries.reduce((acc, query) => {
            return isExpressionQuery(query.model) ? acc.concat(query.model) : acc;
        }, []);
    }, [queries]);
    const styles = useStyles2(getStyles);
    return (React.createElement("div", { className: styles.wrapper }, expressionQueries.map((query) => {
        const data = panelData[query.refId];
        const isAlertCondition = condition === query.refId;
        const error = data ? errorFromPreviewData(data) : undefined;
        const warning = data ? warningFromSeries(data.series) : undefined;
        return (React.createElement(Expression, { key: query.refId, isAlertCondition: isAlertCondition, data: data, error: error, warning: warning, queries: queries, query: query, onSetCondition: onSetCondition, onRemoveExpression: onRemoveExpression, onUpdateRefId: onUpdateRefId, onUpdateExpressionType: onUpdateExpressionType, onChangeQuery: onUpdateQueryExpression }));
    })));
};
const getStyles = (theme) => ({
    wrapper: css `
    display: flex;
    gap: ${theme.spacing(2)};
    align-content: stretch;
    flex-wrap: wrap;
  `,
});
//# sourceMappingURL=ExpressionsEditor.js.map