import React, { useEffect, useMemo, useState } from 'react';
import { GrafanaTheme2, QueryEditorProps } from '@grafana/data';
import { GraphiteDatasource } from '../datasource';
import { GraphiteOptions, GraphiteQuery } from '../types';
import { getTemplateSrv } from 'app/features/templating/template_srv';
import { createStore, GraphiteQueryEditorState } from '../state/store';
import { actions } from '../state/actions';
import { Button, Spinner, useStyles2 } from '@grafana/ui';
import { GraphiteContext } from '../state/context';
import { GraphiteTextEditor } from './GraphiteTextEditor';
import { SeriesSection } from './SeriesSection';
import { FunctionsSection } from './FunctionsSection';
import { css } from '@emotion/css';

export type GraphiteQueryEditorProps = QueryEditorProps<GraphiteDatasource, GraphiteQuery, GraphiteOptions>;

export function GraphiteQueryEditor({ datasource, onRunQuery, onChange, query, range }: GraphiteQueryEditorProps) {
  const [state, setState] = useState<GraphiteQueryEditorState>();
  const styles = useStyles2(getStyles);

  const dispatch = useMemo(() => {
    return createStore((state) => {
      setState(state);
    });
  }, []);

  useEffect(() => {
    const deps = {
      panelCtrl: {
        range: range,
        panel: { targets: [] },
        refresh: (target: string) => {
          onChange({ ...query, target: target });
          onRunQuery();
        },
      },
      target: query,
      datasource: datasource,
      uiSegmentSrv: undefined,
      templateSrv: getTemplateSrv(),
    };

    dispatch(actions.init(deps));
  }, [datasource, query, dispatch, onChange, onRunQuery, range]);

  if (!state) {
    return <Spinner />;
  }

  return (
    <GraphiteContext dispatch={dispatch}>
      <div className={css({ display: 'flex' })}>
        <div className={css({ flexGrow: 1 })}>
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
    </GraphiteContext>
  );
}

function getStyles(theme: GrafanaTheme2) {
  return {
    toggleButton: css`
      margin-left: ${theme.spacing(0.5)};
    `,
  };
}
