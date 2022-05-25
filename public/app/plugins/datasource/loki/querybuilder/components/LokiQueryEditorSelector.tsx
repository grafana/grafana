import React, { SyntheticEvent, useCallback, useEffect, useState } from 'react';

import { LoadingState } from '@grafana/data';
import { EditorHeader, EditorRows, FlexItem, InlineSelect, Space } from '@grafana/experimental';
import { Button, ConfirmModal } from '@grafana/ui';
import { QueryEditorModeToggle } from 'app/plugins/datasource/prometheus/querybuilder/shared/QueryEditorModeToggle';
import { QueryHeaderSwitch } from 'app/plugins/datasource/prometheus/querybuilder/shared/QueryHeaderSwitch';
import { QueryEditorMode } from 'app/plugins/datasource/prometheus/querybuilder/shared/types';

import { LokiQueryEditorProps } from '../../components/types';
import { LokiQuery } from '../../types';
import { lokiQueryModeller } from '../LokiQueryModeller';
import { buildVisualQueryFromString } from '../parsing';
import { changeEditorMode, getQueryWithDefaults } from '../state';

import { LokiQueryBuilderContainer } from './LokiQueryBuilderContainer';
import { LokiQueryBuilderExplained } from './LokiQueryBuilderExplained';
import { LokiQueryBuilderOptions } from './LokiQueryBuilderOptions';
import { LokiQueryCodeEditor } from './LokiQueryCodeEditor';

export const LokiQueryEditorSelector = React.memo<LokiQueryEditorProps>((props) => {
  const { onChange, onRunQuery, data } = props;
  const [parseModalOpen, setParseModalOpen] = useState(false);
  const [dataIsStale, setDataIsStale] = useState(false);

  const query = getQueryWithDefaults(props.query);
  // This should be filled in from the defaults by now.
  const editorMode = query.editorMode!;

  const onEditorModeChange = useCallback(
    (newEditorMode: QueryEditorMode) => {
      if (newEditorMode === QueryEditorMode.Builder) {
        const result = buildVisualQueryFromString(query.expr || '');
        // If there are errors, give user a chance to decide if they want to go to builder as that can loose some data.
        if (result.errors.length) {
          setParseModalOpen(true);
          return;
        }
      }
      changeEditorMode(query, newEditorMode, onChange);
    },
    [onChange, query]
  );

  useEffect(() => {
    setDataIsStale(false);
  }, [data]);

  const onChangeInternal = (query: LokiQuery) => {
    setDataIsStale(true);
    onChange(query);
  };

  const onQueryPreviewChange = (event: SyntheticEvent<HTMLInputElement>) => {
    const isEnabled = event.currentTarget.checked;
    onChange({ ...query, rawQuery: isEnabled });
  };

  return (
    <>
      <ConfirmModal
        isOpen={parseModalOpen}
        title="Query parsing"
        body="There were errors while trying to parse the query. Continuing to visual builder may loose some parts of the query."
        confirmText="Continue"
        onConfirm={() => {
          onChange({ ...query, editorMode: QueryEditorMode.Builder });
          setParseModalOpen(false);
        }}
        onDismiss={() => setParseModalOpen(false)}
      />
      <EditorHeader>
        {editorMode === QueryEditorMode.Builder && (
          <>
            <InlineSelect
              value={null}
              placeholder="Query patterns"
              allowCustomValue
              onChange={({ value }) => {
                const result = buildVisualQueryFromString(query.expr || '');
                result.query.operations = value?.operations!;
                onChange({
                  ...query,
                  expr: lokiQueryModeller.renderQuery(result.query),
                });
              }}
              options={lokiQueryModeller.getQueryPatterns().map((x) => ({ label: x.name, value: x }))}
            />
            <QueryHeaderSwitch label="Raw query" value={query.rawQuery} onChange={onQueryPreviewChange} />
          </>
        )}
        <FlexItem grow={1} />
        <Button
          variant={dataIsStale ? 'primary' : 'secondary'}
          size="sm"
          onClick={onRunQuery}
          icon={data?.state === LoadingState.Loading ? 'fa fa-spinner' : undefined}
          disabled={data?.state === LoadingState.Loading}
        >
          Run query
        </Button>
        <QueryEditorModeToggle mode={editorMode!} onChange={onEditorModeChange} />
      </EditorHeader>
      <Space v={0.5} />
      <EditorRows>
        {editorMode === QueryEditorMode.Code && <LokiQueryCodeEditor {...props} />}
        {editorMode === QueryEditorMode.Builder && (
          <LokiQueryBuilderContainer
            datasource={props.datasource}
            query={query}
            onChange={onChangeInternal}
            onRunQuery={props.onRunQuery}
          />
        )}
        {editorMode === QueryEditorMode.Explain && <LokiQueryBuilderExplained query={query.expr} />}
        {editorMode !== QueryEditorMode.Explain && (
          <LokiQueryBuilderOptions query={query} onChange={onChange} onRunQuery={onRunQuery} />
        )}
      </EditorRows>
    </>
  );
});

LokiQueryEditorSelector.displayName = 'LokiQueryEditorSelector';
