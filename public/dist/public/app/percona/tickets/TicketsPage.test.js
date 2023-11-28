import { __awaiter } from "tslib";
import { render, screen } from '@testing-library/react';
import React from 'react';
import { Provider } from 'react-redux';
import { configureStore } from 'app/store/configureStore';
import TicketsPage from './TicketsPage';
describe('TicketsPage', () => {
    it('renders wrapper', () => __awaiter(void 0, void 0, void 0, function* () {
        render(React.createElement(Provider, { store: configureStore({
                percona: {
                    user: { isAuthorized: true },
                    settings: { loading: false, result: { isConnectedToPortal: true } },
                },
            }) },
            React.createElement(TicketsPage, null)));
        expect(screen.getByTestId('page-wrapper-tickets')).toBeInTheDocument();
    }));
});
//# sourceMappingURL=TicketsPage.test.js.map