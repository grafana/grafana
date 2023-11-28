import { __awaiter } from "tslib";
import { isEqual } from 'lodash';
import React, { useCallback, useEffect, useState } from 'react';
import { usePrevious } from 'react-use';
import { CoreApp, LoadingState } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { EditorHeader, EditorRows, FlexItem, Space, Stack } from '@grafana/experimental';
import { config, reportInteraction } from '@grafana/runtime';
import { Button, ConfirmModal } from '@grafana/ui';
import { QueryEditorModeToggle } from 'app/plugins/datasource/prometheus/querybuilder/shared/QueryEditorModeToggle';
import { QueryHeaderSwitch } from 'app/plugins/datasource/prometheus/querybuilder/shared/QueryHeaderSwitch';
import { QueryEditorMode } from 'app/plugins/datasource/prometheus/querybuilder/shared/types';
import { lokiQueryEditorExplainKey, useFlag } from '../../prometheus/querybuilder/shared/hooks/useFlag';
import { LabelBrowserModal } from '../querybuilder/components/LabelBrowserModal';
import { LokiQueryBuilderContainer } from '../querybuilder/components/LokiQueryBuilderContainer';
import { LokiQueryBuilderOptions } from '../querybuilder/components/LokiQueryBuilderOptions';
import { LokiQueryCodeEditor } from '../querybuilder/components/LokiQueryCodeEditor';
import { QueryPatternsModal } from '../querybuilder/components/QueryPatternsModal';
import { buildVisualQueryFromString } from '../querybuilder/parsing';
import { changeEditorMode, getQueryWithDefaults } from '../querybuilder/state';
import { shouldUpdateStats } from './stats';
export const testIds = {
    editor: 'loki-editor',
};
export const LokiQueryEditor = React.memo((props) => {
    const { onChange, onRunQuery, onAddQuery, data, app, queries, datasource, range: timeRange } = props;
    const [parseModalOpen, setParseModalOpen] = useState(false);
    const [queryPatternsModalOpen, setQueryPatternsModalOpen] = useState(false);
    const [dataIsStale, setDataIsStale] = useState(false);
    const [labelBrowserVisible, setLabelBrowserVisible] = useState(false);
    const [queryStats, setQueryStats] = useState(null);
    const { flag: explain, setFlag: setExplain } = useFlag(lokiQueryEditorExplainKey);
    const predefinedOperations = datasource.predefinedOperations;
    const previousTimeRange = usePrevious(timeRange);
    const query = getQueryWithDefaults(props.query);
    if (config.featureToggles.lokiPredefinedOperations && !query.expr && predefinedOperations) {
        query.expr = `{} ${predefinedOperations}`;
    }
    const previousQueryExpr = usePrevious(query.expr);
    const previousQueryType = usePrevious(query.queryType);
    // This should be filled in from the defaults by now.
    const editorMode = query.editorMode;
    const onExplainChange = (event) => {
        setExplain(event.currentTarget.checked);
    };
    const onEditorModeChange = useCallback((newEditorMode) => {
        var _a;
        reportInteraction('grafana_loki_editor_mode_clicked', {
            newEditor: newEditorMode,
            previousEditor: (_a = query.editorMode) !== null && _a !== void 0 ? _a : '',
            newQuery: !query.expr,
            app: app !== null && app !== void 0 ? app : '',
        });
        if (newEditorMode === QueryEditorMode.Builder) {
            const result = buildVisualQueryFromString(query.expr || '');
            // If there are errors, give user a chance to decide if they want to go to builder as that can lose some data.
            if (result.errors.length) {
                setParseModalOpen(true);
                return;
            }
        }
        changeEditorMode(query, newEditorMode, onChange);
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
    const onClickLabelBrowserButton = () => {
        reportInteraction('grafana_loki_label_browser_opened', {
            app: app,
        });
        setLabelBrowserVisible((visible) => !visible);
    };
    useEffect(() => {
        const update = shouldUpdateStats(query.expr, previousQueryExpr, timeRange, previousTimeRange, query.queryType, previousQueryType);
        if (update) {
            const makeAsyncRequest = () => __awaiter(void 0, void 0, void 0, function* () {
                const stats = yield datasource.getStats(query);
                setQueryStats(stats);
            });
            makeAsyncRequest();
        }
    }, [datasource, timeRange, previousTimeRange, query, previousQueryExpr, previousQueryType, setQueryStats]);
    return (React.createElement(React.Fragment, null,
        React.createElement(ConfirmModal, { isOpen: parseModalOpen, title: "Query parsing", body: "There were errors while trying to parse the query. Continuing to visual builder may lose some parts of the query.", confirmText: "Continue", onConfirm: () => {
                onChange(Object.assign(Object.assign({}, query), { editorMode: QueryEditorMode.Builder }));
                setParseModalOpen(false);
            }, onDismiss: () => setParseModalOpen(false) }),
        React.createElement(QueryPatternsModal, { isOpen: queryPatternsModalOpen, onClose: () => setQueryPatternsModalOpen(false), query: query, queries: queries, app: app, onChange: onChange, onAddQuery: onAddQuery }),
        React.createElement(LabelBrowserModal, { isOpen: labelBrowserVisible, datasource: datasource, query: query, app: app, onClose: () => setLabelBrowserVisible(false), onChange: onChangeInternal, onRunQuery: onRunQuery }),
        React.createElement(EditorHeader, null,
            React.createElement(Stack, { gap: 1 },
                React.createElement(Button, { "aria-label": selectors.components.QueryBuilder.queryPatterns, variant: "secondary", size: "sm", onClick: () => {
                        setQueryPatternsModalOpen((prevValue) => !prevValue);
                        const visualQuery = buildVisualQueryFromString(query.expr || '');
                        reportInteraction('grafana_loki_query_patterns_opened', {
                            version: 'v2',
                            app: app !== null && app !== void 0 ? app : '',
                            editorMode: query.editorMode,
                            preSelectedOperationsCount: visualQuery.query.operations.length,
                            preSelectedLabelsCount: visualQuery.query.labels.length,
                        });
                    } }, "Kick start your query"),
                React.createElement(Button, { variant: "secondary", size: "sm", onClick: onClickLabelBrowserButton, "data-testid": "label-browser-button" }, "Label browser")),
            React.createElement(QueryHeaderSwitch, { label: "Explain query", value: explain, onChange: onExplainChange }),
            React.createElement(FlexItem, { grow: 1 }),
            app !== CoreApp.Explore && app !== CoreApp.Correlations && (React.createElement(Button, { variant: dataIsStale ? 'primary' : 'secondary', size: "sm", onClick: onRunQuery, icon: (data === null || data === void 0 ? void 0 : data.state) === LoadingState.Loading ? 'fa fa-spinner' : undefined, disabled: (data === null || data === void 0 ? void 0 : data.state) === LoadingState.Loading }, queries && queries.length > 1 ? `Run queries` : `Run query`)),
            React.createElement(QueryEditorModeToggle, { mode: editorMode, onChange: onEditorModeChange })),
        React.createElement(Space, { v: 0.5 }),
        React.createElement(EditorRows, null,
            editorMode === QueryEditorMode.Code && (React.createElement(LokiQueryCodeEditor, Object.assign({}, props, { query: query, onChange: onChangeInternal, showExplain: explain }))),
            editorMode === QueryEditorMode.Builder && (React.createElement(LokiQueryBuilderContainer, { datasource: props.datasource, query: query, onChange: onChangeInternal, onRunQuery: props.onRunQuery, showExplain: explain })),
            React.createElement(LokiQueryBuilderOptions, { query: query, onChange: onChange, onRunQuery: onRunQuery, app: app, maxLines: datasource.maxLines, queryStats: queryStats }))));
});
LokiQueryEditor.displayName = 'LokiQueryEditor';
//# sourceMappingURL=LokiQueryEditor.js.map