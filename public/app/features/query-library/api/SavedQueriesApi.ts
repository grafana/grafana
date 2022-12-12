import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';

import { DataQuery } from '@grafana/data/src';

import { SavedQueryUpdateOpts } from '../components/QueryEditorDrawer';

import { getSavedQuerySrv } from './SavedQueriesSrv';

export type SavedQueryRef = {
  uid?: string;
};

export type Variable = {
  name: string;
  type?: string;
  current: {
    value: string | number;
  };
};

type SavedQueryMeta = {
  title: string;
  description?: string;
  tags?: string[];
  schemaVersion?: number;
  variables: Variable[];
};

type SavedQueryData<TQuery extends DataQuery = DataQuery> = {
  queries: TQuery[];
};

export type SavedQuery<TQuery extends DataQuery = DataQuery> = SavedQueryMeta & SavedQueryData<TQuery> & SavedQueryRef;

export const isQueryWithMixedDatasource = (savedQuery: SavedQuery): boolean => {
  if (!savedQuery?.queries?.length) {
    return false;
  }

  const firstDs = savedQuery.queries[0].datasource;
  return savedQuery.queries.some((q) => q.datasource?.uid !== firstDs?.uid || q.datasource?.type !== firstDs?.type);
};

const api = createApi({
  reducerPath: 'savedQueries',
  baseQuery: fetchBaseQuery({ baseUrl: '/' }),
  endpoints: (build) => ({
    getSavedQueryByUids: build.query<SavedQuery[] | null, SavedQueryRef[]>({
      async queryFn(arg, queryApi, extraOptions, baseQuery) {
        return { data: await getSavedQuerySrv().getSavedQueries(arg) };
      },
    }),
    deleteSavedQuery: build.mutation<null, SavedQueryRef>({
      async queryFn(arg) {
        await getSavedQuerySrv().deleteSavedQuery(arg);
        return {
          data: null,
        };
      },
    }),
    updateSavedQuery: build.mutation<null, { query: SavedQuery; opts: SavedQueryUpdateOpts }>({
      async queryFn(arg) {
        await getSavedQuerySrv().updateSavedQuery(arg.query, arg.opts);
        return {
          data: null,
        };
      },
    }),
  }),
});

export const { useUpdateSavedQueryMutation } = api;
