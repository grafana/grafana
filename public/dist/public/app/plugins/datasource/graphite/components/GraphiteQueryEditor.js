import { __makeTemplateObject } from "tslib";
import React from 'react';
import { actions } from '../state/actions';
import { Button, useStyles2 } from '@grafana/ui';
import { GraphiteQueryEditorContext, useDispatch, useGraphiteState } from '../state/context';
import { GraphiteTextEditor } from './GraphiteTextEditor';
import { SeriesSection } from './SeriesSection';
import { FunctionsSection } from './FunctionsSection';
import { css } from '@emotion/css';
export function GraphiteQueryEditor(_a) {
    var datasource = _a.datasource, onRunQuery = _a.onRunQuery, onChange = _a.onChange, query = _a.query, range = _a.range, queries = _a.queries;
    return (React.createElement(GraphiteQueryEditorContext, { datasource: datasource, onRunQuery: onRunQuery, onChange: onChange, query: query, queries: queries, range: range },
        React.createElement(GraphiteQueryEditorContent, null)));
}
function GraphiteQueryEditorContent() {
    var _a, _b, _c;
    var dispatch = useDispatch();
    var state = useGraphiteState();
    var styles = useStyles2(getStyles);
    return (React.createElement("div", { className: styles.container },
        React.createElement("div", { className: styles.visualEditor },
            ((_a = state.target) === null || _a === void 0 ? void 0 : _a.textEditor) && React.createElement(GraphiteTextEditor, { rawQuery: state.target.target }),
            !((_b = state.target) === null || _b === void 0 ? void 0 : _b.textEditor) && (React.createElement(React.Fragment, null,
                React.createElement(SeriesSection, { state: state }),
                React.createElement(FunctionsSection, { functions: (_c = state.queryModel) === null || _c === void 0 ? void 0 : _c.functions, funcDefs: state.funcDefs })))),
        React.createElement(Button, { className: styles.toggleButton, icon: "pen", variant: "secondary", onClick: function () {
                dispatch(actions.toggleEditorMode());
            } })));
}
function getStyles(theme) {
    return {
        container: css(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n      display: flex;\n    "], ["\n      display: flex;\n    "]))),
        visualEditor: css(templateObject_2 || (templateObject_2 = __makeTemplateObject(["\n      flex-grow: 1;\n    "], ["\n      flex-grow: 1;\n    "]))),
        toggleButton: css(templateObject_3 || (templateObject_3 = __makeTemplateObject(["\n      margin-left: ", ";\n    "], ["\n      margin-left: ", ";\n    "])), theme.spacing(0.5)),
    };
}
var templateObject_1, templateObject_2, templateObject_3;
//# sourceMappingURL=GraphiteQueryEditor.js.map