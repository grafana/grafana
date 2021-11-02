import React from 'react';
import { CodeEditor, Select } from '@grafana/ui';
export var RuleSettingsEditor = function (_a) {
    var _b;
    var onChange = _a.onChange, value = _a.value, ruleType = _a.ruleType, entitiesInfo = _a.entitiesInfo;
    return (React.createElement(React.Fragment, null,
        React.createElement(Select, { menuShouldPortal: true, key: ruleType, options: entitiesInfo[ruleType], placeholder: "Select an option", value: (_b = value === null || value === void 0 ? void 0 : value.type) !== null && _b !== void 0 ? _b : '', onChange: function (value) {
                var _a;
                // set the body with example
                var type = value.value;
                onChange((_a = {
                        type: type
                    },
                    _a[type] = entitiesInfo.getExample(ruleType, type),
                    _a));
            } }),
        React.createElement(CodeEditor, { height: '50vh', value: value ? JSON.stringify(value[value.type], null, '\t') : '', showLineNumbers: true, readOnly: false, language: "json", showMiniMap: false, onBlur: function (text) {
                var _a;
                var body = JSON.parse(text);
                onChange((_a = {
                        type: value.type
                    },
                    _a[value.type] = body,
                    _a));
            } })));
};
//# sourceMappingURL=RuleSettingsEditor.js.map