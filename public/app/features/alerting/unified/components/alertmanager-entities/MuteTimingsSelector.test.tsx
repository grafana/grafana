import { HttpResponse, http } from 'msw';
import { render, screen, userEvent } from 'test/test-utils';

import server from '@grafana/test-utils/server';
import { type MultiSelectCommonProps } from '@grafana/ui';
import { setupMswServer } from 'app/features/alerting/unified/mockApi';
import { grantUserPermissions, mockDataSource } from 'app/features/alerting/unified/mocks';
import { setTimeIntervalsList } from 'app/features/alerting/unified/mocks/server/configure';
import { setAlertmanagerConfig } from 'app/features/alerting/unified/mocks/server/entities/alertmanagers';
import { MOCK_DATASOURCE_EXTERNAL_VANILLA_ALERTMANAGER_UID } from 'app/features/alerting/unified/mocks/server/handlers/datasources';
import { listNamespacedTimeIntervalHandler } from 'app/features/alerting/unified/mocks/server/handlers/k8s/timeIntervals.k8s';
import { getK8sResponse } from 'app/features/alerting/unified/mocks/server/utils';
import { AlertmanagerProvider } from 'app/features/alerting/unified/state/AlertmanagerContext';
import { setupDataSources } from 'app/features/alerting/unified/testSetup/datasources';
import { DataSourceType, GRAFANA_RULES_SOURCE_NAME } from 'app/features/alerting/unified/utils/datasource';
import { type MuteTimeInterval } from 'app/plugins/datasource/alertmanager/types';
import { AccessControlAction } from 'app/types/accessControl';

import MuteTimingsSelector from './MuteTimingsSelector';

const renderWithProvider = (
  alertManagerSource = GRAFANA_RULES_SOURCE_NAME,
  onChange: MultiSelectCommonProps<string>['onChange'] = () => {}
) => {
  return render(
    <AlertmanagerProvider accessType={'notification'} alertmanagerSourceName={alertManagerSource}>
      <MuteTimingsSelector alertmanager={alertManagerSource} selectProps={{ onChange }} />
    </AlertmanagerProvider>
  );
};

const NOT_USABLE_DESCRIPTION = /imported from an external alertmanager/i;

setupMswServer();

