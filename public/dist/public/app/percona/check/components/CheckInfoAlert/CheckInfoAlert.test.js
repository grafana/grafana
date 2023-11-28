import { __awaiter } from "tslib";
import { render, screen } from '@testing-library/react';
import React from 'react';
import { Provider } from 'react-redux';
import { configureStore } from 'app/store/configureStore';
import { ChecksInfoAlert } from './CheckInfoAlert';
import { Messages } from './CheckInfoAlert.messages';
describe('CheckInfoAlert', () => {
    it('should only show alert when PMM is not connected to portal', () => __awaiter(void 0, void 0, void 0, function* () {
        render(React.createElement(Provider, { store: configureStore({
                percona: {
                    user: { isAuthorized: true },
                    settings: { loading: false, result: { isConnectedToPortal: false } },
                },
            }) },
            React.createElement(ChecksInfoAlert, null)));
        expect(screen.getByText(Messages.title)).toBeInTheDocument();
    }));
    it('should not show alert when PMM is connected to portal', () => __awaiter(void 0, void 0, void 0, function* () {
        render(React.createElement(Provider, { store: configureStore({
                percona: {
                    user: { isAuthorized: true },
                    settings: { loading: false, result: { isConnectedToPortal: true } },
                },
            }) },
            React.createElement(ChecksInfoAlert, null)));
        expect(screen.queryByText(Messages.title)).not.toBeInTheDocument();
    }));
});
//# sourceMappingURL=CheckInfoAlert.test.js.map