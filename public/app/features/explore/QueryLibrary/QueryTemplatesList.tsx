import { uniq } from 'lodash';
import React, { useEffect, useState } from 'react';

import { EmptyState, Spinner } from '@grafana/ui';
import { backendSrv } from 'app/core/services/backend_srv';
import { useAllQueryTemplatesQuery } from 'app/features/query-library';
import { User } from 'app/features/query-library/api/types';
import { QueryTemplate } from 'app/features/query-library/types';

import { getDatasourceSrv } from '../../plugins/datasource_srv';

import QueryTemplatesTable from './QueryTemplatesTable';
import { QueryTemplateRow } from './QueryTemplatesTable/types';

const getQueryTemplateRows = async (data: QueryTemplate[]): Promise<QueryTemplateRow[]> => {
  const userQtList = uniq(data.map((qt) => qt.user).filter((user): user is User => !!user));

  const userData = Promise.all(
    userQtList.map((user) => {
      if (user.userId) {
        return backendSrv.get(`api/users/${user.userId}`);
      } else if (user.login) {
        return backendSrv.get(`api/users/lookup/${user.login}`);
      } else {
        // should never happen
        return Promise.resolve();
      }
    })
  );

  return userData.then((ud) => {
    return data.map((queryTemplate: QueryTemplate, index: number) => {
      const datasourceRef = queryTemplate.targets[0]?.datasource;
      const datasourceType = getDatasourceSrv().getInstanceSettings(datasourceRef)?.meta.name || '';

      const user =
        queryTemplate.user?.userId !== undefined
          ? ud.find((user) => user.id === queryTemplate.user?.userId)
          : ud.find((user) => user.login === queryTemplate.user?.login);

      return {
        index: index.toString(),
        datasourceRef,
        datasourceType,
        createdAtTimestamp: queryTemplate?.createdAtTimestamp || 0,
        query: queryTemplate.targets[0],
        description: queryTemplate.title,
        user: user,
      };
    });
  });
};

export function QueryTemplatesList() {
  const { data, isLoading, error } = useAllQueryTemplatesQuery();
  const [queryTemplateData, setQueryTemplateData] = useState<QueryTemplateRow[]>([]);

  useEffect(() => {
    const setQTData = async () => {
      const queryTemplateData = await getQueryTemplateRows(data!);
      setQueryTemplateData(queryTemplateData);
    };

    if (isLoading === false && data !== undefined) {
      setQTData();
    }
  }, [data, isLoading]);

  if (error) {
    return (
      <EmptyState variant="not-found" message={`Something went wrong`}>
        {error.message}
      </EmptyState>
    );
  }

  if (isLoading) {
    return <Spinner />;
  }

  if (!data || data.length === 0) {
    return (
      <EmptyState message={`Query Library`} variant="not-found">
        <p>
          {
            "You haven't saved any queries to your library yet. Start adding them from Explore or your Query History tab."
          }
        </p>
      </EmptyState>
    );
  }

  return <QueryTemplatesTable queryTemplateRows={queryTemplateData} />;
}
