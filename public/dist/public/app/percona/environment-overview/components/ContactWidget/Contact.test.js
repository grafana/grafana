import { __awaiter } from "tslib";
import { render, screen, waitForElementToBeRemoved } from '@testing-library/react';
import React from 'react';
import { Provider } from 'react-redux';
import { Router } from 'react-router-dom';
import { locationService } from '@grafana/runtime';
import { configureStore } from 'app/store/configureStore';
import Contact from './Contact';
import { ContactService } from './Contact.service';
const MockWrapper = ({ children }) => {
    return (React.createElement(Provider, { store: configureStore({
            percona: {
                user: { isAuthorized: true, isPlatformUser: true },
                settings: { result: { isConnectedToPortal: true } },
            },
        }) },
        React.createElement(Router, { history: locationService.getHistory() }, children)));
};
describe('Contact widget', () => {
    it('render contact when data were fetched successfully', () => __awaiter(void 0, void 0, void 0, function* () {
        jest.spyOn(ContactService, 'getContact').mockImplementationOnce((undefined) => {
            return Promise.resolve({
                name: 'Test name',
                email: 'test@test.com',
                newTicketUrl: 'test.url',
            });
        });
        render(React.createElement(MockWrapper, null,
            React.createElement(Contact, null)));
        yield waitForElementToBeRemoved(() => screen.getByTestId('contact-loading'));
        expect(screen.getByTestId('contact-name').textContent).toBe('Test name');
        expect(screen.getByTestId('contact-email-icon')).toBeInTheDocument();
    }));
    it('not render contact when data fetch failed', () => __awaiter(void 0, void 0, void 0, function* () {
        jest.spyOn(ContactService, 'getContact').mockImplementationOnce(() => {
            throw Error('test');
        });
        render(React.createElement(MockWrapper, null,
            React.createElement(Contact, null)));
        expect(screen.queryByTestId('contact-name')).not.toBeInTheDocument();
        expect(screen.queryByTestId('contact-email-icon')).not.toBeInTheDocument();
    }));
});
//# sourceMappingURL=Contact.test.js.map