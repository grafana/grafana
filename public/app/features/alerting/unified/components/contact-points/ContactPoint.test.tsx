import { type ReactElement } from 'react';
import { render, screen } from 'test/test-utils';

import { AccessControlAction } from 'app/types/accessControl';

import { setupMswServer } from '../../mockApi';
import { grantUserPermissions } from '../../mocks';
import { AlertmanagerProvider } from '../../state/AlertmanagerContext';
import { KnownProvenance } from '../../types/knownProvenance';
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

  it('instance drawer embed: Open configuration link uses receiver URL in a new tab when user can edit', async () => {
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

    renderWithProvider(<ContactPoint contactPoint={contactPoint} instanceDrawerEmbed />);

    const link = await screen.findByTestId('open-configuration-action');
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    expect(link).toHaveAttribute('href', '/alerting/notifications/receivers/bmV3LWNvbnRhY3QtcG9pbnQ/edit');
    expect(link).toHaveTextContent('Open configuration');
  });

  it('instance drawer embed: View details when contact point is not editable', async () => {
    const contactPoint: ContactPointWithMetadata = {
      name: 'provisioned-cp',
      policies: [],
      grafana_managed_receiver_configs: [],
      provenance: KnownProvenance.File,
    };

    renderWithProvider(<ContactPoint contactPoint={contactPoint} instanceDrawerEmbed />);

    const link = await screen.findByTestId('view-details-action');
    expect(link).toHaveTextContent('View details');
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('href', '/alerting/notifications/receivers/provisioned-cp/edit');
  });
});
