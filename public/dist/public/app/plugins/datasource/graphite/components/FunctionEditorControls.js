import { __awaiter } from "tslib";
import React, { Suspense } from 'react';
import { Icon, Tooltip } from '@grafana/ui';
const FunctionDescription = React.lazy(() => __awaiter(void 0, void 0, void 0, function* () {
    return {
        default(props) {
            return React.createElement("div", null, props.description);
        },
    };
}));
const FunctionHelpButton = (props) => {
    if (props.description) {
        let tooltip = (React.createElement(Suspense, { fallback: React.createElement("span", null, "Loading description...") },
            React.createElement(FunctionDescription, { description: props.description })));
        return (React.createElement(Tooltip, { content: tooltip, placement: 'bottom-end' },
            React.createElement(Icon, { className: props.description ? undefined : 'pointer', name: "question-circle" })));
    }
    return (React.createElement(Icon, { className: "pointer", name: "question-circle", onClick: () => {
            window.open('http://graphite.readthedocs.org/en/latest/functions.html#graphite.render.functions.' + props.name, '_blank');
        } }));
};
export const FunctionEditorControls = (props) => {
    const { func, onMoveLeft, onMoveRight, onRemove } = props;
    return (React.createElement("div", { style: {
            display: 'flex',
            width: '60px',
            justifyContent: 'space-between',
        } },
        React.createElement(Icon, { name: "arrow-left", onClick: () => onMoveLeft(func) }),
        React.createElement(FunctionHelpButton, { name: func.def.name, description: func.def.description }),
        React.createElement(Icon, { name: "times", onClick: () => onRemove(func) }),
        React.createElement(Icon, { name: "arrow-right", onClick: () => onMoveRight(func) })));
};
//# sourceMappingURL=FunctionEditorControls.js.map