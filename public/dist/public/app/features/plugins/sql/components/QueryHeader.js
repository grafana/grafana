import React, { useCallback, useState } from 'react';
import { useCopyToClipboard } from 'react-use';
import { v4 as uuidv4 } from 'uuid';
import { EditorField, EditorHeader, EditorMode, EditorRow, FlexItem, InlineSelect, Space } from '@grafana/experimental';
import { reportInteraction } from '@grafana/runtime';
import { Button, InlineSwitch, RadioButtonGroup, Tooltip } from '@grafana/ui';
import { QueryFormat, QUERY_FORMAT_OPTIONS } from '../types';
import { ConfirmModal } from './ConfirmModal';
import { DatasetSelector } from './DatasetSelector';
import { isSqlDatasourceDatabaseSelectionFeatureFlagEnabled } from './QueryEditorFeatureFlag.utils';
import { TableSelector } from './TableSelector';
const editorModes = [
    { label: 'Builder', value: EditorMode.Builder },
    { label: 'Code', value: EditorMode.Code },
];
export function QueryHeader({ db, isPostgresInstance, isQueryRunnable, onChange, onQueryRowChange, onRunQuery, preconfiguredDataset, query, queryRowFilter, }) {
    const { editorMode } = query;
    const [_, copyToClipboard] = useCopyToClipboard();
    const [showConfirm, setShowConfirm] = useState(false);
    const toRawSql = db.toRawSql;
    const onEditorModeChange = useCallback((newEditorMode) => {
        var _a;
        if (newEditorMode === EditorMode.Code) {
            reportInteraction('grafana_sql_editor_mode_changed', {
                datasource: (_a = query.datasource) === null || _a === void 0 ? void 0 : _a.type,
                selectedEditorMode: EditorMode.Code,
            });
        }
        if (editorMode === EditorMode.Code) {
            setShowConfirm(true);
            return;
        }
        onChange(Object.assign(Object.assign({}, query), { editorMode: newEditorMode }));
    }, [editorMode, onChange, query]);
    const onFormatChange = (e) => {
        var _a;
        const next = Object.assign(Object.assign({}, query), { format: e.value !== undefined ? e.value : QueryFormat.Table });
        reportInteraction('grafana_sql_format_changed', {
            datasource: (_a = query.datasource) === null || _a === void 0 ? void 0 : _a.type,
            selectedFormat: next.format,
        });
        onChange(next);
    };
    const onDatasetChange = (e) => {
        if (e.value === query.dataset) {
            return;
        }
        const next = Object.assign(Object.assign({}, query), { dataset: e.value, table: undefined, sql: undefined, rawSql: '' });
        onChange(next);
    };
    const onTableChange = (e) => {
        if (e.value === query.table) {
            return;
        }
        const next = Object.assign(Object.assign({}, query), { table: e.value, sql: undefined, rawSql: '' });
        onChange(next);
    };
    const datasetDropdownIsAvailable = () => {
        // If the feature flag is DISABLED, && the datasource is Postgres (`isPostgresInstance`),
        // we want to hide the dropdown - as per previous behavior.
        if (!isSqlDatasourceDatabaseSelectionFeatureFlagEnabled() && isPostgresInstance) {
            return false;
        }
        return true;
    };
    return (React.createElement(React.Fragment, null,
        React.createElement(EditorHeader, null,
            React.createElement(InlineSelect, { label: "Format", value: query.format, placeholder: "Select format", menuShouldPortal: true, onChange: onFormatChange, options: QUERY_FORMAT_OPTIONS }),
            editorMode === EditorMode.Builder && (React.createElement(React.Fragment, null,
                React.createElement(InlineSwitch, { id: `sql-filter-${uuidv4()}}`, label: "Filter", transparent: true, showLabel: true, value: queryRowFilter.filter, onChange: (ev) => {
                        var _a;
                        if (!(ev.target instanceof HTMLInputElement)) {
                            return;
                        }
                        reportInteraction('grafana_sql_filter_toggled', {
                            datasource: (_a = query.datasource) === null || _a === void 0 ? void 0 : _a.type,
                            displayed: ev.target.checked,
                        });
                        onQueryRowChange(Object.assign(Object.assign({}, queryRowFilter), { filter: ev.target.checked }));
                    } }),
                React.createElement(InlineSwitch, { id: `sql-group-${uuidv4()}}`, label: "Group", transparent: true, showLabel: true, value: queryRowFilter.group, onChange: (ev) => {
                        var _a;
                        if (!(ev.target instanceof HTMLInputElement)) {
                            return;
                        }
                        reportInteraction('grafana_sql_group_toggled', {
                            datasource: (_a = query.datasource) === null || _a === void 0 ? void 0 : _a.type,
                            displayed: ev.target.checked,
                        });
                        onQueryRowChange(Object.assign(Object.assign({}, queryRowFilter), { group: ev.target.checked }));
                    } }),
                React.createElement(InlineSwitch, { id: `sql-order-${uuidv4()}}`, label: "Order", transparent: true, showLabel: true, value: queryRowFilter.order, onChange: (ev) => {
                        var _a;
                        if (!(ev.target instanceof HTMLInputElement)) {
                            return;
                        }
                        reportInteraction('grafana_sql_order_toggled', {
                            datasource: (_a = query.datasource) === null || _a === void 0 ? void 0 : _a.type,
                            displayed: ev.target.checked,
                        });
                        onQueryRowChange(Object.assign(Object.assign({}, queryRowFilter), { order: ev.target.checked }));
                    } }),
                React.createElement(InlineSwitch, { id: `sql-preview-${uuidv4()}}`, label: "Preview", transparent: true, showLabel: true, value: queryRowFilter.preview, onChange: (ev) => {
                        var _a;
                        if (!(ev.target instanceof HTMLInputElement)) {
                            return;
                        }
                        reportInteraction('grafana_sql_preview_toggled', {
                            datasource: (_a = query.datasource) === null || _a === void 0 ? void 0 : _a.type,
                            displayed: ev.target.checked,
                        });
                        onQueryRowChange(Object.assign(Object.assign({}, queryRowFilter), { preview: ev.target.checked }));
                    } }))),
            React.createElement(FlexItem, { grow: 1 }),
            isQueryRunnable ? (React.createElement(Button, { icon: "play", variant: "primary", size: "sm", onClick: () => onRunQuery() }, "Run query")) : (React.createElement(Tooltip, { theme: "error", content: React.createElement(React.Fragment, null,
                    "Your query is invalid. Check below for details. ",
                    React.createElement("br", null),
                    "However, you can still run this query."), placement: "top" },
                React.createElement(Button, { icon: "exclamation-triangle", variant: "secondary", size: "sm", onClick: () => onRunQuery() }, "Run query"))),
            React.createElement(RadioButtonGroup, { options: editorModes, size: "sm", value: editorMode, onChange: onEditorModeChange }),
            React.createElement(ConfirmModal, { isOpen: showConfirm, onCopy: () => {
                    var _a;
                    reportInteraction('grafana_sql_editor_mode_changed', {
                        datasource: (_a = query.datasource) === null || _a === void 0 ? void 0 : _a.type,
                        selectedEditorMode: EditorMode.Builder,
                        type: 'copy',
                    });
                    setShowConfirm(false);
                    copyToClipboard(query.rawSql);
                    onChange(Object.assign(Object.assign({}, query), { rawSql: toRawSql(query), editorMode: EditorMode.Builder }));
                }, onDiscard: () => {
                    var _a;
                    reportInteraction('grafana_sql_editor_mode_changed', {
                        datasource: (_a = query.datasource) === null || _a === void 0 ? void 0 : _a.type,
                        selectedEditorMode: EditorMode.Builder,
                        type: 'discard',
                    });
                    setShowConfirm(false);
                    onChange(Object.assign(Object.assign({}, query), { rawSql: toRawSql(query), editorMode: EditorMode.Builder }));
                }, onCancel: () => {
                    var _a;
                    reportInteraction('grafana_sql_editor_mode_changed', {
                        datasource: (_a = query.datasource) === null || _a === void 0 ? void 0 : _a.type,
                        selectedEditorMode: EditorMode.Builder,
                        type: 'cancel',
                    });
                    setShowConfirm(false);
                } })),
        editorMode === EditorMode.Builder && (React.createElement(React.Fragment, null,
            React.createElement(Space, { v: 0.5 }),
            React.createElement(EditorRow, null,
                datasetDropdownIsAvailable() && (React.createElement(EditorField, { label: "Dataset", width: 25 },
                    React.createElement(DatasetSelector, { db: db, dataset: query.dataset, isPostgresInstance: isPostgresInstance, preconfiguredDataset: preconfiguredDataset, onChange: onDatasetChange }))),
                React.createElement(EditorField, { label: "Table", width: 25 },
                    React.createElement(TableSelector, { db: db, dataset: query.dataset || preconfiguredDataset, table: query.table, onChange: onTableChange })))))));
}
//# sourceMappingURL=QueryHeader.js.map