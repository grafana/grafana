import React from 'react';
import { GraphiteFunctionEditor } from './GraphiteFunctionEditor';
import { AddGraphiteFunction } from './AddGraphiteFunction';
import { SegmentSection } from '@grafana/ui';
export function FunctionsSection(_a) {
    var _b = _a.functions, functions = _b === void 0 ? [] : _b, funcDefs = _a.funcDefs;
    return (React.createElement(SegmentSection, { label: "Functions", fill: true },
        functions.map(function (func, index) {
            return !func.hidden && React.createElement(GraphiteFunctionEditor, { key: index, func: func });
        }),
        React.createElement(AddGraphiteFunction, { funcDefs: funcDefs })));
}
//# sourceMappingURL=FunctionsSection.js.map