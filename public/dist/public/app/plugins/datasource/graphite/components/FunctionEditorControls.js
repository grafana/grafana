import { __awaiter, __generator } from "tslib";
import React, { Suspense } from 'react';
import { Icon, Tooltip } from '@grafana/ui';
var FunctionDescription = React.lazy(function () { return __awaiter(void 0, void 0, void 0, function () {
    var rst2html;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, import(/* webpackChunkName: "rst2html" */ 'rst2html')];
            case 1:
                rst2html = (_a.sent()).default;
                return [2 /*return*/, {
                        default: function (props) {
                            var _a;
                            return React.createElement("div", { dangerouslySetInnerHTML: { __html: rst2html((_a = props.description) !== null && _a !== void 0 ? _a : '') } });
                        },
                    }];
        }
    });
}); });
var FunctionHelpButton = function (props) {
    if (props.description) {
        var tooltip = (React.createElement(Suspense, { fallback: React.createElement("span", null, "Loading description...") },
            React.createElement(FunctionDescription, { description: props.description })));
        return (React.createElement(Tooltip, { content: tooltip, placement: 'bottom-end' },
            React.createElement(Icon, { className: props.description ? undefined : 'pointer', name: "question-circle" })));
    }
    return (React.createElement(Icon, { className: "pointer", name: "question-circle", onClick: function () {
            window.open('http://graphite.readthedocs.org/en/latest/functions.html#graphite.render.functions.' + props.name, '_blank');
        } }));
};
export var FunctionEditorControls = function (props) {
    var func = props.func, onMoveLeft = props.onMoveLeft, onMoveRight = props.onMoveRight, onRemove = props.onRemove;
    return (React.createElement("div", { style: {
            display: 'flex',
            width: '60px',
            justifyContent: 'space-between',
        } },
        React.createElement(Icon, { name: "arrow-left", onClick: function () { return onMoveLeft(func); } }),
        React.createElement(FunctionHelpButton, { name: func.def.name, description: func.def.description }),
        React.createElement(Icon, { name: "times", onClick: function () { return onRemove(func); } }),
        React.createElement(Icon, { name: "arrow-right", onClick: function () { return onMoveRight(func); } })));
};
//# sourceMappingURL=FunctionEditorControls.js.map