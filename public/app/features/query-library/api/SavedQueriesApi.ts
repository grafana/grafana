import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';

import { DataQuery, DataSourceRef } from '@grafana/data/src';

import { getSavedQuerySrv } from './SavedQueriesSrv';

export type SavedQueryRef = {
  uid: string;
};

type SavedQueryMeta = {
  title: string;
  description: string;
  tags: string[];
  schemaVersion: number;
};

type DataQueryWithRequiredDatasource = DataQuery & {
  datasource: DataSourceRef;
};

type SavedQueryData<TQuery extends DataQueryWithRequiredDatasource = DataQueryWithRequiredDatasource> = {
  queries: TQuery[];
};

export type SavedQuery<TQuery extends DataQueryWithRequiredDatasource = DataQueryWithRequiredDatasource> =
  SavedQueryMeta & SavedQueryData<TQuery> & SavedQueryRef;

export const isQueryWithMixedDatasource = (savedQuery: SavedQuery): boolean => {
  if (!savedQuery?.queries?.length) {
    return false;
  }

  const firstDs = savedQuery.queries[0].datasource;
  return savedQuery.queries.some((q) => q.datasource.uid !== firstDs.uid || q.datasource.type !== firstDs.type);
};

const api = createApi({
  reducerPath: 'savedQueries',
  baseQuery: fetchBaseQuery({ baseUrl: '/' }),
  endpoints: (build) => ({
    getSavedQueryByUids: build.query<SavedQuery[] | null, SavedQueryRef[]>({
      async queryFn(arg, queryApi, extraOptions, baseQuery) {
        return { data: await getSavedQuerySrv().getSavedQueryByUids(arg) };
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
    updateSavedQuery: build.mutation<null, SavedQuery>({
      async queryFn(arg) {
        await getSavedQuerySrv().updateSavedQuery(arg);
        return {
          data: null,
        };
      },
    }),
  }),
});

export const { useUpdateSavedQueryMutation } = api;
