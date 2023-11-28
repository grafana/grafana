import { __awaiter } from "tslib";
import { of } from 'rxjs';
import { getBackendSrv } from 'app/core/services/backend_srv';
import { getDataSourceByIdOrUid } from './api';
jest.mock('app/core/services/backend_srv');
jest.mock('@grafana/runtime', () => (Object.assign(Object.assign({}, jest.requireActual('@grafana/runtime')), { getBackendSrv: jest.fn() })));
const mockResponse = (response) => {
    getBackendSrv.mockReturnValueOnce({
        fetch: (options) => {
            return of(response);
        },
    });
};
describe('Datasources / API', () => {
    describe('getDataSourceByIdOrUid()', () => {
        it('should resolve to the datasource object in case it is fetched using a UID', () => __awaiter(void 0, void 0, void 0, function* () {
            const response = {
                ok: true,
                data: {
                    id: 111,
                    uid: 'abcdefg',
                },
            };
            mockResponse(response);
            expect(yield getDataSourceByIdOrUid(response.data.uid)).toBe(response.data);
        }));
    });
});
//# sourceMappingURL=api.test.js.map