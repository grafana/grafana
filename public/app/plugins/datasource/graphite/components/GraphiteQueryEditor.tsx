import { css } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';
import { Button, useStyles2 } from '@grafana/ui';

import { actions } from '../state/actions';
import { GraphiteQueryEditorContext, GraphiteQueryEditorProps, useDispatch, useGraphiteState } from '../state/context';

import { FunctionsSection } from './FunctionsSection';
import { GraphiteTextEditor } from './GraphiteTextEditor';
import { SeriesSection } from './SeriesSection';

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
        aria-label="Toggle editor mode"
        tooltip={state?.queryModel?.error}
        onClick={() => {
          dispatch(actions.toggleEditorMode());
        }}
      />
    </div>
  );
}

function getStyles(theme: GrafanaTheme2) {
  return {
    container: css({
      display: 'flex',
    }),
    visualEditor: css({
      flexGrow: 1,
    }),
    toggleButton: css({
      marginLeft: theme.spacing(0.5),
    }),
  };
}
