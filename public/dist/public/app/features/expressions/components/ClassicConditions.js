import { __assign, __read, __spreadArray } from "tslib";
import React from 'react';
import { Button, Icon, InlineField, InlineFieldRow } from '@grafana/ui';
import { Condition } from './Condition';
import { defaultCondition } from '../utils/expressionTypes';
export var ClassicConditions = function (_a) {
    var _b;
    var onChange = _a.onChange, query = _a.query, refIds = _a.refIds;
    var onConditionChange = function (condition, index) {
        if (query.conditions) {
            onChange(__assign(__assign({}, query), { conditions: __spreadArray(__spreadArray(__spreadArray([], __read(query.conditions.slice(0, index)), false), [condition], false), __read(query.conditions.slice(index + 1)), false) }));
        }
    };
    var onAddCondition = function () {
        if (query.conditions) {
            onChange(__assign(__assign({}, query), { conditions: query.conditions.length > 0 ? __spreadArray(__spreadArray([], __read(query.conditions), false), [defaultCondition], false) : [defaultCondition] }));
        }
    };
    var onRemoveCondition = function (index) {
        if (query.conditions) {
            var condition_1 = query.conditions[index];
            var conditions = query.conditions
                .filter(function (c) { return c !== condition_1; })
                .map(function (c, index) {
                if (index === 0) {
                    return __assign(__assign({}, c), { operator: {
                            type: 'when',
                        } });
                }
                return c;
            });
            onChange(__assign(__assign({}, query), { conditions: conditions }));
        }
    };
    return (React.createElement("div", null,
        React.createElement(InlineFieldRow, null,
            React.createElement(InlineField, { label: "Conditions", labelWidth: 14 },
                React.createElement("div", null, (_b = query.conditions) === null || _b === void 0 ? void 0 : _b.map(function (condition, index) {
                    if (!condition) {
                        return;
                    }
                    return (React.createElement(Condition, { key: index, index: index, condition: condition, onChange: function (condition) { return onConditionChange(condition, index); }, onRemoveCondition: onRemoveCondition, refIds: refIds }));
                })))),
        React.createElement(Button, { variant: "secondary", type: "button", onClick: onAddCondition },
            React.createElement(Icon, { name: "plus-circle" }))));
};
//# sourceMappingURL=ClassicConditions.js.map