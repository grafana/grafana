import { createSelector } from '@reduxjs/toolkit';
import {
  ApiEndpointQuery,
  EndpointDefinitions,
  QueryActionCreatorResult,
  QueryDefinition,
} from '@reduxjs/toolkit/query';
import { useCallback, useRef } from 'react';

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

export function useMultipleQueries<
  Def extends QueryDefinition<any, any, any, any, any>,
  Defs extends EndpointDefinitions,
  Endpoint extends ApiEndpointQuery<Def, Defs>,
>(
  endpoint: Endpoint
): [
  Array<ReturnType<ReturnType<Endpoint['select']>>>,
  (args: Parameters<Endpoint['initiate']>[0]) => ReturnType<ReturnType<Endpoint['initiate']>>,
] {
  // ): [Array<QueryResultSelectorResult<Def>>, (args: QueryArgFrom<Def>) => QueryActionCreatorResult<Def>] {

  const dispatch = useDispatch();
  const requestsRef = useRef<Array<QueryActionCreatorResult<Def>>>([]);

  const queries = useSelector((rootState: RootState) => {
    return getAllQueriesSelector(rootState, endpoint, requestsRef.current);
  });

  const dispatchRequest = useCallback(
    (args: Parameters<Endpoint['initiate']>[0]) => {
      const queryRequestAction = endpoint.initiate(args);
      const queryRequest = dispatch(queryRequestAction);
      requestsRef.current.push(queryRequest);

      return queryRequest;
    },
    [dispatch, endpoint]
  );

  return [queries, dispatchRequest] as const;
}
