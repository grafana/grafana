import React from 'react';
import { toOption } from '@grafana/data';
import { AccessoryButton, EditorField, EditorFieldGroup, InputGroup } from '@grafana/experimental';
import { Select } from '@grafana/ui';
import { ASC, DESC, STATISTICS } from '../../../../language/cloudwatch-sql/language';
import { appendTemplateVariables } from '../../../../utils/utils';
import { setOrderBy, setSql } from './utils';
const orderByDirections = [
    { label: ASC, value: ASC },
    { label: DESC, value: DESC },
];
const SQLOrderByGroup = ({ query, onQueryChange, datasource }) => {
    var _a, _b;
    const sql = (_a = query.sql) !== null && _a !== void 0 ? _a : {};
    const orderBy = (_b = sql.orderBy) === null || _b === void 0 ? void 0 : _b.name;
    const orderByDirection = sql.orderByDirection;
    return (React.createElement(EditorFieldGroup, null,
        React.createElement(EditorField, { label: "Order by", optional: true, width: 16 },
            React.createElement(InputGroup, null,
                React.createElement(Select, { "aria-label": "Order by", onChange: ({ value }) => value && onQueryChange(setOrderBy(query, value)), options: appendTemplateVariables(datasource, STATISTICS.map(toOption)), value: orderBy ? toOption(orderBy) : null }),
                orderBy && (React.createElement(AccessoryButton, { "aria-label": "remove", icon: "times", variant: "secondary", onClick: () => onQueryChange(setSql(query, { orderBy: undefined })) })))),
        React.createElement(EditorField, { label: "Direction", disabled: !orderBy, width: 16 },
            React.createElement(Select, { "aria-label": "Direction", inputId: "cloudwatch-sql-order-by-direction", value: orderByDirection ? toOption(orderByDirection) : orderByDirections[0], options: appendTemplateVariables(datasource, orderByDirections), onChange: (item) => item && onQueryChange(setSql(query, { orderByDirection: item.value })) }))));
};
export default SQLOrderByGroup;
//# sourceMappingURL=SQLOrderByGroup.js.map