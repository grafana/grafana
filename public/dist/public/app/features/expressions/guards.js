import { isExpressionReference } from '@grafana/runtime/src/utils/DataSourceWithBackend';
import { ExpressionQueryType } from './types';
export const isExpressionQuery = (dataQuery) => {
    if (!dataQuery) {
        return false;
    }
    if (isExpressionReference(dataQuery.datasource)) {
        return true;
    }
    const expression = dataQuery;
    if (typeof expression.type !== 'string') {
        return false;
    }
    return Object.values(ExpressionQueryType).includes(expression.type);
};
//# sourceMappingURL=guards.js.map