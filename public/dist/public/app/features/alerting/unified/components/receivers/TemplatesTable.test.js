import { render, screen, within } from '@testing-library/react';
import React from 'react';
import { Provider } from 'react-redux';
import { Router } from 'react-router-dom';
import { locationService } from '@grafana/runtime';
import { configureStore } from 'app/store/configureStore';
import { AccessControlAction } from 'app/types';
import { grantUserPermissions } from '../../mocks';
import { AlertmanagerProvider } from '../../state/AlertmanagerContext';
import { TemplatesTable } from './TemplatesTable';
const defaultConfig = {
    template_files: {
        template1: `{{ define "define1" }}`,
    },
    alertmanager_config: {
        templates: ['template1'],
    },
};
jest.mock('app/types', () => (Object.assign(Object.assign({}, jest.requireActual('app/types')), { useDispatch: () => jest.fn() })));
jest.mock('app/core/services/context_srv');
const renderWithProvider = () => {
    const store = configureStore();
    render(React.createElement(Provider, { store: store },
        React.createElement(Router, { history: locationService.getHistory() },
            React.createElement(AlertmanagerProvider, { accessType: 'notification' },
                React.createElement(TemplatesTable, { config: defaultConfig, alertManagerName: 'potato' })))));
};
describe('TemplatesTable', () => {
    beforeEach(() => {
        jest.resetAllMocks();
        grantUserPermissions([
            AccessControlAction.AlertingNotificationsRead,
            AccessControlAction.AlertingNotificationsWrite,
            AccessControlAction.AlertingNotificationsExternalRead,
            AccessControlAction.AlertingNotificationsExternalWrite,
        ]);
    });
    it('Should render templates table with the correct rows', () => {
        renderWithProvider();
        const rows = screen.getAllByRole('row', { name: /template1/i });
        expect(within(rows[0]).getByRole('cell', { name: /template1/i })).toBeInTheDocument();
    });
    it('Should render duplicate template button when having permissions', () => {
        renderWithProvider();
        const rows = screen.getAllByRole('row', { name: /template1/i });
        expect(within(rows[0]).getByRole('cell', { name: /Copy/i })).toBeInTheDocument();
    });
    it('Should not render duplicate template button when not having write permissions', () => {
        grantUserPermissions([
            AccessControlAction.AlertingNotificationsRead,
            AccessControlAction.AlertingNotificationsExternalRead,
        ]);
        renderWithProvider();
        const rows = screen.getAllByRole('row', { name: /template1/i });
        expect(within(rows[0]).queryByRole('cell', { name: /Copy/i })).not.toBeInTheDocument();
    });
});
//# sourceMappingURL=TemplatesTable.test.js.map