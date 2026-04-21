import { type ReactElement } from 'react';
import { render, screen } from 'test/test-utils';

import { AccessControlAction } from 'app/types/accessControl';

import { setupMswServer } from '../../mockApi';
import { grantUserPermissions } from '../../mocks';
import { AlertmanagerProvider } from '../../state/AlertmanagerContext';
import { K8sAnnotations } from '../../utils/k8s/constants';

import { ContactPoint } from './ContactPoint';
import { type ContactPointWithMetadata } from './utils';

setupMswServer();

const renderWithProvider = (ui: ReactElement) =>
  render(
    <AlertmanagerProvider accessType="notification" alertmanagerSourceName="grafana">
      {ui}
    </AlertmanagerProvider>
  );

describe('ContactPoint', () => {
  beforeEach(() => {
    grantUserPermissions([
      AccessControlAction.AlertingNotificationsRead,
      AccessControlAction.AlertingNotificationsWrite,
    ]);
  });

  it('invokes onEditContactPoint with resource id and display name when Edit is clicked', async () => {
    const onEditContactPoint = jest.fn();
    const contactPoint: ContactPointWithMetadata = {
      id: 'bmV3LWNvbnRhY3QtcG9pbnQ',
      name: 'new-contact-point',
      policies: [],
      grafana_managed_receiver_configs: [],
      metadata: {
        annotations: {
          [K8sAnnotations.AccessWrite]: 'true',
          [K8sAnnotations.AccessAdmin]: 'true',
          [K8sAnnotations.AccessDelete]: 'true',
        },
      },
    };

    const { user } = renderWithProvider(
      <ContactPoint contactPoint={contactPoint} onEditContactPoint={onEditContactPoint} />
    );

    await user.click(await screen.findByTestId('edit-action'));

    expect(onEditContactPoint).toHaveBeenCalledTimes(1);
    expect(onEditContactPoint).toHaveBeenCalledWith('bmV3LWNvbnRhY3QtcG9pbnQ', 'new-contact-point');
  });
});
