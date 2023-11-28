import { DatasourceSrv } from 'app/features/plugins/datasource_srv';
import { backendSrv } from '../services/backend_srv';
import { fromDTO, toDTO } from './localStorageConverter';
const dsMock = new DatasourceSrv();
dsMock.init({
    // @ts-ignore
    'name-of-dev-test': { uid: 'dev-test', name: 'name-of-dev-test' },
}, '');
jest.mock('@grafana/runtime', () => (Object.assign(Object.assign({}, jest.requireActual('@grafana/runtime')), { getBackendSrv: () => backendSrv, getDataSourceSrv: () => dsMock })));
const validRichHistory = {
    comment: 'comment',
    createdAt: 1,
    datasourceName: 'name-of-dev-test',
    datasourceUid: 'dev-test',
    id: '1',
    queries: [{ refId: 'A' }],
    starred: true,
};
const validDTO = {
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
        const invalidRichHistory = Object.assign(Object.assign({}, validRichHistory), { datasourceUid: 'invalid' });
        expect(() => {
            toDTO(invalidRichHistory);
        }).toThrow();
    });
    it('converts DTO to RichHistoryQuery', () => {
        expect(fromDTO(validDTO)).toMatchObject(validRichHistory);
    });
    it('uses empty uid when datasource does not exist for a DTO to fail gracefully for queries from removed datasources', () => {
        const invalidDto = Object.assign(Object.assign({}, validDTO), { datasourceName: 'removed' });
        expect(fromDTO(invalidDto)).toMatchObject(Object.assign(Object.assign({}, validRichHistory), { datasourceName: 'removed', datasourceUid: '' }));
    });
});
//# sourceMappingURL=localStorageConverter.test.js.map