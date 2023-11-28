import { __awaiter } from "tslib";
import { renderHook, waitFor } from '@testing-library/react';
import { createMemoryHistory } from 'history';
import { stringify } from 'querystring';
import React from 'react';
import { TestProvider } from 'test/helpers/TestProvider';
import { getGrafanaContextMock } from 'test/mocks/getGrafanaContextMock';
import { HistoryWrapper } from '@grafana/runtime';
import { useTimeSrvFix } from './useTimeSrvFix';
describe('useTimeSrvFix', () => {
    it('removes `from` and `to` parameters from url when first mounted', () => __awaiter(void 0, void 0, void 0, function* () {
        const history = createMemoryHistory({
            initialEntries: [{ pathname: '/explore', search: stringify({ from: '1', to: '2' }) }],
        });
        const location = new HistoryWrapper(history);
        const context = getGrafanaContextMock();
        renderHook(() => useTimeSrvFix(), {
            wrapper: ({ children }) => (React.createElement(TestProvider, { grafanaContext: Object.assign(Object.assign({}, context), { location }) }, children)),
        });
        yield waitFor(() => {
            expect(location.getSearchObject()).toEqual(expect.not.objectContaining({ from: '1', to: '2' }));
        });
    }));
});
//# sourceMappingURL=useTimeSrvFix.test.js.map