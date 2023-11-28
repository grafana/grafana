import { __awaiter } from "tslib";
import { render, screen } from '@testing-library/react';
import React from 'react';
import { Provider } from 'react-redux';
import { configureStore } from 'app/store/configureStore';
import { ScheduledBackups } from './ScheduledBackups';
jest.mock('./ScheduledBackups.service');
jest.mock('app/percona/backup/components/StorageLocations/StorageLocations.service');
describe('ScheduledBackups', () => {
    it('should send correct data to Table', () => __awaiter(void 0, void 0, void 0, function* () {
        render(React.createElement(Provider, { store: configureStore({
                percona: {
                    user: { isAuthorized: true, isPlatformUser: false },
                    settings: { result: { backupEnabled: true, isConnectedToPortal: false } },
                },
            }) },
            React.createElement(ScheduledBackups, null)));
        yield screen.findByText('Backup 1');
        expect(screen.getByText('Location 1 (S3)')).toBeTruthy();
        expect(screen.getByText('Location 2 (Local Client)')).toBeTruthy();
    }));
});
//# sourceMappingURL=ScheduledBackups.test.js.map