import { DatasourceSrv } from 'app/features/plugins/datasource_srv';

import { RichHistoryQuery } from '../../types';
import { backendSrv } from '../services/backend_srv';

import { RichHistoryLocalStorageDTO } from './RichHistoryLocalStorage';
import { fromDTO, toDTO } from './localStorageConverter';

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
  it('converts RichHistoryQuery to local storage DTO', () => {
    expect(toDTO(validRichHistory)).toMatchObject(validDTO);
  });

  it('throws an error when data source for RichHistory does not exist to avoid saving invalid items', () => {
    const invalidRichHistory = { ...validRichHistory, datasourceUid: 'invalid' };
    expect(() => {
      toDTO(invalidRichHistory);
    }).toThrow();
  });

  it('converts DTO to RichHistoryQuery', () => {
    expect(fromDTO(validDTO)).toMatchObject(validRichHistory);
  });

  it('uses empty uid when datasource does not exist for a DTO to fail gracefully for queries from removed datasources', () => {
    const invalidDto = { ...validDTO, datasourceName: 'removed' };
    expect(fromDTO(invalidDto)).toMatchObject({
      ...validRichHistory,
      datasourceName: 'removed',
      datasourceUid: '',
    });
  });
});