describe('MuteTimingsSelector', () => {
  beforeEach(() => {
    grantUserPermissions([
      AccessControlAction.AlertingNotificationsRead,
      AccessControlAction.AlertingNotificationsWrite,
    ]);
  });

  it('should show all usable time intervals', async () => {
    const user = userEvent.setup();
    setTimeIntervalsList([
      { name: 'regular-interval', provenance: 'none' },
      { name: 'file-provisioned', provenance: 'file' },
      { name: 'another-regular', provenance: 'none' },
    ]);

    renderWithProvider();

    // Click to open the dropdown
    const selector = await screen.findByRole('combobox', { name: /time intervals/i });
    await user.click(selector);

    // All usable intervals should be visible
    expect(await screen.findByText('regular-interval')).toBeInTheDocument();
    expect(screen.getByText('file-provisioned')).toBeInTheDocument();
    expect(screen.getByText('another-regular')).toBeInTheDocument();
  });

  it('should list time intervals with canUse: false as unselectable', async () => {
    const user = userEvent.setup();
    const onChange = jest.fn();
    setTimeIntervalsList([
      { name: 'regular-interval', provenance: 'none' },
      { name: 'imported-interval', canUse: false },
      { name: 'file-provisioned', provenance: 'file' },
    ]);

    renderWithProvider(GRAFANA_RULES_SOURCE_NAME, onChange);

    // Click to open the dropdown
    const selector = await screen.findByRole('combobox', { name: /time intervals/i });
    await user.click(selector);

    // Usable intervals should be visible
    expect(await screen.findByText('regular-interval')).toBeInTheDocument();
    expect(screen.getByText('file-provisioned')).toBeInTheDocument();

    expect(screen.getByText('imported-interval')).toBeInTheDocument();
    expect(screen.getByText(NOT_USABLE_DESCRIPTION)).toBeInTheDocument();

    await user.click(screen.getByText('imported-interval'));
    expect(onChange).not.toHaveBeenCalled();
  });

  it('should still allow selecting a usable interval alongside unselectable ones', async () => {
    const user = userEvent.setup();
    const onChange = jest.fn();
    setTimeIntervalsList([
      { name: 'normal-1', provenance: 'none' },
      { name: 'imported-1', canUse: false },
      { name: 'file-1', provenance: 'file' },
    ]);

    renderWithProvider(GRAFANA_RULES_SOURCE_NAME, onChange);

    const selector = await screen.findByRole('combobox', { name: /time intervals/i });
    await user.click(selector);

    await user.click(await screen.findByText('normal-1'));

    expect(onChange).toHaveBeenCalledWith(
      expect.arrayContaining([expect.objectContaining({ value: 'normal-1' })]),
      expect.anything()
    );
  });

  it('should handle empty list', async () => {
    setTimeIntervalsList([]);

    renderWithProvider();

    // Selector should be present but have no options
    const selector = await screen.findByRole('combobox', { name: /time intervals/i });
    expect(selector).toBeInTheDocument();
  });

  it('should handle list with only non-usable intervals', async () => {
    const user = userEvent.setup();
    const onChange = jest.fn();
    setTimeIntervalsList([
      { name: 'imported-1', canUse: false },
      { name: 'imported-2', canUse: false },
    ]);

    renderWithProvider(GRAFANA_RULES_SOURCE_NAME, onChange);

    // Click to open the dropdown
    const selector = await screen.findByRole('combobox', { name: /time intervals/i });
    await user.click(selector);

    expect(await screen.findByText('imported-1')).toBeInTheDocument();
    expect(screen.getByText('imported-2')).toBeInTheDocument();

    await user.click(screen.getByText('imported-1'));
    expect(onChange).not.toHaveBeenCalled();
  });

  it('should treat a k8s interval with no canUse annotation as unselectable', async () => {
    const user = userEvent.setup();
    const onChange = jest.fn();
    // Manually create intervals without canUse annotation
    const listMuteTimingsPath = listNamespacedTimeIntervalHandler().info.path;

    server.use(
      http.get(listMuteTimingsPath, () => {
        const items = [
          {
            metadata: {
              annotations: {
                'grafana.com/provenance': 'none',
                // Missing canUse annotation
              },
              name: 'interval-without-canuse',
              uid: 'uid-interval-without-canuse',
              namespace: 'default',
              resourceVersion: 'e0270bfced786660',
            },
            spec: { name: 'interval-without-canuse', time_intervals: [] },
          },
          {
            metadata: {
              annotations: {
                'grafana.com/provenance': 'none',
                'grafana.com/canUse': 'true',
              },
              name: 'interval-with-canuse',
              uid: 'uid-interval-with-canuse',
              namespace: 'default',
              resourceVersion: 'e0270bfced786660',
            },
            spec: { name: 'interval-with-canuse', time_intervals: [] },
          },
        ];
        return HttpResponse.json(getK8sResponse('TimeIntervalList', items));
      })
    );

    renderWithProvider(GRAFANA_RULES_SOURCE_NAME, onChange);

    // Click to open the dropdown
    const selector = await screen.findByRole('combobox', { name: /time intervals/i });
    await user.click(selector);

    expect(await screen.findByText('interval-with-canuse')).toBeInTheDocument();

    await user.click(screen.getByText('interval-without-canuse'));
    expect(onChange).not.toHaveBeenCalled();
  });

  describe('external alertmanager', () => {
    const externalAM = mockDataSource({
      name: MOCK_DATASOURCE_EXTERNAL_VANILLA_ALERTMANAGER_UID,
      uid: MOCK_DATASOURCE_EXTERNAL_VANILLA_ALERTMANAGER_UID,
      type: DataSourceType.Alertmanager,
    });

    beforeEach(() => {
      setupDataSources(externalAM);
    });

    it('should show all time intervals without filtering by canUse', async () => {
      const user = userEvent.setup();
      const intervals: MuteTimeInterval[] = [
        { name: 'weekends', time_intervals: [{ weekdays: ['saturday', 'sunday'] }] },
        { name: 'holidays', time_intervals: [{ months: ['12'] }] },
      ];
      setAlertmanagerConfig(MOCK_DATASOURCE_EXTERNAL_VANILLA_ALERTMANAGER_UID, {
        alertmanager_config: {
          receivers: [{ name: 'default' }],
          route: { receiver: 'default' },
          time_intervals: intervals,
        },
        template_files: {},
      });

      renderWithProvider(MOCK_DATASOURCE_EXTERNAL_VANILLA_ALERTMANAGER_UID);

      const selector = await screen.findByRole('combobox', { name: /time intervals/i });
      await user.click(selector);

      expect(await screen.findByText('weekends')).toBeInTheDocument();
      expect(screen.getByText('holidays')).toBeInTheDocument();
    });
  });
});
