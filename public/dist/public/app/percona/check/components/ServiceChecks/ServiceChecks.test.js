import { __awaiter } from "tslib";
import { render, screen, waitForElementToBeRemoved } from '@testing-library/react';
import React from 'react';
import { Provider } from 'react-redux';
import { getRouteComponentProps } from 'app/core/navigation/__mocks__/routeProps';
import { configureStore } from 'app/store/configureStore';
import { ServiceChecks } from './ServiceChecks';
jest.mock('app/percona/check/Check.service');
describe('ServiceChecks', () => {
    it('should show the title with the service name', () => __awaiter(void 0, void 0, void 0, function* () {
        render(React.createElement(Provider, { store: configureStore({
                percona: {
                    user: { isAuthorized: true },
                    settings: { loading: false, result: { isConnectedToPortal: false } },
                },
            }) },
            React.createElement(ServiceChecks, Object.assign({}, getRouteComponentProps({
                match: { params: { service: '/service_1/' }, isExact: true, path: '', url: '' },
            })))));
        yield waitForElementToBeRemoved(() => screen.getByTestId('table-loading'));
        expect(screen.getByTestId('page-service')).toHaveTextContent('Failed Checks for service "Service One"');
    }));
    it('should show "Read More" is a link is available', () => __awaiter(void 0, void 0, void 0, function* () {
        render(React.createElement(Provider, { store: configureStore({
                percona: {
                    user: { isAuthorized: true },
                    settings: { loading: false, result: { isConnectedToPortal: false } },
                },
            }) },
            React.createElement(ServiceChecks, Object.assign({}, getRouteComponentProps({
                match: { params: { service: '/service_1/' }, isExact: true, path: '', url: '' },
            })))));
        yield waitForElementToBeRemoved(() => screen.getByTestId('table-loading'));
        const links = screen.getAllByTestId('read-more-link');
        expect(links).toHaveLength(1);
        expect(links[0]).toHaveTextContent('Read More');
        expect(links[0]).toHaveAttribute('href', 'localhost/check-one');
    }));
});
//# sourceMappingURL=ServiceChecks.test.js.map