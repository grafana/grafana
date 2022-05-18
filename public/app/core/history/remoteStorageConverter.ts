import { getDataSourceSrv } from '@grafana/runtime';

import { RichHistoryQuery } from '../../types';

import { RichHistoryRemoteStorageDTO } from './RichHistoryRemoteStorage';

export const fromDTO = (dto: RichHistoryRemoteStorageDTO): RichHistoryQuery => {
  const datasource = getDataSourceSrv().getInstanceSettings({ uid: dto.datasourceUid });

  return {
    id: dto.uid,
    createdAt: dto.createdAt * 1000,
    datasourceName: datasource?.name || '', // will be show on the list as coming from a removed data source
    datasourceUid: dto.datasourceUid,
    starred: dto.starred,
    comment: dto.comment,
    queries: dto.queries,
  };
};
