import React, { useState } from 'react';
import { InlineFormLabel, Input, InlineSwitch } from '@grafana/ui';
export const AnnotationEditor = (props) => {
    var _a, _b;
    const { query, onChange } = props;
    const [target, setTarget] = useState((_a = query.target) !== null && _a !== void 0 ? _a : '');
    const [isGlobal, setIsGlobal] = useState((_b = query.isGlobal) !== null && _b !== void 0 ? _b : false);
    const updateValue = (key, val) => {
        onChange(Object.assign(Object.assign({}, query), { [key]: val, fromAnnotations: true }));
    };
    const updateIsGlobal = (isGlobal) => {
        isGlobal = !isGlobal;
        setIsGlobal(isGlobal);
        updateValue('isGlobal', isGlobal);
    };
    return (React.createElement("div", { className: "gf-form-group" },
        React.createElement("div", { className: "gf-form" },
            React.createElement(InlineFormLabel, { width: 12 }, "OpenTSDB metrics query"),
            React.createElement(Input, { value: target, onChange: (e) => { var _a; return setTarget((_a = e.currentTarget.value) !== null && _a !== void 0 ? _a : ''); }, onBlur: () => updateValue('target', target), placeholder: "events.eventname" })),
        React.createElement("div", { className: "gf-form" },
            React.createElement(InlineFormLabel, { width: 12 }, "Show Global Annotations?"),
            React.createElement(InlineSwitch, { value: isGlobal, onChange: (e) => updateIsGlobal(isGlobal) }))));
};
//# sourceMappingURL=AnnotationEditor.js.map