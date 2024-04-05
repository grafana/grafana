import React from 'react';
import { render, waitFor } from 'test/test-utils';

import { AccessControlAction } from 'app/types';

import { grantUserPermissions } from '../../mocks';
import { AlertmanagerProvider } from '../../state/AlertmanagerContext';
import { GRAFANA_DATASOURCE_NAME } from '../../utils/datasource';

import { MuteTimingsTable } from './MuteTimingsTable';

jest.mock('app/types', () => ({
  ...jest.requireActual('app/types'),
  useDispatch: () => jest.fn(),
}));
const renderWithProvider = (alertManagerSource?: string) => {
  return render(
    <AlertmanagerProvider accessType={'notification'} alertmanagerSourceName={alertManagerSource}>
      <MuteTimingsTable alertManagerSourceName={alertManagerSource ?? GRAFANA_DATASOURCE_NAME} />
    </AlertmanagerProvider>
  );
};

describe('MuteTimingsTable', () => {
  it(' shows export button when allowed and supported', async () => {
    grantUserPermissions([
      AccessControlAction.AlertingNotificationsRead,
      AccessControlAction.AlertingNotificationsWrite,
    ]);
    const { findByRole } = renderWithProvider();
    expect(await findByRole('button', { name: /export all/i })).toBeInTheDocument();
  });
  it('It does not show export button when not allowed ', async () => {
    // when not allowed
    grantUserPermissions([]);
    const { queryByRole } = renderWithProvider();
    await waitFor(() => {
      expect(queryByRole('button', { name: /export all/i })).not.toBeInTheDocument();
    });
  });
  it('It does not show export button when not supported ', async () => {
    // when not supported
    grantUserPermissions([
      AccessControlAction.AlertingNotificationsRead,
      AccessControlAction.AlertingNotificationsWrite,
    ]);
    const { queryByRole } = renderWithProvider('potato');
    await waitFor(() => {
      expect(queryByRole('button', { name: /export all/i })).not.toBeInTheDocument();
    });
  });
});
