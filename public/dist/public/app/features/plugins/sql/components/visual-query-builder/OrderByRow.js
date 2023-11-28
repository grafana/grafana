import { uniqueId } from 'lodash';
import React, { useCallback } from 'react';
import { toOption } from '@grafana/data';
import { EditorField, InputGroup, Space } from '@grafana/experimental';
import { Input, RadioButtonGroup, Select } from '@grafana/ui';
import { setPropertyField } from '../../utils/sql.utils';
const sortOrderOptions = [
    { description: 'Sort by ascending', value: 'ASC', icon: 'sort-amount-up' },
    { description: 'Sort by descending', value: 'DESC', icon: 'sort-amount-down' },
];
export function OrderByRow({ sql, onSqlChange, columns, showOffset }) {
    var _a, _b;
    const onSortOrderChange = useCallback((item) => {
        const newSql = Object.assign(Object.assign({}, sql), { orderByDirection: item });
        onSqlChange(newSql);
    }, [onSqlChange, sql]);
    const onLimitChange = useCallback((event) => {
        const newSql = Object.assign(Object.assign({}, sql), { limit: Number.parseInt(event.currentTarget.value, 10) });
        onSqlChange(newSql);
    }, [onSqlChange, sql]);
    const onOffsetChange = useCallback((event) => {
        const newSql = Object.assign(Object.assign({}, sql), { offset: Number.parseInt(event.currentTarget.value, 10) });
        onSqlChange(newSql);
    }, [onSqlChange, sql]);
    const onOrderByChange = useCallback((item) => {
        const newSql = Object.assign(Object.assign({}, sql), { orderBy: setPropertyField(item === null || item === void 0 ? void 0 : item.value) });
        if (item === null) {
            newSql.orderByDirection = undefined;
        }
        onSqlChange(newSql);
    }, [onSqlChange, sql]);
    return (React.createElement(React.Fragment, null,
        React.createElement(EditorField, { label: "Order by", width: 25 },
            React.createElement(InputGroup, null,
                React.createElement(Select, { "aria-label": "Order by", options: columns, value: ((_a = sql.orderBy) === null || _a === void 0 ? void 0 : _a.property.name) ? toOption(sql.orderBy.property.name) : null, isClearable: true, menuShouldPortal: true, onChange: onOrderByChange }),
                React.createElement(Space, { h: 1.5 }),
                React.createElement(RadioButtonGroup, { options: sortOrderOptions, disabled: !((_b = sql === null || sql === void 0 ? void 0 : sql.orderBy) === null || _b === void 0 ? void 0 : _b.property.name), value: sql.orderByDirection, onChange: onSortOrderChange }))),
        React.createElement(EditorField, { label: "Limit", optional: true, width: 25 },
            React.createElement(Input, { type: "number", min: 0, id: uniqueId('limit-'), value: sql.limit || '', onChange: onLimitChange })),
        showOffset && (React.createElement(EditorField, { label: "Offset", optional: true, width: 25 },
            React.createElement(Input, { type: "number", id: uniqueId('offset-'), value: sql.offset || '', onChange: onOffsetChange })))));
}
//# sourceMappingURL=OrderByRow.js.map