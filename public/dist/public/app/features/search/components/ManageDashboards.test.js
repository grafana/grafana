import { __awaiter } from "tslib";
import { render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { contextSrv } from 'app/core/services/context_srv';
import ManageDashboardsNew from './ManageDashboardsNew';
jest.mock('app/core/services/context_srv', () => {
    const originMock = jest.requireActual('app/core/services/context_srv');
    return Object.assign(Object.assign({}, originMock), { contextSrv: Object.assign(Object.assign({}, originMock.context_srv), { user: {}, hasPermission: jest.fn(() => false) }) });
});
const setup = (options) => __awaiter(void 0, void 0, void 0, function* () {
    const { folder = {} } = options || {};
    const { rerender } = yield waitFor(() => render(React.createElement(ManageDashboardsNew, { folder: folder })));
    return { rerender };
});
jest.spyOn(console, 'error').mockImplementation();
describe('ManageDashboards', () => {
    beforeEach(() => {
        contextSrv.hasPermission.mockClear();
    });
    it("should hide and show dashboard actions based on user's permissions", () => __awaiter(void 0, void 0, void 0, function* () {
        contextSrv.hasPermission.mockReturnValue(false);
        const { rerender } = yield setup();
        expect(screen.queryByRole('button', { name: /new/i })).not.toBeInTheDocument();
        contextSrv.hasPermission.mockReturnValue(true);
        yield waitFor(() => rerender(React.createElement(ManageDashboardsNew, { folder: { canEdit: true } })));
        expect(screen.getByRole('button', { name: /new/i })).toBeInTheDocument();
    }));
});
//# sourceMappingURL=ManageDashboards.test.js.map