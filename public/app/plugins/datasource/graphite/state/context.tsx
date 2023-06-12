import { AnyAction } from '@reduxjs/toolkit';
import React, { createContext, Dispatch, PropsWithChildren, useContext, useEffect, useMemo, useState } from 'react';
import { usePrevious } from 'react-use';

import { QueryEditorProps } from '@grafana/data';
import { getTemplateSrv } from 'app/features/templating/template_srv';

import { GraphiteDatasource } from '../datasource';
import { GraphiteOptions, GraphiteQuery } from '../types';

import { actions } from './actions';
import { createStore, GraphiteQueryEditorState } from './store';

const DispatchContext = createContext<Dispatch<AnyAction>>({} as Dispatch<AnyAction>);
const GraphiteStateContext = createContext<GraphiteQueryEditorState>({} as GraphiteQueryEditorState);

export const useDispatch = () => {
  return useContext(DispatchContext);
};

export const useGraphiteState = () => {
  return useContext(GraphiteStateContext);
};

export type GraphiteQueryEditorProps = QueryEditorProps<GraphiteDatasource, GraphiteQuery, GraphiteOptions>;

export const GraphiteQueryEditorContext = ({
  datasource,
  onRunQuery,
  onChange,
  query,
  queries,
  range,
  children,
}: PropsWithChildren<GraphiteQueryEditorProps>) => {
  const [state, setState] = useState<GraphiteQueryEditorState>();
  const [needsRefresh, setNeedsRefresh] = useState<boolean>(false);

  const dispatch = useMemo(() => {
    return createStore((state) => {
      setState(state);
    });
  }, []);

  // synchronise changes provided in props with editor's state
  const previousRange = usePrevious(range);
  useEffect(() => {
    if (previousRange?.raw !== range?.raw) {
      dispatch(actions.timeRangeChanged(range));
    }
  }, [dispatch, range, previousRange]);

  useEffect(
    () => {
      if (state) {
        dispatch(actions.queriesChanged(queries));
      }
    },
    // adding state to dependencies causes infinite loops
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [dispatch, queries]
  );

  useEffect(
    () => {
      if (state && state.target?.target !== query.target) {
        dispatch(actions.queryChanged(query));
      }
    },
    // adding state to dependencies causes infinite loops
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [dispatch, query]
  );

  useEffect(
    () => {
      if (needsRefresh && state) {
        setNeedsRefresh(false);
        onChange({ ...query, target: state.target.target });
        onRunQuery();
      }
    },
    // adding state to dependencies causes infinite loops
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [needsRefresh, onChange, onRunQuery, query]
  );

  if (!state) {
    dispatch(
      actions.init({
        target: query,
        datasource: datasource,
        range: range,
        templateSrv: getTemplateSrv(),
        // list of queries is passed only when the editor is in Dashboards. This is to allow interpolation
        // of sub-queries which are stored in "targetFull" property used by alerting in the backend.
        queries: queries || [],
        refresh: () => {
          // do not run onChange/onRunQuery straight away to ensure the internal state gets updated first
          // to avoid race conditions (onChange could update props before the reducer action finishes)
          setNeedsRefresh(true);
        },
      })
    );
    return null;
  } else {
    return (
      <GraphiteStateContext.Provider value={state}>
        <DispatchContext.Provider value={dispatch}>{children}</DispatchContext.Provider>
      </GraphiteStateContext.Provider>
    );
  }
};
