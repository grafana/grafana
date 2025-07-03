import { RichHistoryQuery } from 'app/types/explore';

import { DatasourceSrv } from '../../features/plugins/datasource_srv';
import { backendSrv } from '../services/backend_srv';

import { RichHistoryRemoteStorageDTO } from './RichHistoryRemoteStorage';
import { fromDTO, toDTO } from './remoteStorageConverter';

const dsMock = new DatasourceSrv();
dsMock.init(
  {
    // @ts-ignore
    'name-of-dev-test': { uid: 'dev-test', name: 'name-of-dev-test' },
  },
  ''
);

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  getBackendSrv: () => backendSrv,
  getDataSourceSrv: () => dsMock,
}));

const validRichHistory: RichHistoryQuery = {
  comment: 'comment',
  createdAt: 1000,
  datasourceName: 'name-of-dev-test',
  datasourceUid: 'dev-test',
  id: 'ID',
  queries: [{ refId: 'A' }],
  starred: true,
};

const validDTO: RichHistoryRemoteStorageDTO = {
  comment: 'comment',
  datasourceUid: 'dev-test',
  queries: [{ refId: 'A' }],
  starred: true,
  uid: 'ID',
  createdAt: 1,
};

describe('RemoteStorage converter', () => {
  it('converts DTO to RichHistoryQuery', () => {
    expect(fromDTO(validDTO)).toMatchObject(validRichHistory);
  });
  it('convert RichHistoryQuery to DTO', () => {
    expect(toDTO(validRichHistory)).toMatchObject(validDTO);
  });
});
