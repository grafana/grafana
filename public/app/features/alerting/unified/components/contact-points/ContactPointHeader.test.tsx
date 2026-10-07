import { QueryStatus } from '@reduxjs/toolkit/query';
import { HttpResponse, http } from 'msw';
import { render, screen, userEvent, waitFor } from 'test/test-utils';

import { AccessControlAction } from 'app/types/accessControl';

import { alertmanagerApi } from '../../api/alertmanagerApi';
import { setupMswServer } from '../../mockApi';
import { grantUserPermissions } from '../../mocks';
import { AlertmanagerProvider } from '../../state/AlertmanagerContext';
import { type NotifierDTO } from '../../types/alerting';
import { KnownProvenance } from '../../types/knownProvenance';

import { ContactPointHeader } from './ContactPointHeader';
import { type ContactPointWithMetadata } from './utils';

const server = setupMswServer();

const mockNotifiers = (notifiers: NotifierDTO[]) => {
  server.use(http.get('/api/alert-notifiers', () => HttpResponse.json(notifiers)));
};

const renderWithProvider = (component: React.ReactElement, alertmanagerSourceName?: string) => {
  return render(
    <AlertmanagerProvider accessType="notification" alertmanagerSourceName={alertmanagerSourceName}>
      {component}
    </AlertmanagerProvider>,
    { preloadedState: {} }
  );
};

/** Waits until the grafanaNotifiers RTK Query cache entry has settled, so assertions reflect fetched data. */
const waitForNotifiersLoaded = (store: ReturnType<typeof renderWithProvider>['store']) =>
  waitFor(() => {
    expect(alertmanagerApi.endpoints.grafanaNotifiers.select(undefined)(store!.getState()).status).toBe(
      QueryStatus.fulfilled
    );
  });

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
    mockNotifiers([{ type: 'slack', name: 'Slack', heading: 'Slack settings', description: '', currentVersion: 'v1' }]);
    const user = userEvent.setup();
    const contactPointWithV0Integration = {
      ...mockContactPoint,
      provenance: KnownProvenance.None,
      grafana_managed_receiver_configs: [{ type: 'slack', settings: {}, version: 'v0mimir1' }],
    } as ContactPointWithMetadata;

    const { store } = renderWithProvider(
      <ContactPointHeader contactPoint={contactPointWithV0Integration} onDelete={jest.fn()} />
    );
    await waitForNotifiersLoaded(store);

    await user.click(screen.getByRole('button', { name: 'More actions for contact point "Test Contact Point"' }));
    const exportButton = await screen.findByRole('menuitem', { name: 'Export' });
    expect(exportButton).toBeDisabled();

    await user.hover(exportButton);
    expect(
      await screen.findByText('Export is not available for contact points that contain legacy integrations')
    ).toBeInTheDocument();
  });

  it('keeps export enabled when the contact point has no legacy integrations', async () => {
    // currentVersion matches the integration's version even though it looks like a legacy
    // string ("v0..."), so this only stays enabled if the check is based on real notifier
    // metadata rather than a naive version?.startsWith('v0') heuristic.
    mockNotifiers([
      { type: 'slack', name: 'Slack', heading: 'Slack settings', description: '', currentVersion: 'v0mimir1' },
    ]);
    const user = userEvent.setup();
    const contactPointWithCurrentIntegration = {
      ...mockContactPoint,
      provenance: KnownProvenance.None,
      grafana_managed_receiver_configs: [{ type: 'slack', settings: {}, version: 'v0mimir1' }],
    } as ContactPointWithMetadata;

    const { store } = renderWithProvider(
      <ContactPointHeader contactPoint={contactPointWithCurrentIntegration} onDelete={jest.fn()} />
    );
    await waitForNotifiersLoaded(store);

    await user.click(screen.getByRole('button', { name: 'More actions for contact point "Test Contact Point"' }));
    const exportButton = await screen.findByRole('menuitem', { name: 'Export' });
    expect(exportButton).toBeEnabled();
  });

  it('keeps export enabled for a contact point with a mix of legacy-capable and current-version integrations', async () => {
    // Same trick as above for the slack integration, plus an email integration with no version
    // info at all, to cover a contact point with more than one integration type.
    mockNotifiers([
      { type: 'slack', name: 'Slack', heading: 'Slack settings', description: '', currentVersion: 'v0mimir1' },
      { type: 'email', name: 'Email', heading: 'Email settings', description: '' },
    ]);
    const user = userEvent.setup();
    const mixedContactPoint = {
      ...mockContactPoint,
      provenance: KnownProvenance.None,
      grafana_managed_receiver_configs: [
        { type: 'slack', settings: {}, version: 'v0mimir1' },
        { type: 'email', settings: {} },
      ],
    } as ContactPointWithMetadata;

    const { store } = renderWithProvider(<ContactPointHeader contactPoint={mixedContactPoint} onDelete={jest.fn()} />);
    await waitForNotifiersLoaded(store);

    await user.click(screen.getByRole('button', { name: 'More actions for contact point "Test Contact Point"' }));
    const exportButton = await screen.findByRole('menuitem', { name: 'Export' });
    expect(exportButton).toBeEnabled();
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
