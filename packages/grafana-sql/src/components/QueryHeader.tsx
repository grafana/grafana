import { useCallback, useId, useState } from 'react';
import { useCopyToClipboard } from 'react-use';

import { SelectableValue } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { EditorField, EditorHeader, EditorMode, EditorRow, FlexItem, InlineSelect } from '@grafana/experimental';
import { reportInteraction } from '@grafana/runtime';
import { Button, InlineSwitch, RadioButtonGroup, Tooltip, Space } from '@grafana/ui';

import { QueryWithDefaults } from '../defaults';
import { SQLQuery, QueryFormat, QueryRowFilter, QUERY_FORMAT_OPTIONS, DB, SQLDialect } from '../types';

import { ConfirmModal } from './ConfirmModal';
import { DatasetSelector } from './DatasetSelector';
import { isSqlDatasourceDatabaseSelectionFeatureFlagEnabled } from './QueryEditorFeatureFlag.utils';
import { TableSelector } from './TableSelector';

export interface QueryHeaderProps {
  db: DB;
  dialect: SQLDialect;
  isQueryRunnable: boolean;
  onChange: (query: SQLQuery) => void;
  onQueryRowChange: (queryRowFilter: QueryRowFilter) => void;
  onRunQuery: () => void;
  preconfiguredDataset: string;
  query: QueryWithDefaults;
  queryRowFilter: QueryRowFilter;
}

const editorModes = [
  { label: 'Builder', value: EditorMode.Builder },
  { label: 'Code', value: EditorMode.Code },
];

