import { css } from '@emotion/css';
import { GrafanaTheme2, LoadingState } from '@grafana/data';
import { EditorHeader, FlexItem, InlineSelect, Space } from '@grafana/experimental';
import { Button, useStyles2 } from '@grafana/ui';
import { QueryEditorModeToggle } from 'app/plugins/datasource/prometheus/querybuilder/shared/QueryEditorModeToggle';
import { QueryHeaderSwitch } from 'app/plugins/datasource/prometheus/querybuilder/shared/QueryHeaderSwitch';
import { QueryEditorMode } from 'app/plugins/datasource/prometheus/querybuilder/shared/types';
import React, { SyntheticEvent, useCallback, useState } from 'react';
import { LokiQueryEditor } from '../../components/LokiQueryEditor';
import { LokiQueryEditorProps } from '../../components/types';
import { LokiQueryType } from '../../types';
import { lokiQueryModeller } from '../LokiQueryModeller';
import { getDefaultEmptyQuery, LokiVisualQuery } from '../types';
import { LokiQueryBuilder } from './LokiQueryBuilder';
import { LokiQueryBuilderExplained } from './LokiQueryBuilderExplaind';

export const LokiQueryEditorSelector = React.memo<LokiQueryEditorProps>((props) => {
  const { query, onChange, onRunQuery, data } = props;
  const styles = useStyles2(getStyles);
  const [visualQuery, setVisualQuery] = useState<LokiVisualQuery>(query.visualQuery ?? getDefaultEmptyQuery());

  const onEditorModeChange = useCallback(
    (newMetricEditorMode: QueryEditorMode) => {
      onChange({ ...query, editorMode: newMetricEditorMode });
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

  const onInstantChange = (event: SyntheticEvent<HTMLInputElement>) => {
    onChange({ ...query, queryType: event.currentTarget.checked ? LokiQueryType.Instant : LokiQueryType.Range });
    onRunQuery();
  };

  // If no expr (ie new query) then default to builder
  const editorMode = query.editorMode ?? (query.expr ? QueryEditorMode.Code : QueryEditorMode.Builder);

  return (
    <>
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
        <QueryHeaderSwitch
          label="Instant"
          value={query.queryType === LokiQueryType.Instant}
          onChange={onInstantChange}
        />
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
      {editorMode === QueryEditorMode.Code && <LokiQueryEditor {...props} />}
      {editorMode === QueryEditorMode.Builder && (
        <LokiQueryBuilder
          datasource={props.datasource}
          query={visualQuery}
          onChange={onChangeViewModel}
          onRunQuery={props.onRunQuery}
        />
      )}
      {editorMode === QueryEditorMode.Explain && <LokiQueryBuilderExplained query={visualQuery} />}
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
