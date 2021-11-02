import { __awaiter, __generator } from "tslib";
import React from 'react';
import { render, screen } from '@testing-library/react';
import { ServerStats } from './ServerStats';
var stats = {
    activeAdmins: 1,
    activeEditors: 0,
    activeSessions: 1,
    activeUsers: 1,
    activeViewers: 0,
    admins: 1,
    alerts: 5,
    dashboards: 1599,
    datasources: 54,
    editors: 2,
    orgs: 1,
    playlists: 1,
    snapshots: 1,
    stars: 3,
    tags: 42,
    users: 5,
    viewers: 2,
};
jest.mock('./state/apis', function () { return ({
    getServerStats: function () { return __awaiter(void 0, void 0, void 0, function () { return __generator(this, function (_a) {
        return [2 /*return*/, stats];
    }); }); },
}); });
jest.mock('../../core/services/context_srv', function () { return ({
    contextSrv: {
        hasAccess: function () { return true; },
    },
}); });
describe('ServerStats', function () {
    it('Should render page with stats', function () { return __awaiter(void 0, void 0, void 0, function () {
        var _a;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    render(React.createElement(ServerStats, null));
                    _a = expect;
                    return [4 /*yield*/, screen.findByRole('heading', { name: /instance statistics/i })];
                case 1:
                    _a.apply(void 0, [_b.sent()]).toBeInTheDocument();
                    expect(screen.getByText('Dashboards (starred)')).toBeInTheDocument();
                    expect(screen.getByText('Tags')).toBeInTheDocument();
                    expect(screen.getByText('Playlists')).toBeInTheDocument();
                    expect(screen.getByText('Snapshots')).toBeInTheDocument();
                    expect(screen.getByRole('link', { name: 'Manage dashboards' })).toBeInTheDocument();
                    return [2 /*return*/];
            }
        });
    }); });
});
//# sourceMappingURL=ServerStats.test.js.map