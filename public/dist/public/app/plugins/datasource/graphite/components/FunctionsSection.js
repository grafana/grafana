import React from 'react';
import { SegmentSection } from '@grafana/ui';
import { AddGraphiteFunction } from './AddGraphiteFunction';
import { GraphiteFunctionEditor } from './GraphiteFunctionEditor';
export function FunctionsSection({ functions = [], funcDefs }) {
    return (React.createElement(SegmentSection, { label: "Functions", fill: true },
        functions.map((func, index) => {
            return !func.hidden && React.createElement(GraphiteFunctionEditor, { key: index, func: func });
        }),
        React.createElement(AddGraphiteFunction, { funcDefs: funcDefs })));
}
//# sourceMappingURL=FunctionsSection.js.map