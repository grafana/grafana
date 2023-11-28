import { __awaiter } from "tslib";
import { render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { SettingsService } from 'app/percona/settings/Settings.service';
import { CheckPermissions } from './CheckPermissions';
jest.mock('app/percona/settings/Settings.service');
jest.mock('app/percona/shared/helpers/logger', () => {
    const originalModule = jest.requireActual('app/percona/shared/helpers/logger');
    return Object.assign(Object.assign({}, originalModule), { logger: {
            error: jest.fn(),
        } });
});
describe('CheckPermissions::', () => {
    it('should render children', () => __awaiter(void 0, void 0, void 0, function* () {
        const { container } = yield waitFor(() => render(React.createElement(CheckPermissions, null,
            React.createElement("div", null, "Test"))));
        expect(container.querySelector('div')).toHaveTextContent('Test');
    }));
    it('should render unauthorized message', () => __awaiter(void 0, void 0, void 0, function* () {
        const errorObj = { response: { status: 401 } };
        jest.spyOn(SettingsService, 'getSettings').mockImplementationOnce(() => {
            throw errorObj;
        });
        yield waitFor(() => render(React.createElement(CheckPermissions, null,
            React.createElement("div", null, "Test"))));
        expect(screen.getByTestId('unauthorized')).not.toBeNull();
    }));
});
//# sourceMappingURL=CheckPermissions.test.js.map