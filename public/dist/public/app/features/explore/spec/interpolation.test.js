import { __awaiter } from "tslib";
import React from 'react';
import { EventBusSrv, serializeStateToUrlParam } from '@grafana/data';
import { getTemplateSrv } from '@grafana/runtime';
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
jest.mock('react-virtualized-auto-sizer', () => {
    return {
        __esModule: true,
        default(props) {
            return React.createElement("div", null, props.children({ width: 1000 }));
        },
    };
});
describe('Explore: interpolation', () => {
    afterEach(() => {
        tearDown();
    });
    // support-escalations/issues/1459
    it('Time is interpolated when explore is opened with a URL', () => __awaiter(void 0, void 0, void 0, function* () {
        const urlParams = {
            left: serializeStateToUrlParam({
                datasource: 'loki',
                queries: [{ refId: 'A', expr: '{ job="a", from="${__from}", to="${__to}" }' }],
                range: { from: '1600000000000', to: '1700000000000' },
            }),
            right: serializeStateToUrlParam({
                datasource: 'loki',
                queries: [{ refId: 'b', expr: '{ job="b", from="${__from}", to="${__to}" }' }],
                range: { from: '1800000000000', to: '1900000000000' },
            }),
        };
        const { datasources } = setupExplore({ urlParams });
        const fakeFetch = jest.fn();
        datasources.loki.query.mockImplementation((request) => {
            fakeFetch(getTemplateSrv().replace(request.targets[0].expr));
            return makeLogsQueryResponse();
        });
        yield waitForExplore();
        expect(fakeFetch).toBeCalledTimes(2);
        expect(fakeFetch).toHaveBeenCalledWith('{ job="a", from="1600000000000", to="1700000000000" }');
        expect(fakeFetch).toHaveBeenCalledWith('{ job="b", from="1800000000000", to="1900000000000" }');
    }));
});
//# sourceMappingURL=interpolation.test.js.map