export function QueryHeader({
  db,
  dialect,
  isQueryRunnable,
  onChange,
  onQueryRowChange,
  onRunQuery,
  preconfiguredDataset,
  query,
  queryRowFilter,
}: QueryHeaderProps) {
  const { editorMode } = query;
  const [_, copyToClipboard] = useCopyToClipboard();
  const [showConfirm, setShowConfirm] = useState(false);
  const toRawSql = db.toRawSql;

  const htmlId = useId();

  const onEditorModeChange = useCallback(
    (newEditorMode: EditorMode) => {
      if (newEditorMode === EditorMode.Code) {
        reportInteraction('grafana_sql_editor_mode_changed', {
          datasource: query.datasource?.type,
          selectedEditorMode: EditorMode.Code,
        });
      }

      if (editorMode === EditorMode.Code) {
        setShowConfirm(true);
        return;
      }
      onChange({ ...query, editorMode: newEditorMode });
    },
    [editorMode, onChange, query]
  );

  const onFormatChange = (e: SelectableValue) => {
    const next = { ...query, format: e.value !== undefined ? e.value : QueryFormat.Table };

    reportInteraction('grafana_sql_format_changed', {
      datasource: query.datasource?.type,
      selectedFormat: next.format,
    });
    onChange(next);
  };

  const onDatasetChange = (e: SelectableValue) => {
    if (e.value === query.dataset) {
      return;
    }

    const next = {
      ...query,
      dataset: e.value,
      table: undefined,
      sql: undefined,
      rawSql: '',
    };

    onChange(next);
  };

  const onTableChange = (e: SelectableValue) => {
    if (e.value === query.table) {
      return;
    }

    const next: SQLQuery = {
      ...query,
      table: e.value,
      sql: undefined,
      rawSql: '',
    };

    onChange(next);
  };

  const datasetDropdownIsAvailable = () => {
    if (dialect === 'influx') {
      return false;
    }
    // If the feature flag is DISABLED, && the datasource is Postgres (`dialect = 'postgres`),
    // we want to hide the dropdown - as per previous behavior.
    if (!isSqlDatasourceDatabaseSelectionFeatureFlagEnabled() && dialect === 'postgres') {
      return false;
    }

    return true;
  };

  return (
    <>
      <EditorHeader>
        <InlineSelect
          label="Format"
          value={query.format}
          placeholder="Select format"
          menuShouldPortal
          onChange={onFormatChange}
          options={QUERY_FORMAT_OPTIONS}
        />

        {editorMode === EditorMode.Builder && (
          <>
            <InlineSwitch
              id={`sql-filter-${htmlId}`}
              label="Filter"
              data-testid={selectors.components.SQLQueryEditor.headerFilterSwitch}
              transparent={true}
              showLabel={true}
              value={queryRowFilter.filter}
              onChange={(ev) => {
                if (!(ev.target instanceof HTMLInputElement)) {
                  return;
                }

                reportInteraction('grafana_sql_filter_toggled', {
                  datasource: query.datasource?.type,
                  displayed: ev.target.checked,
                });

                onQueryRowChange({ ...queryRowFilter, filter: ev.target.checked });
              }}
            />

            <InlineSwitch
              id={`sql-group-${htmlId}`}
              label="Group"
              data-testid={selectors.components.SQLQueryEditor.headerGroupSwitch}
              transparent={true}
              showLabel={true}
              value={queryRowFilter.group}
              onChange={(ev) => {
                if (!(ev.target instanceof HTMLInputElement)) {
                  return;
                }

                reportInteraction('grafana_sql_group_toggled', {
                  datasource: query.datasource?.type,
                  displayed: ev.target.checked,
                });

                onQueryRowChange({ ...queryRowFilter, group: ev.target.checked });
              }}
            />

            <InlineSwitch
              id={`sql-order-${htmlId}`}
              label="Order"
              data-testid={selectors.components.SQLQueryEditor.headerOrderSwitch}
              transparent={true}
              showLabel={true}
              value={queryRowFilter.order}
              onChange={(ev) => {
                if (!(ev.target instanceof HTMLInputElement)) {
                  return;
                }

                reportInteraction('grafana_sql_order_toggled', {
                  datasource: query.datasource?.type,
                  displayed: ev.target.checked,
                });

                onQueryRowChange({ ...queryRowFilter, order: ev.target.checked });
              }}
            />

            <InlineSwitch
              id={`sql-preview-${htmlId}`}
              label="Preview"
              data-testid={selectors.components.SQLQueryEditor.headerPreviewSwitch}
              transparent={true}
              showLabel={true}
              value={queryRowFilter.preview}
              onChange={(ev) => {
                if (!(ev.target instanceof HTMLInputElement)) {
                  return;
                }

                reportInteraction('grafana_sql_preview_toggled', {
                  datasource: query.datasource?.type,
                  displayed: ev.target.checked,
                });

                onQueryRowChange({ ...queryRowFilter, preview: ev.target.checked });
              }}
            />
          </>
        )}

        <FlexItem grow={1} />

        {isQueryRunnable ? (
          <Button icon="play" variant="primary" size="sm" onClick={() => onRunQuery()}>
            Run query
          </Button>
        ) : (
          <Tooltip
            theme="error"
            content={
              <>
                Your query is invalid. Check below for details. <br />
                However, you can still run this query.
              </>
            }
            placement="top"
          >
            <Button icon="exclamation-triangle" variant="secondary" size="sm" onClick={() => onRunQuery()}>
              Run query
            </Button>
          </Tooltip>
        )}

        <RadioButtonGroup options={editorModes} size="sm" value={editorMode} onChange={onEditorModeChange} />

        <ConfirmModal
          isOpen={showConfirm}
          onCopy={() => {
            reportInteraction('grafana_sql_editor_mode_changed', {
              datasource: query.datasource?.type,
              selectedEditorMode: EditorMode.Builder,
              type: 'copy',
            });

            setShowConfirm(false);
            copyToClipboard(query.rawSql!);
            onChange({
              ...query,
              rawSql: toRawSql(query),
              editorMode: EditorMode.Builder,
            });
          }}
          onDiscard={() => {
            reportInteraction('grafana_sql_editor_mode_changed', {
              datasource: query.datasource?.type,
              selectedEditorMode: EditorMode.Builder,
              type: 'discard',
            });

            setShowConfirm(false);
            onChange({
              ...query,
              rawSql: toRawSql(query),
              editorMode: EditorMode.Builder,
            });
          }}
          onCancel={() => {
            reportInteraction('grafana_sql_editor_mode_changed', {
              datasource: query.datasource?.type,
              selectedEditorMode: EditorMode.Builder,
              type: 'cancel',
            });

            setShowConfirm(false);
          }}
        />
      </EditorHeader>

      {editorMode === EditorMode.Builder && (
        <>
          <Space v={0.5} />
          <EditorRow>
            {datasetDropdownIsAvailable() && (
              <EditorField label="Dataset" width={25}>
                <DatasetSelector
                  db={db}
                  inputId={`sql-dataset-${htmlId}`}
                  dataset={query.dataset}
                  dialect={dialect}
                  preconfiguredDataset={preconfiguredDataset}
                  onChange={onDatasetChange}
                />
              </EditorField>
            )}
            <EditorField label="Table" width={25}>
              <TableSelector
                db={db}
                inputId={`sql-tableselect-${htmlId}`}
                dataset={query.dataset || preconfiguredDataset}
                table={query.table}
                onChange={onTableChange}
              />
            </EditorField>
          </EditorRow>
        </>
      )}
    </>
  );
}
