import React, { SyntheticEvent, useCallback, useState } from 'react';
import { css } from '@emotion/css';
import { GrafanaTheme2, LoadingState } from '@grafana/data';
import { EditorHeader, EditorRows, FlexItem, InlineSelect, Space } from '@grafana/experimental';
import { Button, ConfirmModal, useStyles2 } from '@grafana/ui';
import { PromQueryEditorProps } from '../../components/types';
import { promQueryModeller } from '../PromQueryModeller';
import { QueryEditorModeToggle } from '../shared/QueryEditorModeToggle';
import { QueryHeaderSwitch } from '../shared/QueryHeaderSwitch';
import { QueryEditorMode } from '../shared/types';
import { PromQueryBuilderExplained } from './PromQueryBuilderExplained';
import { buildVisualQueryFromString } from '../parsing';
import { PromQueryCodeEditor } from './PromQueryCodeEditor';
import { PromQueryBuilderContainer } from './PromQueryBuilderContainer';
import { PromQueryBuilderOptions } from './PromQueryBuilderOptions';
import { getQueryWithDefaults } from '../types';

export const PromQueryEditorSelector = React.memo<PromQueryEditorProps>((props) => {
  const { onChange, onRunQuery, data } = props;
  const styles = useStyles2(getStyles);
  const [parseModalOpen, setParseModalOpen] = useState(false);
  const query = getQueryWithDefaults(props.query, props.app);
  const editorMode = query.editorMode!;

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

  const onQueryPreviewChange = (event: SyntheticEvent<HTMLInputElement>) => {
    const isEnabled = event.currentTarget.checked;
    onChange({ ...query, editorPreview: isEnabled });
    onRunQuery();
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
        {editorMode === QueryEditorMode.Code && <PromQueryCodeEditor {...props} />}
        {editorMode === QueryEditorMode.Builder && (
          <PromQueryBuilderContainer
            query={query}
            datasource={props.datasource}
            onChange={onChange}
            onRunQuery={props.onRunQuery}
            data={data}
          />
        )}
        {editorMode === QueryEditorMode.Explain && <PromQueryBuilderExplained query={query.expr} />}
        {editorMode !== QueryEditorMode.Explain && (
          <PromQueryBuilderOptions query={query} app={props.app} onChange={onChange} onRunQuery={onRunQuery} />
        )}
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
