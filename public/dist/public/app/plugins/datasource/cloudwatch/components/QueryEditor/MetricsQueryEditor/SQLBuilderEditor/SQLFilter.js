import { __awaiter } from "tslib";
import React, { useMemo, useState } from 'react';
import { useAsyncFn } from 'react-use';
import { toOption } from '@grafana/data';
import { AccessoryButton, EditorList, InputGroup } from '@grafana/experimental';
import { Select } from '@grafana/ui';
import { QueryEditorExpressionType, QueryEditorPropertyType, } from '../../../../expressions';
import { useDimensionKeys } from '../../../../hooks';
import { COMPARISON_OPERATORS, EQUALS } from '../../../../language/cloudwatch-sql/language';
import { appendTemplateVariables } from '../../../../utils/utils';
import { getFlattenedFilters, getMetricNameFromExpression, getNamespaceFromExpression, sanitizeOperator, setOperatorExpressionName, setOperatorExpressionProperty, setOperatorExpressionValue, setSql, } from './utils';
const OPERATORS = COMPARISON_OPERATORS.map(toOption);
const SQLFilter = ({ query, onQueryChange, datasource }) => {
    const filtersFromQuery = useMemo(() => { var _a; return getFlattenedFilters((_a = query.sql) !== null && _a !== void 0 ? _a : {}); }, [query.sql]);
    const [filters, setFilters] = useState(filtersFromQuery);
    const onChange = (newItems) => {
        // As new (empty object) items come in, with need to make sure they have the correct type
        const cleaned = newItems.map((v) => {
            var _a, _b;
            return ({
                type: QueryEditorExpressionType.Operator,
                property: (_a = v.property) !== null && _a !== void 0 ? _a : { type: QueryEditorPropertyType.String },
                operator: (_b = v.operator) !== null && _b !== void 0 ? _b : {
                    name: EQUALS,
                },
            });
        });
        setFilters(cleaned);
        // Only save valid and complete filters into the query state
        const validExpressions = [];
        for (const operatorExpression of cleaned) {
            const validated = sanitizeOperator(operatorExpression);
            if (validated) {
                validExpressions.push(validated);
            }
        }
        const where = validExpressions.length
            ? {
                type: QueryEditorExpressionType.And,
                expressions: validExpressions,
            }
            : undefined;
        onQueryChange(setSql(query, { where }));
    };
    return React.createElement(EditorList, { items: filters, onChange: onChange, renderItem: makeRenderFilter(datasource, query) });
};
// Making component functions in the render body is not recommended, but it works for now.
// If some problems arise (perhaps with state going missing), consider this to be a potential cause
function makeRenderFilter(datasource, query) {
    function renderFilter(item, onChange, onDelete) {
        return React.createElement(FilterItem, { datasource: datasource, query: query, filter: item, onChange: onChange, onDelete: onDelete });
    }
    return renderFilter;
}
export default SQLFilter;
const FilterItem = (props) => {
    var _a, _b, _c, _d, _e, _f, _g, _h;
    const { datasource, query, filter, onChange, onDelete } = props;
    const sql = (_a = query.sql) !== null && _a !== void 0 ? _a : {};
    const namespace = getNamespaceFromExpression(sql.from);
    const metricName = getMetricNameFromExpression(sql.select);
    const dimensionKeys = useDimensionKeys(datasource, { region: query.region, namespace, metricName });
    const loadDimensionValues = () => __awaiter(void 0, void 0, void 0, function* () {
        var _j;
        if (!((_j = filter.property) === null || _j === void 0 ? void 0 : _j.name) || !namespace) {
            return [];
        }
        return datasource.resources
            .getDimensionValues({ region: query.region, namespace, metricName, dimensionKey: filter.property.name })
            .then((result) => {
            return appendTemplateVariables(datasource, result);
        });
    });
    const [state, loadOptions] = useAsyncFn(loadDimensionValues, [
        query.region,
        namespace,
        metricName,
        (_b = filter.property) === null || _b === void 0 ? void 0 : _b.name,
    ]);
    return (React.createElement(InputGroup, null,
        React.createElement(Select, { width: "auto", value: ((_c = filter.property) === null || _c === void 0 ? void 0 : _c.name) ? toOption((_d = filter.property) === null || _d === void 0 ? void 0 : _d.name) : null, options: dimensionKeys, allowCustomValue: true, onChange: ({ value }) => value && onChange(setOperatorExpressionProperty(filter, value)) }),
        React.createElement(Select, { width: "auto", value: ((_e = filter.operator) === null || _e === void 0 ? void 0 : _e.name) && toOption(filter.operator.name), options: OPERATORS, onChange: ({ value }) => value && onChange(setOperatorExpressionName(filter, value)) }),
        React.createElement(Select, { width: "auto", isLoading: state.loading, value: ((_f = filter.operator) === null || _f === void 0 ? void 0 : _f.value) && typeof ((_g = filter.operator) === null || _g === void 0 ? void 0 : _g.value) === 'string' ? toOption((_h = filter.operator) === null || _h === void 0 ? void 0 : _h.value) : null, options: state.value, allowCustomValue: true, onOpenMenu: loadOptions, onChange: ({ value }) => value && onChange(setOperatorExpressionValue(filter, value)) }),
        React.createElement(AccessoryButton, { "aria-label": "remove", icon: "times", variant: "secondary", onClick: onDelete })));
};
//# sourceMappingURL=SQLFilter.js.map