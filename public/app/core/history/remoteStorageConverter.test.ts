import { RichHistoryQuery } from '../../types';
import { backendSrv } from '../services/backend_srv';

import { RichHistoryRemoteStorageDTO } from './RichHistoryRemoteStorage';
import { fromDTO } from './remoteStorageConverter';

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  getBackendSrv: () => backendSrv,
  getDataSourceSrv: () => {
    return {
      getInstanceSettings: () => {
        return { uid: 'uid', name: 'dev-test' };
      },
    };
  },
}));

const validRichHistory: RichHistoryQuery = {
  comment: 'comment',
  createdAt: 1,
  datasourceName: 'dev-test',
  datasourceUid: 'uid',
  id: 'ID',
  queries: [{ refId: 'A' }],
  starred: true,
};

const validDTO: RichHistoryRemoteStorageDTO = {
  comment: 'comment',
  datasourceUid: 'uid',
  queries: [{ refId: 'A' }],
  starred: true,
  uid: 'ID',
  createdAt: 1,
};

describe('RemoteStorage converter', () => {
  it('converts DTO to RichHistoryQuery', () => {
    expect(fromDTO(validDTO)).toMatchObject(validRichHistory);
  });
});
