import React from 'react';
import { Field, Input, usePanelContext } from '@grafana/ui';
export function StateView(props) {
    var _a, _b;
    const context = usePanelContext();
    const onChangeName = (e) => {
        context.onInstanceStateChange({
            name: e.currentTarget.value,
        });
    };
    return (React.createElement(React.Fragment, null,
        React.createElement(Field, { label: "State name" },
            React.createElement(Input, { value: (_b = (_a = context.instanceState) === null || _a === void 0 ? void 0 : _a.name) !== null && _b !== void 0 ? _b : '', onChange: onChangeName }))));
}
export function StateViewEditor({ value, context, onChange, item }) {
    var _a;
    return React.createElement("div", null,
        "Current value: ", (_a = context.instanceState) === null || _a === void 0 ? void 0 :
        _a.name,
        " ");
}
//# sourceMappingURL=StateView.js.map