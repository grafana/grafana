import { __awaiter } from "tslib";
import { renderHook, waitFor } from '@testing-library/react';
import { TestProvider } from 'test/helpers/TestProvider';
import setupGrafanaManagedServer from './__mocks__/grafanaManagedServer';
import { useContactPointsWithStatus } from './useContactPoints';
describe('useContactPoints', () => {
    setupGrafanaManagedServer();
    it('should return contact points with status', () => __awaiter(void 0, void 0, void 0, function* () {
        const { result } = renderHook(() => useContactPointsWithStatus('grafana'), {
            wrapper: TestProvider,
        });
        yield waitFor(() => {
            expect(result.current.isLoading).toBe(false);
            expect(result.current).toMatchSnapshot();
        });
    }));
});
//# sourceMappingURL=useContactPoints.test.js.map