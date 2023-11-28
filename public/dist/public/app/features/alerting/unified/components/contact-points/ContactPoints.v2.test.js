import { __awaiter } from "tslib";
import { render, screen, waitFor, waitForElementToBeRemoved } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { noop } from 'lodash';
import React from 'react';
import { TestProvider } from 'test/helpers/TestProvider';
import { selectors } from '@grafana/e2e-selectors';
import { AccessControlAction } from 'app/types';
import { grantUserPermissions, mockDataSource } from '../../mocks';
import { AlertmanagerProvider } from '../../state/AlertmanagerContext';
import { setupDataSources } from '../../testSetup/datasources';
import { DataSourceType } from '../../utils/datasource';
import ContactPoints, { ContactPoint } from './ContactPoints.v2';
import setupGrafanaManagedServer from './__mocks__/grafanaManagedServer';
import setupMimirFlavoredServer, { MIMIR_DATASOURCE_UID } from './__mocks__/mimirFlavoredServer';
/**
 * There are lots of ways in which we test our pages and components. Here's my opinionated approach to testing them.
 *
 *  Use MSW to mock API responses, you can copy the JSON results from the network panel and use them in a __mocks__ folder.
 *
 * 1. Make sure we have "presentation" components we can test without mocking data,
 *    test these if they have some logic in them (hiding / showing things) and sad paths.
 *
 * 2. For testing the "container" components, check if data fetching is working as intended (you can use loading state)
 *    and check if we're not in an error state (although you can test for that too for sad path).
 *
 * 3. Write tests for the hooks we call in the "container" components
 *    if those have any logic or data structure transformations in them.
 */
describe('ContactPoints', () => {
    describe('Grafana managed alertmanager', () => {
        setupGrafanaManagedServer();
        beforeAll(() => {
            grantUserPermissions([
                AccessControlAction.AlertingNotificationsRead,
                AccessControlAction.AlertingNotificationsWrite,
            ]);
        });
        it('should show / hide loading states', () => __awaiter(void 0, void 0, void 0, function* () {
            render(React.createElement(AlertmanagerProvider, { accessType: 'notification' },
                React.createElement(ContactPoints, null)), { wrapper: TestProvider });
            yield waitFor(() => __awaiter(void 0, void 0, void 0, function* () {
                expect(screen.getByText('Loading...')).toBeInTheDocument();
                yield waitForElementToBeRemoved(screen.getByText('Loading...'));
                expect(screen.queryByTestId(selectors.components.Alert.alertV2('error'))).not.toBeInTheDocument();
            }));
            expect(screen.getByText('grafana-default-email')).toBeInTheDocument();
            expect(screen.getAllByTestId('contact-point')).toHaveLength(4);
        }));
    });
    describe('Mimir-flavored alertmanager', () => {
        setupMimirFlavoredServer();
        beforeAll(() => {
            grantUserPermissions([
                AccessControlAction.AlertingNotificationsExternalRead,
                AccessControlAction.AlertingNotificationsExternalWrite,
            ]);
            setupDataSources(mockDataSource({
                type: DataSourceType.Alertmanager,
                name: MIMIR_DATASOURCE_UID,
                uid: MIMIR_DATASOURCE_UID,
            }));
        });
        it('should show / hide loading states', () => __awaiter(void 0, void 0, void 0, function* () {
            render(React.createElement(AlertmanagerProvider, { accessType: 'notification', alertmanagerSourceName: MIMIR_DATASOURCE_UID },
                React.createElement(ContactPoints, null)), { wrapper: TestProvider });
            yield waitFor(() => __awaiter(void 0, void 0, void 0, function* () {
                expect(screen.getByText('Loading...')).toBeInTheDocument();
                yield waitForElementToBeRemoved(screen.getByText('Loading...'));
                expect(screen.queryByTestId(selectors.components.Alert.alertV2('error'))).not.toBeInTheDocument();
            }));
            expect(screen.getByText('mixed')).toBeInTheDocument();
            expect(screen.getByText('some webhook')).toBeInTheDocument();
            expect(screen.getAllByTestId('contact-point')).toHaveLength(2);
        }));
    });
});
describe('ContactPoint', () => {
    it('should call delete when clicked and not disabled', () => __awaiter(void 0, void 0, void 0, function* () {
        const onDelete = jest.fn();
        render(React.createElement(ContactPoint, { name: 'my-contact-point', receivers: [], onDelete: onDelete }), {
            wrapper,
        });
        const moreActions = screen.getByRole('button', { name: 'more-actions' });
        yield userEvent.click(moreActions);
        const deleteButton = screen.getByRole('menuitem', { name: /delete/i });
        yield userEvent.click(deleteButton);
        expect(onDelete).toHaveBeenCalledWith('my-contact-point');
    }));
    it('should disable edit button', () => __awaiter(void 0, void 0, void 0, function* () {
        render(React.createElement(ContactPoint, { name: 'my-contact-point', disabled: true, receivers: [], onDelete: noop }), {
            wrapper,
        });
        const moreActions = screen.getByRole('button', { name: 'more-actions' });
        expect(moreActions).not.toBeDisabled();
        const editAction = screen.getByTestId('edit-action');
        expect(editAction).toHaveAttribute('aria-disabled', 'true');
    }));
    it('should disable buttons when provisioned', () => __awaiter(void 0, void 0, void 0, function* () {
        render(React.createElement(ContactPoint, { name: 'my-contact-point', provisioned: true, receivers: [], onDelete: noop }), {
            wrapper,
        });
        expect(screen.getByText(/provisioned/i)).toBeInTheDocument();
        const editAction = screen.queryByTestId('edit-action');
        expect(editAction).not.toBeInTheDocument();
        const viewAction = screen.getByRole('link', { name: /view/i });
        expect(viewAction).toBeInTheDocument();
        const moreActions = screen.getByRole('button', { name: 'more-actions' });
        expect(moreActions).not.toBeDisabled();
        yield userEvent.click(moreActions);
        const deleteButton = screen.getByRole('menuitem', { name: /delete/i });
        expect(deleteButton).toBeDisabled();
    }));
    it('should disable delete when contact point is linked to at least one notification policy', () => __awaiter(void 0, void 0, void 0, function* () {
        render(React.createElement(ContactPoint, { name: 'my-contact-point', provisioned: true, receivers: [], policies: 1, onDelete: noop }), {
            wrapper,
        });
        expect(screen.getByRole('link', { name: 'is used by 1 notification policy' })).toBeInTheDocument();
        const moreActions = screen.getByRole('button', { name: 'more-actions' });
        yield userEvent.click(moreActions);
        const deleteButton = screen.getByRole('menuitem', { name: /delete/i });
        expect(deleteButton).toBeDisabled();
    }));
});
const wrapper = ({ children }) => (React.createElement(TestProvider, null,
    React.createElement(AlertmanagerProvider, { accessType: 'notification' }, children)));
//# sourceMappingURL=ContactPoints.v2.test.js.map