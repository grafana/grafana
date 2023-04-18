import React, { useCallback, useState } from 'react';
import { useCopyToClipboard } from 'react-use';

import { SelectableValue } from '@grafana/data';
import { EditorField, EditorHeader, EditorMode, EditorRow, FlexItem, InlineSelect, Space } from '@grafana/experimental';
import { config } from '@grafana/runtime';
import { Button, InlineSwitch, RadioButtonGroup, Tooltip } from '@grafana/ui';

import { QueryWithDefaults } from '../defaults';
import { SQLQuery, QueryFormat, QueryRowFilter, QUERY_FORMAT_OPTIONS, DB } from '../types';

import { ConfirmModal } from './ConfirmModal';
import { DatasetSelector } from './DatasetSelector';
import { TableSelector } from './TableSelector';

export interface QueryHeaderProps {
  db: DB;
  query: QueryWithDefaults;
  preconfiguredDataset: string;
  onChange: (query: SQLQuery) => void;
  onRunQuery: () => void;
  onQueryRowChange: (queryRowFilter: QueryRowFilter) => void;
  queryRowFilter: QueryRowFilter;
  isQueryRunnable: boolean;
  disableDatasetSelector?: boolean;
  cascadeDisable?: boolean;
}

const editorModes = [
  { label: 'Builder', value: EditorMode.Builder },
  { label: 'Code', value: EditorMode.Code },
];

export function QueryHeader({
  db,
  query,
  preconfiguredDataset,
  queryRowFilter,
  onChange,
  onRunQuery,
  onQueryRowChange,
  isQueryRunnable,
  disableDatasetSelector,
  cascadeDisable,
}: QueryHeaderProps) {
  const sqlDatasourceDatabaseSelectionFeatureFlagIsEnabled = config.featureToggles.sqlDatasourceDatabaseSelection;

  const { editorMode } = query;
  const [_, copyToClipboard] = useCopyToClipboard();
  const [showConfirm, setShowConfirm] = useState(false);
  const toRawSql = db.toRawSql;

  const onEditorModeChange = useCallback(
    (newEditorMode: EditorMode) => {
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

  const isDatasetDropdownEnabled = () => {
    // If the feature flag is DISABLED, && the datasource is Postgres (disableDatasetSelector),
    // we want to hide the dropdown - as per previous behavior.
    if (!sqlDatasourceDatabaseSelectionFeatureFlagIsEnabled && disableDatasetSelector) {
      return false;
    }

    return true;
  };

  return (
    <>
      <EditorHeader>
        <InlineSelect
          // disabled={cascadeDisable}
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
              // disabled={cascadeDisable}
              id="sql-filter"
              label="Filter"
              transparent={true}
              showLabel={true}
              value={queryRowFilter.filter}
              onChange={(ev) =>
                ev.target instanceof HTMLInputElement &&
                onQueryRowChange({ ...queryRowFilter, filter: ev.target.checked })
              }
            />

            <InlineSwitch
              // disabled={cascadeDisable}
              id="sql-group"
              label="Group"
              transparent={true}
              showLabel={true}
              value={queryRowFilter.group}
              onChange={(ev) =>
                ev.target instanceof HTMLInputElement &&
                onQueryRowChange({ ...queryRowFilter, group: ev.target.checked })
              }
            />

            <InlineSwitch
              // disabled={cascadeDisable}
              id="sql-order"
              label="Order"
              transparent={true}
              showLabel={true}
              value={queryRowFilter.order}
              onChange={(ev) =>
                ev.target instanceof HTMLInputElement &&
                onQueryRowChange({ ...queryRowFilter, order: ev.target.checked })
              }
            />

            <InlineSwitch
              // disabled={cascadeDisable}
              id="sql-preview"
              label="Preview"
              transparent={true}
              showLabel={true}
              value={queryRowFilter.preview}
              onChange={(ev) =>
                ev.target instanceof HTMLInputElement &&
                onQueryRowChange({ ...queryRowFilter, preview: ev.target.checked })
              }
            />
          </>
        )}

        <FlexItem grow={1} />

        {isQueryRunnable ? (
          <Button icon="play" variant="primary" size="sm" onClick={() => onRunQuery()} disabled={cascadeDisable}>
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
            <Button
              icon="exclamation-triangle"
              variant="secondary"
              size="sm"
              onClick={() => onRunQuery()}
              disabled={cascadeDisable}
            >
              Run query
            </Button>
          </Tooltip>
        )}

        <RadioButtonGroup
          options={editorModes}
          size="sm"
          value={editorMode}
          onChange={onEditorModeChange}
          // disabled={cascadeDisable}
        />

        <ConfirmModal
          isOpen={showConfirm}
          onCopy={() => {
            setShowConfirm(false);
            copyToClipboard(query.rawSql!);
            onChange({
              ...query,
              rawSql: toRawSql(query),
              editorMode: EditorMode.Builder,
            });
          }}
          onDiscard={() => {
            setShowConfirm(false);
            onChange({
              ...query,
              rawSql: toRawSql(query),
              editorMode: EditorMode.Builder,
            });
          }}
          onCancel={() => setShowConfirm(false)}
        />
      </EditorHeader>

      {editorMode === EditorMode.Builder && (
        <>
          <Space v={0.5} />
          <EditorRow>
            {isDatasetDropdownEnabled() && (
              <EditorField label="Dataset" width={25}>
                <DatasetSelector
                  db={db}
                  dataset={query.dataset}
                  disableDatasetSelector={disableDatasetSelector}
                  preconfiguredDataset={preconfiguredDataset}
                  onChange={onDatasetChange}
                />
              </EditorField>
            )}
            <EditorField label="Table" width={25}>
              <TableSelector
                db={db}
                dataset={query.dataset}
                table={query.table}
                onChange={onTableChange}
                applyDefault
                cascadeDisable={cascadeDisable}
              />
            </EditorField>
          </EditorRow>
        </>
      )}
    </>
  );
}
