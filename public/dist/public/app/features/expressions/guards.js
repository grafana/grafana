import { ExpressionDatasourceID } from './ExpressionDatasource';
import { ExpressionQueryType } from './types';
export var isExpressionQuery = function (dataQuery) {
    if (!dataQuery) {
        return false;
    }
    if (dataQuery.datasource === ExpressionDatasourceID) {
        return true;
    }
    var expression = dataQuery;
    if (typeof expression.type !== 'string') {
        return false;
    }
    return Object.values(ExpressionQueryType).includes(expression.type);
};
//# sourceMappingURL=guards.js.map