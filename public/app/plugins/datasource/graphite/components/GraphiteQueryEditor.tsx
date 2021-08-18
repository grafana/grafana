import React from 'react';
import { GrafanaTheme2 } from '@grafana/data';
import { actions } from '../state/actions';
import { Button, useStyles2 } from '@grafana/ui';
import { GraphiteQueryEditorContext, GraphiteQueryEditorProps, useDispatch, useGraphiteState } from '../state/context';
import { GraphiteTextEditor } from './GraphiteTextEditor';
import { SeriesSection } from './SeriesSection';
import { FunctionsSection } from './FunctionsSection';
import { css } from '@emotion/css';

export function GraphiteQueryEditor({
  datasource,
  onRunQuery,
  onChange,
  query,
  range,
  queries,
}: GraphiteQueryEditorProps) {
  return (
    <GraphiteQueryEditorContext
      datasource={datasource}
      onRunQuery={onRunQuery}
      onChange={onChange}
      query={query}
      queries={queries}
      range={range}
    >
      <GraphiteQueryEditorContent />
    </GraphiteQueryEditorContext>
  );
}

function GraphiteQueryEditorContent() {
  const dispatch = useDispatch();
  const state = useGraphiteState();
  const styles = useStyles2(getStyles);

  return (
    <div className={styles.container}>
      <div className={styles.visualEditor}>
        {state.target?.textEditor && <GraphiteTextEditor rawQuery={state.target.target} />}
        {!state.target?.textEditor && (
          <>
            <SeriesSection state={state} />
            <FunctionsSection functions={state.queryModel?.functions} funcDefs={state.funcDefs!} />
          </>
        )}
      </div>
      <Button
        className={styles.toggleButton}
        icon="pen"
        variant="secondary"
        onClick={() => {
          dispatch(actions.toggleEditorMode());
        }}
      />
    </div>
  );
}

function getStyles(theme: GrafanaTheme2) {
  return {
    container: css`
      display: flex;
    `,
    visualEditor: css`
      flex-grow: 1;
    `,
    toggleButton: css`
      margin-left: ${theme.spacing(0.5)};
    `,
  };
}
