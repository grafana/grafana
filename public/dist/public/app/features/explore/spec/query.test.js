import { __awaiter } from "tslib";
import { screen } from '@testing-library/react';
import { EventBusSrv, serializeStateToUrlParam } from '@grafana/data';
import { makeLogsQueryResponse } from './helper/query';
import { setupExplore, tearDown, waitForExplore } from './helper/setup';
const testEventBus = new EventBusSrv();
jest.mock('@grafana/runtime', () => (Object.assign(Object.assign({}, jest.requireActual('@grafana/runtime')), { getAppEvents: () => testEventBus })));
describe('Explore: handle running/not running query', () => {
    afterEach(() => {
        tearDown();
    });
    it('inits and renders editor but does not call query on empty initial state', () => __awaiter(void 0, void 0, void 0, function* () {
        const { datasources } = setupExplore();
        yield waitForExplore();
        expect(datasources.loki.query).not.toBeCalled();
    }));
    it('runs query when initial state contains query and renders results', () => __awaiter(void 0, void 0, void 0, function* () {
        const urlParams = {
            left: serializeStateToUrlParam({
                datasource: 'loki-uid',
                queries: [{ refId: 'A', expr: '{ label="value"}', datasource: { type: 'logs', uid: 'loki-uid' } }],
                range: { from: 'now-1h', to: 'now' },
            }),
        };
        const { datasources } = setupExplore({ urlParams });
        jest.mocked(datasources.loki.query).mockReturnValueOnce(makeLogsQueryResponse());
        // Make sure we render the logs panel
        yield screen.findByText(/^Logs$/);
        // Make sure we render the log line
        yield screen.findByText(/custom log line/i);
        // And that the editor gets the expr from the url
        yield screen.findByText(`loki Editor input: { label="value"}`);
        // We called the data source query method once
        expect(datasources.loki.query).toBeCalledTimes(1);
        expect(jest.mocked(datasources.loki.query).mock.calls[0][0]).toMatchObject({
            targets: [{ expr: '{ label="value"}' }],
        });
    }));
});
//# sourceMappingURL=query.test.js.map