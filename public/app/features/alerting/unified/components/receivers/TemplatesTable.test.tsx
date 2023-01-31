import { render, screen, within } from '@testing-library/react';
import React from 'react';
import { Provider } from 'react-redux';
import { Router } from 'react-router-dom';

import { locationService } from '@grafana/runtime';
import { contextSrv } from 'app/core/services/context_srv';
import { AlertManagerCortexConfig } from 'app/plugins/datasource/alertmanager/types';
import { configureStore } from 'app/store/configureStore';
import { AccessControlAction } from 'app/types';

import { TemplatesTable } from './TemplatesTable';

const defaultConfig: AlertManagerCortexConfig = {
  template_files: {
    template1: `{{ define "define1" }}`,
  },
  alertmanager_config: {
    templates: ['template1'],
  },
};
jest.mock('app/types', () => ({
  ...jest.requireActual('app/types'),
  useDispatch: () => jest.fn(),
}));

jest.mock('app/core/services/context_srv');
const contextSrvMock = jest.mocked(contextSrv);

const renderWithProvider = () => {
  const store = configureStore();

  render(
    <Provider store={store}>
      <Router history={locationService.getHistory()}>
        <TemplatesTable config={defaultConfig} alertManagerName={'potato'} />
      </Router>
    </Provider>
  );
};

describe('TemplatesTable', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    contextSrvMock.hasAccess.mockImplementation(() => true);
    contextSrvMock.hasPermission.mockImplementation((action) => {
      const permissions = [
        AccessControlAction.AlertingNotificationsRead,
        AccessControlAction.AlertingNotificationsWrite,
        AccessControlAction.AlertingNotificationsExternalRead,
        AccessControlAction.AlertingNotificationsExternalWrite,
      ];
      return permissions.includes(action as AccessControlAction);
    });
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
    contextSrvMock.hasPermission.mockImplementation((action) => {
      const permissions = [
        AccessControlAction.AlertingNotificationsRead,
        AccessControlAction.AlertingNotificationsExternalRead,
      ];
      return permissions.includes(action as AccessControlAction);
    });
    renderWithProvider();
    const rows = screen.getAllByRole('row', { name: /template1/i });
    expect(within(rows[0]).queryByRole('cell', { name: /Copy/i })).not.toBeInTheDocument();
  });
});
