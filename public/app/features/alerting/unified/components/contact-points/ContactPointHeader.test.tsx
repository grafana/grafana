import { render, screen, userEvent } from 'test/test-utils';

import { AccessControlAction } from 'app/types/accessControl';

import { setupMswServer } from '../../mockApi';
import { grantUserPermissions } from '../../mocks';
import { AlertmanagerProvider } from '../../state/AlertmanagerContext';
import { KnownProvenance } from '../../types/knownProvenance';

import { ContactPointHeader } from './ContactPointHeader';
import { type ContactPointWithMetadata } from './utils';

setupMswServer();

const renderWithProvider = (component: React.ReactElement, alertmanagerSourceName?: string) => {
  return render(
    <AlertmanagerProvider accessType="notification" alertmanagerSourceName={alertmanagerSourceName}>
      {component}
    </AlertmanagerProvider>
  );
};

describe('ContactPointHeader', () => {
  beforeEach(() => {
    grantUserPermissions([
      AccessControlAction.AlertingNotificationsRead,
      AccessControlAction.AlertingNotificationsWrite,
    ]);
  });

  const mockContactPoint: ContactPointWithMetadata = {
    id: 'test-contact-point',
    name: 'Test Contact Point',
    provenance: KnownProvenance.API,
    policies: [],
    grafana_managed_receiver_configs: [],
  };

  it('disables export when the contact point contains a legacy integration', async () => {
    const user = userEvent.setup();
    const contactPointWithV0Integration = {
      ...mockContactPoint,
      provenance: KnownProvenance.None,
      grafana_managed_receiver_configs: [{ type: 'slack', settings: {}, version: 'v0mimir1' }],
    } as ContactPointWithMetadata;

    renderWithProvider(<ContactPointHeader contactPoint={contactPointWithV0Integration} onDelete={jest.fn()} />);

    await user.click(screen.getByRole('button', { name: 'More actions for contact point "Test Contact Point"' }));
    const exportButton = await screen.findByRole('menuitem', { name: 'Export' });
    expect(exportButton).toBeDisabled();

    await user.hover(exportButton);
    expect(
      await screen.findByText('Export is not available for contact points that contain legacy integrations')
    ).toBeInTheDocument();
  });

  it('shows Provisioned badge when contact point has file provenance via K8s annotations', () => {
    const contactPointWithFile = {
      ...mockContactPoint,
      provenance: KnownProvenance.File,
    };

    renderWithProvider(<ContactPointHeader contactPoint={contactPointWithFile} onDelete={jest.fn()} />);

    expect(screen.getByText('Provisioned')).toBeInTheDocument();
  });

  it('shows correct badge when contact point has converted_prometheus provenance', () => {
    const contactPointWithConvertedPrometheus = {
      ...mockContactPoint,
      provenance: KnownProvenance.ConvertedPrometheus,
    };

    renderWithProvider(<ContactPointHeader contactPoint={contactPointWithConvertedPrometheus} onDelete={jest.fn()} />);

    expect(screen.getByText('Imported')).toBeInTheDocument();
  });
});
