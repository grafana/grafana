import { type RichHistoryQuery } from 'app/types/explore';

import { type RichHistoryRemoteStorageDTO } from './RichHistoryRemoteStorage';
import { fromDTO, toDTO } from './remoteStorageConverter';

const devTest = { uid: 'dev-test', name: 'name-of-dev-test' };

jest.mock('@grafana/runtime/unstable', () => ({
  ...jest.requireActual('@grafana/runtime/unstable'),
  getDataSourceInstanceSettings: (nameOrUid: string | { uid: string }) => {
    if (typeof nameOrUid === 'string') {
      return Promise.resolve(nameOrUid === devTest.name ? devTest : undefined);
    }
    return Promise.resolve(nameOrUid.uid === devTest.uid ? devTest : undefined);
  },
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
  it('converts DTO to RichHistoryQuery', async () => {
    expect(await fromDTO(validDTO)).toMatchObject(validRichHistory);
  });
  it('convert RichHistoryQuery to DTO', () => {
    expect(toDTO(validRichHistory)).toMatchObject(validDTO);
  });
});
