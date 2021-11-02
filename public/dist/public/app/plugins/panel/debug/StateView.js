import React from 'react';
import { Field, Input, usePanelContext } from '@grafana/ui';
export function StateView(props) {
    var _a, _b;
    var context = usePanelContext();
    var onChangeName = function (e) {
        context.onInstanceStateChange({
            name: e.currentTarget.value,
        });
    };
    return (React.createElement(React.Fragment, null,
        React.createElement(Field, { label: "State name" },
            React.createElement(Input, { value: (_b = (_a = context.instanceState) === null || _a === void 0 ? void 0 : _a.name) !== null && _b !== void 0 ? _b : '', onChange: onChangeName }))));
}
export function StateViewEditor(_a) {
    var _b;
    var value = _a.value, context = _a.context, onChange = _a.onChange, item = _a.item;
    return React.createElement("div", null,
        "Current value: ", (_b = context.instanceState) === null || _b === void 0 ? void 0 :
        _b.name,
        " ");
}
//# sourceMappingURL=StateView.js.map