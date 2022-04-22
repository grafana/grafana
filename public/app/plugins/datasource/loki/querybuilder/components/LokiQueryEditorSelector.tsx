import { css } from '@emotion/css';
import React, { useCallback, useState } from 'react';

import { GrafanaTheme2, LoadingState } from '@grafana/data';
import { EditorHeader, EditorRows, FlexItem, InlineSelect, Space } from '@grafana/experimental';
import { Button, useStyles2, ConfirmModal } from '@grafana/ui';
import { QueryEditorModeToggle } from 'app/plugins/datasource/prometheus/querybuilder/shared/QueryEditorModeToggle';
import { QueryEditorMode } from 'app/plugins/datasource/prometheus/querybuilder/shared/types';

import { LokiQueryEditorProps } from '../../components/types';
import { LokiQuery } from '../../types';
import { lokiQueryModeller } from '../LokiQueryModeller';
import { buildVisualQueryFromString } from '../parsing';
import { getQueryWithDefaults } from '../state';
import { getDefaultEmptyQuery, LokiVisualQuery } from '../types';

import { LokiQueryBuilder } from './LokiQueryBuilder';
import { LokiQueryBuilderExplained } from './LokiQueryBuilderExplaind';
import { LokiQueryBuilderOptions } from './LokiQueryBuilderOptions';
import { LokiQueryCodeEditor } from './LokiQueryCodeEditor';

export const LokiQueryEditorSelector = React.memo<LokiQueryEditorProps>((props) => {
  const { onChange, onRunQuery, data } = props;
  const styles = useStyles2(getStyles);
  const query = getQueryWithDefaults(props.query);
  const [visualQuery, setVisualQuery] = useState<LokiVisualQuery>(query.visualQuery ?? getDefaultEmptyQuery());
  const [parseModalOpen, setParseModalOpen] = useState(false);
  const [pendingChange, setPendingChange] = useState<LokiQuery | undefined>(undefined);

  const onEditorModeChange = useCallback(
    (newMetricEditorMode: QueryEditorMode) => {
      const change = { ...query, editorMode: newMetricEditorMode };
      if (newMetricEditorMode === QueryEditorMode.Builder) {
        const result = buildVisualQueryFromString(query.expr);
        change.visualQuery = result.query;
        // If there are errors, give user a chance to decide if they want to go to builder as that can loose some data.
        if (result.errors.length) {
          setParseModalOpen(true);
          setPendingChange(change);
          return;
        }
        setVisualQuery(change.visualQuery);
      }
      onChange(change);
    },
    [onChange, query]
  );

  const onChangeViewModel = (updatedQuery: LokiVisualQuery) => {
    setVisualQuery(updatedQuery);

    onChange({
      ...query,
      expr: lokiQueryModeller.renderQuery(updatedQuery),
      visualQuery: updatedQuery,
      editorMode: QueryEditorMode.Builder,
    });
  };

  // If no expr (ie new query) then default to builder
  const editorMode = query.editorMode ?? (query.expr ? QueryEditorMode.Code : QueryEditorMode.Builder);

  return (
    <>
      <ConfirmModal
        isOpen={parseModalOpen}
        title="Query parsing"
        body="There were errors while trying to parse the query. Continuing to visual builder may loose some parts of the query."
        confirmText="Continue"
        onConfirm={() => {
          setVisualQuery(pendingChange!.visualQuery!);
          onChange(pendingChange!);
          setParseModalOpen(false);
        }}
        onDismiss={() => setParseModalOpen(false)}
      />
      <EditorHeader>
        <FlexItem grow={1} />
        <Button
          className={styles.runQuery}
          variant="secondary"
          size="sm"
          fill="outline"
          onClick={onRunQuery}
          icon={data?.state === LoadingState.Loading ? 'fa fa-spinner' : undefined}
          disabled={data?.state === LoadingState.Loading}
        >
          Run query
        </Button>
        <InlineSelect
          value={null}
          placeholder="Query patterns"
          allowCustomValue
          onChange={({ value }) => {
            onChangeViewModel({
              ...visualQuery,
              operations: value?.operations!,
            });
          }}
          options={lokiQueryModeller.getQueryPatterns().map((x) => ({ label: x.name, value: x }))}
        />
        <QueryEditorModeToggle mode={editorMode} onChange={onEditorModeChange} />
      </EditorHeader>
      <Space v={0.5} />
      <EditorRows>
        {editorMode === QueryEditorMode.Code && <LokiQueryCodeEditor {...props} />}
        {editorMode === QueryEditorMode.Builder && (
          <LokiQueryBuilder
            datasource={props.datasource}
            query={visualQuery}
            onChange={onChangeViewModel}
            onRunQuery={props.onRunQuery}
          />
        )}
        {editorMode === QueryEditorMode.Explain && <LokiQueryBuilderExplained query={visualQuery} />}
        {editorMode !== QueryEditorMode.Explain && (
          <LokiQueryBuilderOptions query={query} onChange={onChange} onRunQuery={onRunQuery} />
        )}
      </EditorRows>
    </>
  );
});

LokiQueryEditorSelector.displayName = 'LokiQueryEditorSelector';

const getStyles = (theme: GrafanaTheme2) => {
  return {
    runQuery: css({
      color: theme.colors.text.secondary,
    }),
    switchLabel: css({
      color: theme.colors.text.secondary,
      fontSize: theme.typography.bodySmall.fontSize,
    }),
  };
};
