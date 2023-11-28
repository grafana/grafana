import { __awaiter } from "tslib";
import { render, screen } from '@testing-library/react';
import React from 'react';
import { ServerStats } from './ServerStats';
const stats = {
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
jest.mock('./state/apis', () => ({
    getServerStats: () => __awaiter(void 0, void 0, void 0, function* () { return stats; }),
}));
jest.mock('../../core/services/context_srv', () => ({
    contextSrv: {
        hasPermission: () => true,
    },
}));
describe('ServerStats', () => {
    it('Should render page with stats', () => __awaiter(void 0, void 0, void 0, function* () {
        render(React.createElement(ServerStats, null));
        expect(yield screen.findByRole('heading', { name: /instance statistics/i })).toBeInTheDocument();
        expect(screen.getByText('Dashboards (starred)')).toBeInTheDocument();
        expect(screen.getByText('Tags')).toBeInTheDocument();
        expect(screen.getByText('Playlists')).toBeInTheDocument();
        expect(screen.getByText('Snapshots')).toBeInTheDocument();
        expect(screen.getByRole('link', { name: 'Manage dashboards' })).toBeInTheDocument();
        expect(screen.getByRole('link', { name: 'Manage data sources' })).toBeInTheDocument();
        expect(screen.getByRole('link', { name: 'Alerts' })).toBeInTheDocument();
        expect(screen.getByRole('link', { name: 'Manage users' })).toBeInTheDocument();
    }));
});
//# sourceMappingURL=ServerStats.test.js.map