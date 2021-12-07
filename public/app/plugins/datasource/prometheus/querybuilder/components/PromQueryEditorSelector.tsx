import { css } from '@emotion/css';
import { GrafanaTheme2, LoadingState } from '@grafana/data';
import { EditorHeader, FlexItem, InlineSelect, Space, Stack } from '@grafana/experimental';
import { Button, Switch, useStyles2 } from '@grafana/ui';
import React, { useCallback, useState } from 'react';
import { PromQueryEditor } from '../../components/PromQueryEditor';
import { PromQueryEditorProps } from '../../components/types';
import { promQueryModeller } from '../PromQueryModeller';
import { QueryEditorModeToggle } from '../shared/QueryEditorModeToggle';
import { QueryEditorMode } from '../shared/types';
import { getDefaultTestQuery, PromVisualQuery } from '../types';
import { PromQueryBuilder } from './PromQueryBuilder';

export const PromQueryEditorSelector = React.memo<PromQueryEditorProps>((props) => {
  const { query, onChange, onRunQuery, data } = props;
  const styles = useStyles2(getStyles);
  const [visualQuery, setVisualQuery] = useState<PromVisualQuery>(getDefaultTestQuery());

  const onEditorModeChange = useCallback(
    (newMetricEditorMode: QueryEditorMode) => {
      onChange({ ...query, editorMode: newMetricEditorMode });
    },
    [onChange, query]
  );

  const onChangeViewModel = (updatedQuery: PromVisualQuery) => {
    setVisualQuery(updatedQuery);

    onChange({
      ...query,
      expr: promQueryModeller.renderQuery(updatedQuery),
      editorMode: QueryEditorMode.Builder,
    });
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
          disabled={data?.state === LoadingState.Loading}
        >
          Run query
        </Button>
        <Stack gap={1}>
          <label className={styles.switchLabel}>Instant</label>
          <Switch />
        </Stack>
        <Stack gap={1}>
          <label className={styles.switchLabel}>Exemplars</label>
          <Switch />
        </Stack>
        {editorMode === QueryEditorMode.Builder && (
          <InlineSelect
            width={14.5}
            value={null}
            placeholder="Query patterns"
            allowCustomValue
            onChange={({ value }) => {
              onChangeViewModel({
                ...visualQuery,
                operations: value?.operations!,
              });
            }}
            options={promQueryModeller.getQueryPatterns().map((x) => ({ label: x.name, value: x }))}
          />
        )}
        <QueryEditorModeToggle mode={editorMode} onChange={onEditorModeChange} />
      </EditorHeader>
      <Space v={0.5} />
      {editorMode === QueryEditorMode.Code && <PromQueryEditor {...props} />}
      {editorMode === QueryEditorMode.Builder && (
        <PromQueryBuilder query={visualQuery} datasource={props.datasource} onChange={onChangeViewModel} />
      )}
    </>
  );
});

PromQueryEditorSelector.displayName = 'PromQueryEditorSelector';

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
