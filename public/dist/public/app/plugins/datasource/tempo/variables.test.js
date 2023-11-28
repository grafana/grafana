import { __awaiter } from "tslib";
import { lastValueFrom } from 'rxjs';
import { createMetadataRequest, createTempoDatasource } from './mocks';
import { TempoVariableSupport } from './variables';
describe('TempoVariableSupport', () => {
    let TempoVariableSupportMock;
    beforeEach(() => {
        const datasource = createTempoDatasource();
        jest.spyOn(datasource, 'metadataRequest').mockImplementation(createMetadataRequest({
            data: {
                tagNames: ['label1', 'label2'],
                scopes: [{ name: 'span', tags: ['label1', 'label2'] }],
            },
        }));
        TempoVariableSupportMock = new TempoVariableSupport(datasource);
    });
    it('should return label names for Tempo', () => __awaiter(void 0, void 0, void 0, function* () {
        const response = TempoVariableSupportMock.query({
            app: 'undefined',
            startTime: 0,
            requestId: '1',
            interval: 'undefined',
            scopedVars: {},
            timezone: 'undefined',
            type: 0,
            maxDataPoints: 10,
            intervalMs: 5000,
            targets: [
                {
                    refId: 'A',
                    datasource: { uid: 'GRAFANA_DATASOURCE_NAME', type: 'sample' },
                    type: 0,
                },
            ],
            panelId: 1,
            publicDashboardAccessToken: '',
            range: { from: new Date().toLocaleString(), to: new Date().toLocaleString() },
        });
        const data = (yield lastValueFrom(response)).data;
        expect(data).toEqual([{ text: 'label1' }, { text: 'label2' }]);
    }));
});
//# sourceMappingURL=variables.test.js.map