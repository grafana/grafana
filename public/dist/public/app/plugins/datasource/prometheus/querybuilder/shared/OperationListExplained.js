import React from 'react';
import { OperationExplainedBox } from './OperationExplainedBox';
import { RawQuery } from './RawQuery';
export function OperationListExplained({ query, queryModeller, stepNumber, lang, onMouseEnter, onMouseLeave, }) {
    return (React.createElement(React.Fragment, null, query.operations.map((op, index) => {
        var _a;
        const def = queryModeller.getOperationDef(op.id);
        if (!def) {
            return `Operation ${op.id} not found`;
        }
        const title = def.renderer(op, def, '<expr>');
        const body = def.explainHandler ? def.explainHandler(op, def) : (_a = def.documentation) !== null && _a !== void 0 ? _a : 'no docs';
        return (React.createElement("div", { key: index, onMouseEnter: () => onMouseEnter === null || onMouseEnter === void 0 ? void 0 : onMouseEnter(op, index), onMouseLeave: () => onMouseLeave === null || onMouseLeave === void 0 ? void 0 : onMouseLeave(op, index) },
            React.createElement(OperationExplainedBox, { stepNumber: index + stepNumber, title: React.createElement(RawQuery, { query: title, lang: lang }), markdown: body })));
    })));
}
//# sourceMappingURL=OperationListExplained.js.map