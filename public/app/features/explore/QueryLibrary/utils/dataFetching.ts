import { compact, uniq } from 'lodash';
import { useAsync } from 'react-use';
import { AsyncState } from 'react-use/lib/useAsync';

import { getDataSourceSrv } from '@grafana/runtime';
import { DataQuery, DataSourceRef } from '@grafana/schema';

import { createQueryText } from '../../../../core/utils/richHistory';
import { getDatasourceSrv } from '../../../plugins/datasource_srv';
import { UserDataQueryResponse } from '../../../query-library/api/types';
import { getUserInfo } from '../../../query-library/api/user';
import { QueryTemplate } from '../../../query-library/types';

export function useLoadUsers(userUIDs: string[] | undefined) {
  return useAsync(async () => {
    if (!userUIDs) {
      return undefined;
    }
    const userQtList = uniq(compact(userUIDs));
    const usersParam = userQtList.map((userUid) => `key=${encodeURIComponent(userUid)}`).join('&');
    return await getUserInfo(`?${usersParam}`);
  }, [userUIDs]);
}

// Explicitly type the result so TS knows to discriminate between the error result and good result by the error prop
// value.
type MetadataValue =
  | {
      index: string;
      uid: string;
      datasourceName: string;
      datasourceRef: DataSourceRef | undefined | null;
      datasourceType: string;
      createdAtTimestamp: number;
      query: DataQuery;
      queryText: string;
      description: string;
      user: {
        uid: string;
        displayName: string;
        avatarUrl: string;
      };
      error: undefined;
    }
  | {
      index: string;
      error: Error;
    };

/**
 * Map metadata to query templates we get from the DB.
 * @param queryTemplates
 * @param userDataList
 */
export function useLoadQueryMetadata(
  queryTemplates: QueryTemplate[] | undefined,
  userDataList: UserDataQueryResponse | undefined
): AsyncState<MetadataValue[]> {
  return useAsync(async () => {
    if (!(queryTemplates && userDataList)) {
      return [];
    }

    const rowsPromises = queryTemplates.map(
      async (queryTemplate: QueryTemplate, index: number): Promise<MetadataValue> => {
        try {
          const datasourceRef = queryTemplate.targets[0]?.datasource;
          const datasourceApi = await getDataSourceSrv().get(datasourceRef);
          const datasourceType = getDatasourceSrv().getInstanceSettings(datasourceRef)?.meta.name || '';
          const query = queryTemplate.targets[0];
          const queryText = createQueryText(query, datasourceApi);
          const datasourceName = datasourceApi?.name || '';
          const extendedUserData = userDataList.display.find(
            (user) => `${user?.identity.type}:${user?.identity.name}` === queryTemplate.user?.uid
          );

          return {
            index: index.toString(),
            uid: queryTemplate.uid,
            datasourceName,
            datasourceRef,
            datasourceType,
            createdAtTimestamp: queryTemplate?.createdAtTimestamp || 0,
            query,
            queryText,
            description: queryTemplate.title,
            user: {
              uid: queryTemplate.user?.uid || '',
              displayName: extendedUserData?.displayName || '',
              avatarUrl: extendedUserData?.avatarUrl || '',
            },
            error: undefined,
          };
        } catch (error) {
          // Instead of throwing we collect the errors in the result so upstream code can decide what to do.
          return {
            index: index.toString(),
            error: error instanceof Error ? error : new Error('unknown error ' + JSON.stringify(error)),
          };
        }
      }
    );

    return Promise.all(rowsPromises);
  }, [queryTemplates, userDataList]);
}
