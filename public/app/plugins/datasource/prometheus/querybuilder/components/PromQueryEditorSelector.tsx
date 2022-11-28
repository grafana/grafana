import React, { SyntheticEvent, useCallback, useEffect, useState } from 'react';

import { CoreApp, LoadingState } from '@grafana/data';
import { EditorHeader, EditorRows, FlexItem, InlineSelect, Space } from '@grafana/experimental';
import { reportInteraction } from '@grafana/runtime';
import { ConfirmModal, Button } from '@grafana/ui';

import { PromQueryEditorProps } from '../../components/types';
import { PromQuery } from '../../types';
import { promQueryModeller } from '../PromQueryModeller';
import { buildVisualQueryFromString } from '../parsing';
import { QueryEditorModeToggle } from '../shared/QueryEditorModeToggle';
import { QueryHeaderSwitch } from '../shared/QueryHeaderSwitch';
import { promQueryEditorExplainKey, promQueryEditorRawQueryKey, useFlag } from '../shared/hooks/useFlag';
import { QueryEditorMode } from '../shared/types';
import { changeEditorMode, getQueryWithDefaults } from '../state';

import { PromQueryBuilderContainer } from './PromQueryBuilderContainer';
import { PromQueryBuilderOptions } from './PromQueryBuilderOptions';
import { PromQueryCodeEditor } from './PromQueryCodeEditor';

type Props = PromQueryEditorProps;

export const PromQueryEditorSelector = React.memo<Props>((props) => {
  const { onChange, onRunQuery, data, app } = props;
  const [parseModalOpen, setParseModalOpen] = useState(false);
  const [dataIsStale, setDataIsStale] = useState(false);
  const { flag: explain, setFlag: setExplain } = useFlag(promQueryEditorExplainKey);
  const { flag: rawQuery, setFlag: setRawQuery } = useFlag(promQueryEditorRawQueryKey, true);

  const query = getQueryWithDefaults(props.query, app);
  // This should be filled in from the defaults by now.
  const editorMode = query.editorMode!;

  const onEditorModeChange = useCallback(
    (newMetricEditorMode: QueryEditorMode) => {
      reportInteraction('user_grafana_prometheus_editor_mode_clicked', {
        newEditor: newMetricEditorMode,
        previousEditor: query.editorMode ?? '',
        newQuery: !query.expr,
        app: app ?? '',
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
    },
    [onChange, query, app]
  );

  useEffect(() => {
    setDataIsStale(false);
  }, [data]);

  const onQueryPreviewChange = (event: SyntheticEvent<HTMLInputElement>) => {
    const isEnabled = event.currentTarget.checked;
    setRawQuery(isEnabled);
  };

  const onChangeInternal = (query: PromQuery) => {
    setDataIsStale(true);
    onChange(query);
  };

  const onShowExplainChange = (e: SyntheticEvent<HTMLInputElement>) => {
    setExplain(e.currentTarget.checked);
  };

  return (
    <>
      <ConfirmModal
        isOpen={parseModalOpen}
        title="Query parsing"
        body="There were errors while trying to parse the query. Continuing to visual builder may lose some parts of the query."
        confirmText="Continue"
        onConfirm={() => {
          changeEditorMode(query, QueryEditorMode.Builder, onChange);
          setParseModalOpen(false);
        }}
        onDismiss={() => setParseModalOpen(false)}
      />
      <EditorHeader>
        <InlineSelect
          value={null}
          placeholder="Query patterns"
          allowCustomValue
          onChange={({ value }) => {
            // TODO: Bit convoluted as we don't have access to visualQuery model here. Maybe would make sense to
            //  move it inside the editor?
            const result = buildVisualQueryFromString(query.expr || '');
            result.query.operations = value?.operations!;
            onChange({
              ...query,
              expr: promQueryModeller.renderQuery(result.query),
            });
          }}
          options={promQueryModeller.getQueryPatterns().map((x) => ({ label: x.name, value: x }))}
        />

        <QueryHeaderSwitch label="Explain" value={explain} onChange={onShowExplainChange} />
        {editorMode === QueryEditorMode.Builder && (
          <>
            <QueryHeaderSwitch label="Raw query" value={rawQuery} onChange={onQueryPreviewChange} />
          </>
        )}
        <FlexItem grow={1} />
        {app !== CoreApp.Explore && (
          <Button
            variant={dataIsStale ? 'primary' : 'secondary'}
            size="sm"
            onClick={onRunQuery}
            icon={data?.state === LoadingState.Loading ? 'fa fa-spinner' : undefined}
            disabled={data?.state === LoadingState.Loading}
          >
            Run queries
          </Button>
        )}
        <QueryEditorModeToggle mode={editorMode} onChange={onEditorModeChange} />
      </EditorHeader>
      <Space v={0.5} />
      <EditorRows>
        {editorMode === QueryEditorMode.Code && <PromQueryCodeEditor {...props} query={query} showExplain={explain} />}
        {editorMode === QueryEditorMode.Builder && (
          <PromQueryBuilderContainer
            query={query}
            datasource={props.datasource}
            onChange={onChangeInternal}
            onRunQuery={props.onRunQuery}
            data={data}
            showRawQuery={rawQuery}
            showExplain={explain}
          />
        )}
        <PromQueryBuilderOptions query={query} app={props.app} onChange={onChange} onRunQuery={onRunQuery} />
      </EditorRows>
    </>
  );
});

PromQueryEditorSelector.displayName = 'PromQueryEditorSelector';
