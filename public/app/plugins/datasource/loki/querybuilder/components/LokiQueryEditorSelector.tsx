import { css } from '@emotion/css';
import { GrafanaTheme2, LoadingState } from '@grafana/data';
import { EditorHeader, EditorRows, FlexItem, InlineSelect, Space } from '@grafana/experimental';
import { Button, useStyles2, ConfirmModal } from '@grafana/ui';
import { QueryEditorModeToggle } from 'app/plugins/datasource/prometheus/querybuilder/shared/QueryEditorModeToggle';
import { QueryEditorMode } from 'app/plugins/datasource/prometheus/querybuilder/shared/types';
import React, { useCallback, useEffect, useState } from 'react';
import { LokiQueryEditorProps } from '../../components/types';
import { lokiQueryModeller } from '../LokiQueryModeller';
import { getQueryWithDefaults } from '../state';
import { LokiQueryBuilderContainer } from './LokiQueryBuilderContainer';
import { LokiQueryBuilderExplained } from './LokiQueryBuilderExplained';
import { LokiQueryBuilderOptions } from './LokiQueryBuilderOptions';
import { LokiQueryCodeEditor } from './LokiQueryCodeEditor';
import { buildVisualQueryFromString } from '../parsing';

export const LokiQueryEditorSelector = React.memo<LokiQueryEditorProps>((props) => {
  const { onChange, onRunQuery, data } = props;
  const styles = useStyles2(getStyles);
  const query = getQueryWithDefaults(props.query);
  const [parseModalOpen, setParseModalOpen] = useState(false);

  const onEditorModeChange = useCallback(
    (newMetricEditorMode: QueryEditorMode) => {
      const change = { ...query, editorMode: newMetricEditorMode };
      if (newMetricEditorMode === QueryEditorMode.Builder) {
        const result = buildVisualQueryFromString(query.expr || '');
        // If there are errors, give user a chance to decide if they want to go to builder as that can loose some data.
        if (result.errors.length) {
          setParseModalOpen(true);
          return;
        }
      }
      onChange(change);
    },
    [onChange, query]
  );

  useEffect(() => {
    const defaultEmptyQuery = '{} |= ``';
    // For visual query builder we use default query
    if (query.editorMode === QueryEditorMode.Builder && !query.expr) {
      onChange({ ...query, expr: defaultEmptyQuery });
    }

    // For text editor we use empty query as default
    if (query.editorMode === QueryEditorMode.Code && query.expr === defaultEmptyQuery) {
      onChange({ ...query, expr: '' });
    }
  }, [query, onChange]);

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
          onChange({ ...query, editorMode: QueryEditorMode.Builder });
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
            const result = buildVisualQueryFromString(query.expr || '');
            result.query.operations = value?.operations!;
            onChange({
              ...query,
              expr: lokiQueryModeller.renderQuery(result.query),
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
          <LokiQueryBuilderContainer
            datasource={props.datasource}
            query={query}
            onChange={onChange}
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
