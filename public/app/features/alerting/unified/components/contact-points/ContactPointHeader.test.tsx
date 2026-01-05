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
    provisioned: true,
    policies: [],
    grafana_managed_receiver_configs: [],
  };

  describe('K8s API provenance badges', () => {
    it('shows Provisioned badge when contact point has file provenance via K8s annotations', () => {
      const contactPointWithFile = {
        ...mockContactPoint,
        metadata: {
          annotations: {
            [K8sAnnotations.Provenance]: KnownProvenance.File,
          },
        },
      };

      renderWithProvider(<ContactPointHeader contactPoint={contactPointWithFile} onDelete={jest.fn()} />);

      expect(screen.getByText('Provisioned')).toBeInTheDocument();
    });

    it('shows correct badge when contact point has converted_prometheus provenance via K8s annotations', () => {
      const contactPointWithConvertedPrometheus = {
        ...mockContactPoint,
        metadata: {
          annotations: {
            [K8sAnnotations.Provenance]: KnownProvenance.ConvertedPrometheus,
          },
        },
      };

      renderWithProvider(
        <ContactPointHeader contactPoint={contactPointWithConvertedPrometheus} onDelete={jest.fn()} />
      );

      expect(screen.getByText('Provisioned from Prometheus/Mimir')).toBeInTheDocument();
    });
  });

  describe('Non-K8s API provenance badges', () => {
    it('shows Provisioned badge when contact point has file provenance via non-K8s API', () => {
      const contactPointNonK8s = {
        ...mockContactPoint,
        provenance: KnownProvenance.File,
        metadata: undefined,
      };

      renderWithProvider(
        <ContactPointHeader contactPoint={contactPointNonK8s} onDelete={jest.fn()} />,
        VANILLA_ALERTMANAGER_DATASOURCE_UID
      );

      expect(screen.getByText('Provisioned')).toBeInTheDocument();
    });

    it('shows correct badge when contact point has converted_prometheus provenance via non-K8s API', () => {
      const contactPointNonK8s = {
        ...mockContactPoint,
        provenance: KnownProvenance.ConvertedPrometheus,
        metadata: undefined,
      };

      renderWithProvider(
        <ContactPointHeader contactPoint={contactPointNonK8s} onDelete={jest.fn()} />,
        VANILLA_ALERTMANAGER_DATASOURCE_UID
      );

      expect(screen.getByText('Provisioned from Prometheus/Mimir')).toBeInTheDocument();
    });
  });
});
