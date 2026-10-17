import { type AnyAction } from '@reduxjs/toolkit';
import {
  createContext,
  type Dispatch,
  type PropsWithChildren,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import { type QueryEditorProps } from '@grafana/data';
import { getTemplateSrv } from '@grafana/runtime';

import { type GraphiteDatasource } from '../datasource';
import { type GraphiteOptions, type GraphiteQuery } from '../types';

import { actions } from './actions';
import { createStore, type GraphiteQueryEditorState } from './store';

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
  const initStarted = useRef(false);
  const initialized = state !== undefined;

  const dispatch = useMemo(() => {
    return createStore((state) => {
      setState(state);
    });
  }, []);

  // synchronise changes provided in props with editor's state
  useEffect(
    () => {
      if (initialized) {
        dispatch(
          actions.editorPropsChanged({
            range,
            queries,
            query,
          })
        );
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [dispatch, initialized, query.target, JSON.stringify(queries), JSON.stringify(range?.raw)]
  );

  useEffect(() => {
    if (initStarted.current) {
      return;
    }

    initStarted.current = true;

    dispatch(
      actions.init({
        target: { ...query },
        datasource,
        range,
        templateSrv: getTemplateSrv(),
        queries: queries || [],
        refresh: () => {
          setNeedsRefresh(true);
        },
      })
    );
  }, [datasource, dispatch, queries, query, range]);

  useEffect(
    () => {
      if (needsRefresh && state) {
        setNeedsRefresh(false);
        onChange({ ...query, target: state.target.target, targetFull: state.target.targetFull });
        onRunQuery();
      }
    },
    // adding state to dependencies causes infinite loops
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [needsRefresh, JSON.stringify(query)]
  );

  if (!state) {
    return null;
  }

  return (
    <GraphiteStateContext.Provider value={state}>
      <DispatchContext.Provider value={dispatch}>{children}</DispatchContext.Provider>
    </GraphiteStateContext.Provider>
  );
};
