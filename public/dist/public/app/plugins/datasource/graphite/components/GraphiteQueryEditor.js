import { css } from '@emotion/css';
import React from 'react';
import { Button, useStyles2 } from '@grafana/ui';
import { actions } from '../state/actions';
import { GraphiteQueryEditorContext, useDispatch, useGraphiteState } from '../state/context';
import { FunctionsSection } from './FunctionsSection';
import { GraphiteTextEditor } from './GraphiteTextEditor';
import { SeriesSection } from './SeriesSection';
export function GraphiteQueryEditor({ datasource, onRunQuery, onChange, query, range, queries, }) {
    return (React.createElement(GraphiteQueryEditorContext, { datasource: datasource, onRunQuery: onRunQuery, onChange: onChange, query: query, queries: queries, range: range },
        React.createElement(GraphiteQueryEditorContent, null)));
}
function GraphiteQueryEditorContent() {
    var _a, _b, _c;
    const dispatch = useDispatch();
    const state = useGraphiteState();
    const styles = useStyles2(getStyles);
    return (React.createElement("div", { className: styles.container },
        React.createElement("div", { className: styles.visualEditor },
            ((_a = state.target) === null || _a === void 0 ? void 0 : _a.textEditor) && React.createElement(GraphiteTextEditor, { rawQuery: state.target.target }),
            !((_b = state.target) === null || _b === void 0 ? void 0 : _b.textEditor) && (React.createElement(React.Fragment, null,
                React.createElement(SeriesSection, { state: state }),
                React.createElement(FunctionsSection, { functions: (_c = state.queryModel) === null || _c === void 0 ? void 0 : _c.functions, funcDefs: state.funcDefs })))),
        React.createElement(Button, { className: styles.toggleButton, icon: "pen", variant: "secondary", "aria-label": "Toggle editor mode", onClick: () => {
                dispatch(actions.toggleEditorMode());
            } })));
}
function getStyles(theme) {
    return {
        container: css `
      display: flex;
    `,
        visualEditor: css `
      flex-grow: 1;
    `,
        toggleButton: css `
      margin-left: ${theme.spacing(0.5)};
    `,
    };
}
//# sourceMappingURL=GraphiteQueryEditor.js.map