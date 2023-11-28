import { __awaiter } from "tslib";
import { screen, waitFor } from '@testing-library/react';
import { EventBusSrv } from '@grafana/data';
import { changeDatasource } from './helper/interactions';
import { makeLogsQueryResponse } from './helper/query';
import { setupExplore, tearDown, waitForExplore } from './helper/setup';
const testEventBus = new EventBusSrv();
jest.mock('@grafana/runtime', () => (Object.assign(Object.assign({}, jest.requireActual('@grafana/runtime')), { getAppEvents: () => testEventBus })));
jest.mock('app/core/core', () => ({
    contextSrv: {
        hasPermission: () => true,
        getValidIntervals: (defaultIntervals) => defaultIntervals,
    },
}));
describe('Explore: handle datasource states', () => {
    afterEach(() => {
        tearDown();
    });
    it('shows warning if there are no data sources', () => __awaiter(void 0, void 0, void 0, function* () {
        setupExplore({ datasources: [] });
        yield waitFor(() => screen.getByText(/Explore requires at least one data source/i));
    }));
    it('handles datasource changes', () => __awaiter(void 0, void 0, void 0, function* () {
        const urlParams = { left: JSON.stringify(['now-1h', 'now', 'loki', { expr: '{ label="value"}', refId: 'A' }]) };
        const { datasources } = setupExplore({ urlParams });
        jest.mocked(datasources.loki.query).mockReturnValueOnce(makeLogsQueryResponse());
        yield waitForExplore();
        yield changeDatasource('elastic');
        yield screen.findByText('elastic Editor input:');
        expect(datasources.elastic.query).not.toBeCalled();
    }));
});
//# sourceMappingURL=datasourceState.test.js.map