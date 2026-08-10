import { getDataSourceInstanceSettings } from '@grafana/runtime/unstable';
import { type RichHistoryQuery } from 'app/types/explore';

import { type RichHistoryLocalStorageDTO } from './RichHistoryLocalStorage';

export const fromDTO = async (dto: RichHistoryLocalStorageDTO): Promise<RichHistoryQuery> => {
  const datasource = await getDataSourceInstanceSettings(dto.datasourceName);
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

export const toDTO = async (richHistoryQuery: RichHistoryQuery): Promise<RichHistoryLocalStorageDTO> => {
  const datasource = await getDataSourceInstanceSettings({ uid: richHistoryQuery.datasourceUid });

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
