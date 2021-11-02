import { __read, __spreadArray } from "tslib";
import React, { useState } from 'react';
import { RuleSettingsEditor } from './RuleSettingsEditor';
import { Select } from '@grafana/ui';
export var RuleSettingsArray = function (_a) {
    var onChange = _a.onChange, value = _a.value, ruleType = _a.ruleType, entitiesInfo = _a.entitiesInfo;
    var _b = __read(useState(0), 2), index = _b[0], setIndex = _b[1];
    var arr = value !== null && value !== void 0 ? value : [];
    var onRuleChange = function (v) {
        if (!value) {
            onChange([v]);
        }
        else {
            var copy = __spreadArray([], __read(value), false);
            copy[index] = v;
            onChange(copy);
        }
    };
    // create array of value.length + 1
    var indexArr = [];
    for (var i = 0; i <= arr.length; i++) {
        indexArr.push({
            label: ruleType + ": " + i,
            value: i,
        });
    }
    return (React.createElement(React.Fragment, null,
        React.createElement(Select, { placeholder: "Select an index", menuShouldPortal: true, options: indexArr, value: index, onChange: function (index) {
                // set index to find the correct setting
                setIndex(index.value);
            } }),
        React.createElement(RuleSettingsEditor, { onChange: onRuleChange, value: arr[index], ruleType: ruleType, entitiesInfo: entitiesInfo })));
};
//# sourceMappingURL=RuleSettingsArray.js.map