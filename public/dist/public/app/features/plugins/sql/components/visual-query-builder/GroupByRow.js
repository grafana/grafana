import React, { useCallback } from 'react';
import { toOption } from '@grafana/data';
import { AccessoryButton, EditorList, InputGroup } from '@grafana/experimental';
import { Select } from '@grafana/ui';
import { setGroupByField } from '../../utils/sql.utils';
export function GroupByRow({ sql, columns, onSqlChange }) {
    const onGroupByChange = useCallback((item) => {
        // As new (empty object) items come in, we need to make sure they have the correct type
        const cleaned = item.map((v) => { var _a; return setGroupByField((_a = v.property) === null || _a === void 0 ? void 0 : _a.name); });
        const newSql = Object.assign(Object.assign({}, sql), { groupBy: cleaned });
        onSqlChange(newSql);
    }, [onSqlChange, sql]);
    return (React.createElement(EditorList, { items: sql.groupBy, onChange: onGroupByChange, renderItem: makeRenderColumn({
            options: columns,
        }) }));
}
function makeRenderColumn({ options }) {
    const renderColumn = function (item, onChangeItem, onDeleteItem) {
        var _a;
        return (React.createElement(InputGroup, null,
            React.createElement(Select, { value: ((_a = item.property) === null || _a === void 0 ? void 0 : _a.name) ? toOption(item.property.name) : null, "aria-label": "Group by", options: options, menuShouldPortal: true, onChange: ({ value }) => value && onChangeItem(setGroupByField(value)) }),
            React.createElement(AccessoryButton, { "aria-label": "Remove group by column", icon: "times", variant: "secondary", onClick: onDeleteItem })));
    };
    return renderColumn;
}
//# sourceMappingURL=GroupByRow.js.map