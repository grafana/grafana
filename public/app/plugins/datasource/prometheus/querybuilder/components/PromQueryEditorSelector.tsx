import { css } from '@emotion/css';
import { GrafanaTheme2, LoadingState } from '@grafana/data';
import { EditorHeader, EditorRows, FlexItem, InlineSelect, Space } from '@grafana/experimental';
import { Button, useStyles2 } from '@grafana/ui';
import React, { SyntheticEvent, useCallback, useState } from 'react';
import { PromQueryEditor } from '../../components/PromQueryEditor';
import { PromQueryEditorProps } from '../../components/types';
import { promQueryModeller } from '../PromQueryModeller';
import { QueryEditorModeToggle } from '../shared/QueryEditorModeToggle';
import { QueryHeaderSwitch } from '../shared/QueryHeaderSwitch';
import { QueryEditorMode } from '../shared/types';
import { getDefaultEmptyQuery, PromVisualQuery } from '../types';
import { PromQueryBuilder } from './PromQueryBuilder';
import { PromQueryBuilderExplained } from './PromQueryBuilderExplained';
import { PromQueryBuilderOptions } from './PromQueryBuilderOptions';
import { QueryPreview } from './QueryPreview';

export const PromQueryEditorSelector = React.memo<PromQueryEditorProps>((props) => {
  const { query, onChange, onRunQuery, data } = props;
  const styles = useStyles2(getStyles);
  const [visualQuery, setVisualQuery] = useState<PromVisualQuery>(query.visualQuery ?? getDefaultEmptyQuery());

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
      visualQuery: updatedQuery,
      editorMode: QueryEditorMode.Builder,
    });
  };

  const onQueryPreviewChange = (event: SyntheticEvent<HTMLInputElement>) => {
    const isEnabled = event.currentTarget.checked;
    onChange({ ...query, editorPreview: isEnabled });
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
        {editorMode === QueryEditorMode.Builder && (
          <>
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
              options={promQueryModeller.getQueryPatterns().map((x) => ({ label: x.name, value: x }))}
            />
          </>
        )}
        <QueryHeaderSwitch
          label="Preview"
          value={query.editorPreview}
          onChange={onQueryPreviewChange}
          disabled={editorMode !== QueryEditorMode.Builder}
        />
        <QueryEditorModeToggle mode={editorMode} onChange={onEditorModeChange} />
      </EditorHeader>
      <Space v={0.5} />
      <EditorRows>
        {editorMode === QueryEditorMode.Code && <PromQueryEditor {...props} />}
        {editorMode === QueryEditorMode.Builder && (
          <>
            <PromQueryBuilder
              query={visualQuery}
              datasource={props.datasource}
              onChange={onChangeViewModel}
              onRunQuery={props.onRunQuery}
            />
            {query.editorPreview && <QueryPreview query={visualQuery} />}
            <PromQueryBuilderOptions query={query} app={props.app} onChange={onChange} onRunQuery={onRunQuery} />
          </>
        )}
        {editorMode === QueryEditorMode.Explain && <PromQueryBuilderExplained query={visualQuery} />}
      </EditorRows>
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
