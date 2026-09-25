import { type RichHistoryQuery } from 'app/types/explore';

import { type RichHistoryLocalStorageDTO } from './RichHistoryLocalStorage';
import { fromDTO, toDTO } from './localStorageConverter';

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
  createdAt: 1,
  datasourceName: 'name-of-dev-test',
  datasourceUid: 'dev-test',
  id: '1',
  queries: [{ refId: 'A' }],
  starred: true,
};

const validDTO: RichHistoryLocalStorageDTO = {
  comment: 'comment',
  datasourceName: 'name-of-dev-test',
  queries: [{ refId: 'A' }],
  starred: true,
  ts: 1,
};

describe('LocalStorage converted', () => {
  it('converts RichHistoryQuery to local storage DTO', async () => {
    expect(await toDTO(validRichHistory)).toMatchObject(validDTO);
  });

  it('throws an error when data source for RichHistory does not exist to avoid saving invalid items', async () => {
    const invalidRichHistory = { ...validRichHistory, datasourceUid: 'invalid' };
    await expect(toDTO(invalidRichHistory)).rejects.toThrow();
  });

  it('converts DTO to RichHistoryQuery', async () => {
    expect(await fromDTO(validDTO)).toMatchObject(validRichHistory);
  });

  it('uses empty uid when datasource does not exist for a DTO to fail gracefully for queries from removed datasources', async () => {
    const invalidDto = { ...validDTO, datasourceName: 'removed' };
    expect(await fromDTO(invalidDto)).toMatchObject({
      ...validRichHistory,
      datasourceName: 'removed',
      datasourceUid: '',
    });
  });
});
