import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';

import { DataQuery, DataSourceRef } from '@grafana/data/src';

import { getGrafanaStorage } from '../../storage/storage';
import { WorkflowID } from '../../storage/types';

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
        const storage = getGrafanaStorage();
        return { data: await Promise.all(arg.map((ref) => storage.get<SavedQuery>(ref.uid))) };
      },
    }),
    deleteSavedQuery: build.mutation<null, SavedQueryRef>({
      async queryFn(arg) {
        await getGrafanaStorage().delete({ isFolder: false, path: arg.uid });
        return {
          data: null,
        };
      },
    }),
    updateSavedQuery: build.mutation<null, SavedQuery>({
      async queryFn(arg) {
        const path = `system/queries/${arg.title}.json`;
        await getGrafanaStorage().write(path, {
          kind: 'query',
          body: arg,
          title: arg.title,
          workflow: WorkflowID.Save,
        });
        return {
          data: null,
        };
      },
    }),
  }),
});

export const { useUpdateSavedQueryMutation } = api;
