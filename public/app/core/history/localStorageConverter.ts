import { getDataSourceSrv } from '@grafana/runtime';

import { RichHistoryQuery } from '../../types';

import { RichHistoryLocalStorageDTO } from './RichHistoryLocalStorage';

export const fromDTO = (dto: RichHistoryLocalStorageDTO): RichHistoryQuery => {
  const datasource = getDataSourceSrv().getInstanceSettings(dto.datasourceName);
  return {
    id: dto.ts.toString(),
    createdAt: dto.ts,
    datasourceName: dto.datasourceName,
    datasourceUid: datasource?.uid || '', // will be show on the list as coming from a removed data source
    starred: dto.starred,
    comment: dto.comment,
    queries: dto.queries,
  };
};

export const toDTO = (richHistoryQuery: RichHistoryQuery): RichHistoryLocalStorageDTO => {
  const datasource = getDataSourceSrv().getInstanceSettings({ uid: richHistoryQuery.datasourceUid });

  if (!datasource) {
    throw new Error('Datasource not found.');
  }

  return {
    ts: richHistoryQuery.createdAt,
    datasourceName: richHistoryQuery.datasourceName,
    starred: richHistoryQuery.starred,
    comment: richHistoryQuery.comment,
    queries: richHistoryQuery.queries,
  };
};
