import { isEqual, map } from 'lodash';
import React, { useCallback, useEffect, useState } from 'react';
import { CoreApp, LoadingState } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { EditorHeader, EditorRows, FlexItem, Space } from '@grafana/experimental';
import { reportInteraction } from '@grafana/runtime';
import { Button, ConfirmModal } from '@grafana/ui';
import { QueryPatternsModal } from '../QueryPatternsModal';
import { buildVisualQueryFromString } from '../parsing';
import { QueryEditorModeToggle } from '../shared/QueryEditorModeToggle';
import { QueryHeaderSwitch } from '../shared/QueryHeaderSwitch';
import { promQueryEditorExplainKey, useFlag } from '../shared/hooks/useFlag';
import { QueryEditorMode } from '../shared/types';
import { changeEditorMode, getQueryWithDefaults } from '../state';
import { PromQueryBuilderContainer } from './PromQueryBuilderContainer';
import { PromQueryBuilderOptions } from './PromQueryBuilderOptions';
import { PromQueryCodeEditor } from './PromQueryCodeEditor';
export const FORMAT_OPTIONS = [
    { label: 'Time series', value: 'time_series' },
    { label: 'Table', value: 'table' },
    { label: 'Heatmap', value: 'heatmap' },
];
export const INTERVAL_FACTOR_OPTIONS = map([1, 2, 3, 4, 5, 10], (value) => ({
    value,
    label: '1/' + value,
}));
export const PromQueryEditorSelector = React.memo((props) => {
    const { onChange, onRunQuery, data, app, onAddQuery, datasource: { defaultEditor }, queries, } = props;
    const [parseModalOpen, setParseModalOpen] = useState(false);
    const [queryPatternsModalOpen, setQueryPatternsModalOpen] = useState(false);
    const [dataIsStale, setDataIsStale] = useState(false);
    const { flag: explain, setFlag: setExplain } = useFlag(promQueryEditorExplainKey);
    const query = getQueryWithDefaults(props.query, app, defaultEditor);
    // This should be filled in from the defaults by now.
    const editorMode = query.editorMode;
    const onEditorModeChange = useCallback((newMetricEditorMode) => {
        var _a;
        reportInteraction('user_grafana_prometheus_editor_mode_clicked', {
            newEditor: newMetricEditorMode,
            previousEditor: (_a = query.editorMode) !== null && _a !== void 0 ? _a : '',
            newQuery: !query.expr,
            app: app !== null && app !== void 0 ? app : '',
        });
        if (newMetricEditorMode === QueryEditorMode.Builder) {
            const result = buildVisualQueryFromString(query.expr || '');
            // If there are errors, give user a chance to decide if they want to go to builder as that can lose some data.
            if (result.errors.length) {
                setParseModalOpen(true);
                return;
            }
        }
        changeEditorMode(query, newMetricEditorMode, onChange);
    }, [onChange, query, app]);
    useEffect(() => {
        setDataIsStale(false);
    }, [data]);
    const onChangeInternal = (query) => {
        if (!isEqual(query, props.query)) {
            setDataIsStale(true);
        }
        onChange(query);
    };
    const onShowExplainChange = (e) => {
        setExplain(e.currentTarget.checked);
    };
    return (React.createElement(React.Fragment, null,
        React.createElement(ConfirmModal, { isOpen: parseModalOpen, title: "Parsing error: Switch to the builder mode?", body: "There is a syntax error, or the query structure cannot be visualized when switching to the builder mode. Parts of the query may be lost. ", confirmText: "Continue", onConfirm: () => {
                changeEditorMode(query, QueryEditorMode.Builder, onChange);
                setParseModalOpen(false);
            }, onDismiss: () => setParseModalOpen(false) }),
        React.createElement(QueryPatternsModal, { isOpen: queryPatternsModalOpen, onClose: () => setQueryPatternsModalOpen(false), query: query, queries: queries, app: app, onChange: onChange, onAddQuery: onAddQuery }),
        React.createElement(EditorHeader, null,
            React.createElement(Button, { "aria-label": selectors.components.QueryBuilder.queryPatterns, variant: "secondary", size: "sm", onClick: () => setQueryPatternsModalOpen((prevValue) => !prevValue) }, "Kick start your query"),
            React.createElement(QueryHeaderSwitch, { label: "Explain", value: explain, onChange: onShowExplainChange }),
            React.createElement(FlexItem, { grow: 1 }),
            app !== CoreApp.Explore && app !== CoreApp.Correlations && (React.createElement(Button, { variant: dataIsStale ? 'primary' : 'secondary', size: "sm", onClick: onRunQuery, icon: (data === null || data === void 0 ? void 0 : data.state) === LoadingState.Loading ? 'fa fa-spinner' : undefined, disabled: (data === null || data === void 0 ? void 0 : data.state) === LoadingState.Loading }, "Run queries")),
            React.createElement(QueryEditorModeToggle, { mode: editorMode, onChange: onEditorModeChange })),
        React.createElement(Space, { v: 0.5 }),
        React.createElement(EditorRows, null,
            editorMode === QueryEditorMode.Code && (React.createElement(PromQueryCodeEditor, Object.assign({}, props, { query: query, showExplain: explain, onChange: onChangeInternal }))),
            editorMode === QueryEditorMode.Builder && (React.createElement(PromQueryBuilderContainer, { query: query, datasource: props.datasource, onChange: onChangeInternal, onRunQuery: props.onRunQuery, data: data, showExplain: explain })),
            React.createElement(PromQueryBuilderOptions, { query: query, app: props.app, onChange: onChange, onRunQuery: onRunQuery }))));
});
PromQueryEditorSelector.displayName = 'PromQueryEditorSelector';
//# sourceMappingURL=PromQueryEditorSelector.js.map