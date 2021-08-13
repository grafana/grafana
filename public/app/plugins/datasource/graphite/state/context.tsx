import React, { createContext, Dispatch, PropsWithChildren, useContext, useMemo, useState } from 'react';
import { AnyAction } from '@reduxjs/toolkit';
import { QueryEditorProps } from '@grafana/data';
import { GraphiteDatasource } from '../datasource';
import { GraphiteOptions, GraphiteQuery } from '../types';
import { createStore, GraphiteQueryEditorState } from './store';
import { getTemplateSrv } from 'app/features/templating/template_srv';
import { actions } from './actions';

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
  range,
  children,
}: PropsWithChildren<GraphiteQueryEditorProps>) => {
  const [state, setState] = useState<GraphiteQueryEditorState>();

  const dispatch = useMemo(() => {
    return createStore((state) => {
      setState(state);
    });
  }, []);

  if (!state) {
    dispatch(
      actions.init({
        target: query,
        datasource: datasource,
        range: range,
        templateSrv: getTemplateSrv(),
        refresh: (target: string) => {
          onChange({ ...query, target: target });
          onRunQuery();
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
