import { getTemplateSrv } from 'app/features/templating/template_srv';
import { QueryEditorExpressionType, } from '../../expressions';
export default class SQLGenerator {
    constructor(templateSrv = getTemplateSrv()) {
        this.templateSrv = templateSrv;
    }
    expressionToSqlQuery({ select, from, where, groupBy, orderBy, orderByDirection, limit, }) {
        var _a, _b, _c;
        if (!from || !(select === null || select === void 0 ? void 0 : select.name) || !((_a = select === null || select === void 0 ? void 0 : select.parameters) === null || _a === void 0 ? void 0 : _a.length)) {
            return undefined;
        }
        let parts = [];
        this.appendSelect(select, parts);
        this.appendFrom(from, parts);
        this.appendWhere(where, parts, true, (_c = (_b = where === null || where === void 0 ? void 0 : where.expressions) === null || _b === void 0 ? void 0 : _b.length) !== null && _c !== void 0 ? _c : 0);
        this.appendGroupBy(groupBy, parts);
        this.appendOrderBy(orderBy, orderByDirection, parts);
        this.appendLimit(limit, parts);
        return parts.join(' ');
    }
    appendSelect(select, parts) {
        parts.push('SELECT');
        this.appendFunction(select, parts);
    }
    appendFrom(from, parts) {
        var _a, _b;
        parts.push('FROM');
        (from === null || from === void 0 ? void 0 : from.type) === QueryEditorExpressionType.Function
            ? this.appendFunction(from, parts)
            : parts.push(this.formatValue((_b = (_a = from === null || from === void 0 ? void 0 : from.property) === null || _a === void 0 ? void 0 : _a.name) !== null && _b !== void 0 ? _b : ''));
    }
    appendWhere(filter, parts, isTopLevelExpression, topLevelExpressionsCount) {
        if (!filter) {
            return;
        }
        const hasChildExpressions = 'expressions' in filter && filter.expressions.length > 0;
        if (isTopLevelExpression && hasChildExpressions) {
            parts.push('WHERE');
        }
        if (filter.type === QueryEditorExpressionType.And) {
            const andParts = [];
            filter.expressions.map((exp) => this.appendWhere(exp, andParts, false, topLevelExpressionsCount));
            if (andParts.length === 0) {
                return;
            }
            const andCombined = andParts.join(' AND ');
            const wrapInParentheses = !isTopLevelExpression && topLevelExpressionsCount > 1 && andParts.length > 1;
            return parts.push(wrapInParentheses ? `(${andCombined})` : andCombined);
        }
        if (filter.type === QueryEditorExpressionType.Or) {
            const orParts = [];
            filter.expressions.map((exp) => this.appendWhere(exp, orParts, false, topLevelExpressionsCount));
            if (orParts.length === 0) {
                return;
            }
            const orCombined = orParts.join(' OR ');
            const wrapInParentheses = !isTopLevelExpression && topLevelExpressionsCount > 1 && orParts.length > 1;
            parts.push(wrapInParentheses ? `(${orCombined})` : orCombined);
            return;
        }
        if (filter.type === QueryEditorExpressionType.Operator) {
            return this.appendOperator(filter, parts);
        }
    }
    appendGroupBy(groupBy, parts) {
        var _a;
        const groupByParts = [];
        for (const expression of (_a = groupBy === null || groupBy === void 0 ? void 0 : groupBy.expressions) !== null && _a !== void 0 ? _a : []) {
            if ((expression === null || expression === void 0 ? void 0 : expression.type) !== QueryEditorExpressionType.GroupBy || !expression.property.name) {
                continue;
            }
            groupByParts.push(this.formatValue(expression.property.name));
        }
        if (groupByParts.length > 0) {
            parts.push(`GROUP BY ${groupByParts.join(', ')}`);
        }
    }
    appendOrderBy(orderBy, orderByDirection, parts) {
        if (orderBy) {
            parts.push('ORDER BY');
            this.appendFunction(orderBy, parts);
            parts.push(orderByDirection !== null && orderByDirection !== void 0 ? orderByDirection : 'ASC');
        }
    }
    appendLimit(limit, parts) {
        limit && parts.push(`LIMIT ${limit}`);
    }
    appendOperator(expression, parts, prefix) {
        const { property, operator } = expression;
        if (!property.name || !operator.name || !operator.value) {
            return;
        }
        parts.push(`${this.formatValue(property.name)} ${operator.name} '${operator.value}'`);
    }
    appendFunction(select, parts) {
        var _a;
        if (!(select === null || select === void 0 ? void 0 : select.name)) {
            return;
        }
        const params = ((_a = select.parameters) !== null && _a !== void 0 ? _a : [])
            .map((p) => p.name && this.formatValue(p.name))
            .filter(Boolean)
            .join(', ');
        parts.push(`${select.name}(${params})`);
    }
    formatValue(label) {
        const specialCharacters = /[/\s\.-]/; // slash, space, dot or dash
        const interpolated = this.templateSrv.replace(label, {}, 'raw');
        if (specialCharacters.test(interpolated)) {
            return `"${label}"`;
        }
        return label;
    }
}
//# sourceMappingURL=SQLGenerator.js.map