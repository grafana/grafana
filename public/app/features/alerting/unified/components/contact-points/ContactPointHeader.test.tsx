import { render, screen } from 'test/test-utils';

import { AccessControlAction } from 'app/types/accessControl';

import { setupMswServer } from '../../mockApi';
import { grantUserPermissions } from '../../mocks';
import { AlertmanagerProvider } from '../../state/AlertmanagerContext';
import { KnownProvenance } from '../../types/knownProvenance';
import { K8sAnnotations } from '../../utils/k8s/constants';

import { ContactPointHeader } from './ContactPointHeader';
import { VANILLA_ALERTMANAGER_DATASOURCE_UID } from './mocks/vanillaAlertmanagerServer';
import { ContactPointWithMetadata } from './utils';

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

    expect(screen.getByText('Imported from Prometheus/Mimir')).toBeInTheDocument();
  });
});
