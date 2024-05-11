import { screen, waitFor } from '@testing-library/react';
import React from 'react';

import { render } from 'test/test-utils';
import { AccessControlAction } from 'app/types';

import { setupMswServer } from '../../mockApi';
import { grantUserPermissions } from '../../mocks';
import setupGrafanaManagedServer from './__mocks__/grafanaManagedServer';
import { AlertmanagerProvider } from '../../state/AlertmanagerContext';
import DuplicateMessageTemplate from './DuplicateMessageTemplate';

const server = setupMswServer();

beforeEach(() => {
  grantUserPermissions([AccessControlAction.AlertingNotificationsRead, AccessControlAction.AlertingNotificationsWrite]);
  setupGrafanaManagedServer(server);
});

it('should render', async () => {
  const props = { match: { params: { name: 'some%20template' } } }

  render(
    <AlertmanagerProvider accessType={'notification'} alertmanagerSourceName="grafana">
      <DuplicateMessageTemplate {...props as any} />
    </AlertmanagerProvider>,
  );

  await waitFor(() => {
    expect(screen.getByText('Edit payload')).toBeInTheDocument()
  })
})
