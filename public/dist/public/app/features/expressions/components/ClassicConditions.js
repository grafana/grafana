import React from 'react';
import { Button, Icon, InlineField, InlineFieldRow } from '@grafana/ui';
import { defaultCondition } from '../utils/expressionTypes';
import { Condition } from './Condition';
export const ClassicConditions = ({ onChange, query, refIds }) => {
    var _a;
    const onConditionChange = (condition, index) => {
        if (query.conditions) {
            onChange(Object.assign(Object.assign({}, query), { conditions: [...query.conditions.slice(0, index), condition, ...query.conditions.slice(index + 1)] }));
        }
    };
    const onAddCondition = () => {
        var _a, _b, _c;
        if (query.conditions) {
            const lastParams = (_c = (_b = (_a = query.conditions.at(-1)) === null || _a === void 0 ? void 0 : _a.query) === null || _b === void 0 ? void 0 : _b.params) !== null && _c !== void 0 ? _c : [];
            const newCondition = Object.assign(Object.assign({}, defaultCondition), { query: { params: lastParams } });
            onChange(Object.assign(Object.assign({}, query), { conditions: query.conditions.length > 0 ? [...query.conditions, newCondition] : [newCondition] }));
        }
    };
    const onRemoveCondition = (index) => {
        if (query.conditions) {
            const condition = query.conditions[index];
            const conditions = query.conditions
                .filter((c) => c !== condition)
                .map((c, index) => {
                if (index === 0) {
                    return Object.assign(Object.assign({}, c), { operator: {
                            type: 'when',
                        } });
                }
                return c;
            });
            onChange(Object.assign(Object.assign({}, query), { conditions }));
        }
    };
    return (React.createElement("div", null,
        React.createElement(InlineFieldRow, null,
            React.createElement(InlineField, { label: "Conditions", labelWidth: 14 },
                React.createElement("div", null, (_a = query.conditions) === null || _a === void 0 ? void 0 : _a.map((condition, index) => {
                    if (!condition) {
                        return;
                    }
                    return (React.createElement(Condition, { key: index, index: index, condition: condition, onChange: (condition) => onConditionChange(condition, index), onRemoveCondition: onRemoveCondition, refIds: refIds }));
                })))),
        React.createElement(Button, { variant: "secondary", type: "button", onClick: onAddCondition },
            React.createElement(Icon, { name: "plus-circle" }))));
};
//# sourceMappingURL=ClassicConditions.js.map