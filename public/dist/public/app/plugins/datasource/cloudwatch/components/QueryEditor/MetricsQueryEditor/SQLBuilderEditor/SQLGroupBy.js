import React, { useMemo, useState } from 'react';
import { toOption } from '@grafana/data';
import { AccessoryButton, EditorList, InputGroup } from '@grafana/experimental';
import { Select } from '@grafana/ui';
import { QueryEditorExpressionType, QueryEditorPropertyType, } from '../../../../expressions';
import { useDimensionKeys } from '../../../../hooks';
import { getFlattenedGroupBys, getMetricNameFromExpression, getNamespaceFromExpression, setGroupByField, setSql, } from './utils';
const SQLGroupBy = ({ query, datasource, onQueryChange }) => {
    var _a;
    const sql = (_a = query.sql) !== null && _a !== void 0 ? _a : {};
    const groupBysFromQuery = useMemo(() => { var _a; return getFlattenedGroupBys((_a = query.sql) !== null && _a !== void 0 ? _a : {}); }, [query.sql]);
    const [items, setItems] = useState(groupBysFromQuery);
    const namespace = getNamespaceFromExpression(sql.from);
    const metricName = getMetricNameFromExpression(sql.select);
    const baseOptions = useDimensionKeys(datasource, { region: query.region, namespace, metricName });
    const options = useMemo(
    // Exclude options we've already selected
    () => baseOptions.filter((option) => !groupBysFromQuery.some((v) => v.property.name === option.value)), [baseOptions, groupBysFromQuery]);
    const onChange = (newItems) => {
        // As new (empty object) items come in, with need to make sure they have the correct type
        const cleaned = newItems.map((v) => {
            var _a;
            return ({
                type: QueryEditorExpressionType.GroupBy,
                property: {
                    type: QueryEditorPropertyType.String,
                    name: (_a = v.property) === null || _a === void 0 ? void 0 : _a.name,
                },
            });
        });
        setItems(cleaned);
        // Only save complete expressions into the query state;
        const completeExpressions = cleaned.filter((v) => { var _a; return (_a = v.property) === null || _a === void 0 ? void 0 : _a.name; });
        const groupBy = completeExpressions.length
            ? {
                type: QueryEditorExpressionType.And,
                expressions: completeExpressions,
            }
            : undefined;
        onQueryChange(setSql(query, { groupBy }));
    };
    return React.createElement(EditorList, { items: items, onChange: onChange, renderItem: makeRenderItem(options) });
};
function makeRenderItem(options) {
    function renderItem(item, onChange, onDelete) {
        return React.createElement(GroupByItem, { options: options, item: item, onChange: onChange, onDelete: onDelete });
    }
    return renderItem;
}
const GroupByItem = (props) => {
    var _a;
    const { options, item, onChange, onDelete } = props;
    const fieldName = (_a = item.property) === null || _a === void 0 ? void 0 : _a.name;
    return (React.createElement(InputGroup, null,
        React.createElement(Select, { "aria-label": `Group by ${fieldName !== null && fieldName !== void 0 ? fieldName : 'filter key'}`, width: "auto", value: fieldName ? toOption(fieldName) : null, options: options, allowCustomValue: true, onChange: ({ value }) => value && onChange(setGroupByField(value)) }),
        React.createElement(AccessoryButton, { "aria-label": "remove", icon: "times", variant: "secondary", onClick: onDelete })));
};
export default SQLGroupBy;
//# sourceMappingURL=SQLGroupBy.js.map