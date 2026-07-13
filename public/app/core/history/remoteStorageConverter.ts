import { getDataSourceInstanceSettings } from '@grafana/runtime/unstable';
import { type RichHistoryQuery } from 'app/types/explore';

import { type RichHistoryRemoteStorageDTO } from './RichHistoryRemoteStorage';

export const fromDTO = async (dto: RichHistoryRemoteStorageDTO): Promise<RichHistoryQuery> => {
  const datasource = await getDataSourceInstanceSettings({ uid: dto.datasourceUid });

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

export const toDTO = (richHistory: RichHistoryQuery): RichHistoryRemoteStorageDTO => {
  return {
    uid: richHistory.id,
    createdAt: Math.floor(richHistory.createdAt / 1000),
    datasourceUid: richHistory.datasourceUid,
    starred: richHistory.starred,
    comment: richHistory.comment,
    queries: richHistory.queries,
  };
};
