import React, { useCallback, useState } from 'react';
import { useCopyToClipboard } from 'react-use';
import { v4 as uuidv4 } from 'uuid';

import { SelectableValue } from '@grafana/data';
import { EditorField, EditorHeader, EditorMode, EditorRow, FlexItem, InlineSelect, Space } from '@grafana/experimental';
import { reportInteraction } from '@grafana/runtime';
import { Button, InlineSwitch, RadioButtonGroup, Tooltip } from '@grafana/ui';
import { t, Trans } from 'app/core/internationalization';

import { QueryWithDefaults } from '../defaults';
import { SQLQuery, QueryFormat, QueryRowFilter, QUERY_FORMAT_OPTIONS, DB } from '../types';

import { ConfirmModal } from './ConfirmModal';
import { DatasetSelector } from './DatasetSelector';
import { isSqlDatasourceDatabaseSelectionFeatureFlagEnabled } from './QueryEditorFeatureFlag.utils';
import { TableSelector } from './TableSelector';

export interface QueryHeaderProps {
  db: DB;
  isPostgresInstance?: boolean;
  isQueryRunnable: boolean;
  onChange: (query: SQLQuery) => void;
  onQueryRowChange: (queryRowFilter: QueryRowFilter) => void;
  onRunQuery: () => void;
  preconfiguredDataset: string;
  query: QueryWithDefaults;
  queryRowFilter: QueryRowFilter;
}

const editorModes = [
  { label: t('query-editor.editor-header.builder-mode', 'Builder'), value: EditorMode.Builder },
  { label: t('query-editor.editor-header.code-mode', 'Code'), value: EditorMode.Code },
];

export function QueryHeader({
  db,
  isPostgresInstance,
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
    // If the feature flag is DISABLED, && the datasource is Postgres (`isPostgresInstance`),
    // we want to hide the dropdown - as per previous behavior.
    if (!isSqlDatasourceDatabaseSelectionFeatureFlagEnabled() && isPostgresInstance) {
      return false;
    }

    return true;
  };

  return (
    <>
      <EditorHeader>
        <InlineSelect
          label={t('query-editor.editor-header.format', 'Format')}
          value={query.format}
          placeholder="Select format"
          menuShouldPortal
          onChange={onFormatChange}
          options={QUERY_FORMAT_OPTIONS}
        />

        {editorMode === EditorMode.Builder && (
          <>
            <InlineSwitch
              id={`sql-filter-${uuidv4()}}`}
              label={t('query-editor.editor-header.filter', 'Filter')}
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
              id={`sql-group-${uuidv4()}}`}
              label={t('query-editor.editor-header.group', 'Group')}
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
              id={`sql-order-${uuidv4()}}`}
              label={t('query-editor.editor-header.order', 'Order')}
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
              id={`sql-preview-${uuidv4()}}`}
              label={t('query-editor.editor-header.preview', 'Preview')}
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
            <Trans i18nKey="query-editor.editor-header.run-query">Run query</Trans>
          </Button>
        ) : (
          <Tooltip
            theme="error"
            content={
              <>
                <Trans i18nKey="query-editor.editor-header.invalid-query">
                  Your query is invalid. Check below for details. <br />
                  However, you can still run this query.
                </Trans>
              </>
            }
            placement="top"
          >
            <Button icon="exclamation-triangle" variant="secondary" size="sm" onClick={() => onRunQuery()}>
              <Trans i18nKey="query-editor.editor-header.run-query">Run query</Trans>
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
              <EditorField label={t('query-editor.editor-row.dataset', 'Dataset')} width={25}>
                <DatasetSelector
                  db={db}
                  dataset={query.dataset}
                  isPostgresInstance={isPostgresInstance}
                  preconfiguredDataset={preconfiguredDataset}
                  onChange={onDatasetChange}
                />
              </EditorField>
            )}
            <EditorField label={t('query-editor.editor-row.table', 'Table')} width={25}>
              <TableSelector
                db={db}
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
