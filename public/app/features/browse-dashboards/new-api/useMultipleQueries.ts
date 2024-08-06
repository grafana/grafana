import { createSelector } from '@reduxjs/toolkit';
import {
  ApiEndpointQuery,
  EndpointDefinitions,
  QueryActionCreatorResult,
  QueryArgFrom,
  QueryDefinition,
  QueryResultSelectorResult,
} from '@reduxjs/toolkit/query';
import { useCallback, useEffect, useRef } from 'react';

import { RootState } from 'app/store/configureStore';
import { useDispatch, useSelector } from 'app/types/store';

const getAllQueriesSelector = createSelector(
  [
    /* first arg - state */
    (state: RootState) => state,

    /* second arg - endpoint */
    <
      Def extends QueryDefinition<any, any, any, any, any>,
      Defs extends EndpointDefinitions,
      Endpoint extends ApiEndpointQuery<Def, Defs>,
    >(
      state: RootState,
      endpoint: Endpoint
    ) => endpoint,

    /* third arg - requests */
    <
      Def extends QueryDefinition<any, any, any, any, any>,
      Defs extends EndpointDefinitions,
      Endpoint extends ApiEndpointQuery<Def, Defs>,
    >(
      state: RootState,
      endpoint: Endpoint,
      requests: Array<QueryActionCreatorResult<Def>>
    ) => requests,
  ],

  /* actual selector */
  <
    Def extends QueryDefinition<any, any, any, any, any>,
    Defs extends EndpointDefinitions,
    Endpoint extends ApiEndpointQuery<Def, Defs>,
  >(
    state: RootState,
    endpoint: Endpoint,
    requests: Array<QueryActionCreatorResult<Def>>
  ) => {
    const queryResults = requests.map((request) => {
      return endpoint.select(request.arg)(state);
    });

    return queryResults;
  }
);

interface ImmutableRefObject<T> {
  readonly current: T;
}

export function useMultipleQueries<
  Def extends QueryDefinition<any, any, any, any, any>,
  Defs extends EndpointDefinitions,
>(
  endpoint: ApiEndpointQuery<Def, Defs>
): [Array<QueryResultSelectorResult<Def>>, (args: QueryArgFrom<Def>) => QueryActionCreatorResult<Def>] {
  const dispatch = useDispatch();

  const requestsRef: ImmutableRefObject<Array<QueryActionCreatorResult<Def>>> = useRef([]);

  const queries = useSelector((rootState: RootState) => {
    return getAllQueriesSelector(rootState, endpoint, requestsRef.current);
  });

  const dispatchRequest = useCallback(
    (args: QueryArgFrom<Def>) => {
      const queryRequestAction = endpoint.initiate(args);
      const queryRequest = dispatch(queryRequestAction);
      requestsRef.current.push(queryRequest);

      return queryRequest;
    },
    [dispatch, endpoint]
  );

  // Unsubscribe from all requests when the component is unmounted
  useEffect(() => {
    const requests = requestsRef.current;
    return () => {
      for (const req of requests) {
        req.unsubscribe();
      }
    };
  }, []);

  return [queries, dispatchRequest] as const;
}
