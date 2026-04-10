import { type PropsWithChildren } from 'react';
import { getWrapper, renderHook } from 'test/test-utils';

import { MIMIR_DATASOURCE_UID } from 'app/features/alerting/unified/mocks/server/constants';
import {
  type AlertManagerDataSourceJsonData,
  AlertManagerImplementation,
} from 'app/plugins/datasource/alertmanager/types';
import { AccessControlAction } from 'app/types/accessControl';

import { setupMswServer } from '../../mockApi';
import { grantUserPermissions, mockDataSource } from '../../mocks';
import { AlertmanagerProvider } from '../../state/AlertmanagerContext';
import { setupDataSources } from '../../testSetup/datasources';
import { DataSourceType, GRAFANA_RULES_SOURCE_NAME } from '../../utils/datasource';

import {
  useAlertmanagerAbilityState,
  useAlertmanagerAbilityStates,
  useAllAlertmanagerAbilityStates,
} from './notificationAbilities';
import { AlertmanagerAction, isAvailable, isInsufficientPermissions } from './types';

setupMswServer();

/**
 * Snapshot tests for notification (alertmanager) abilities.
 * Every change to the snapshot should be reviewed carefully!
 */
describe('notificationAbilities', () => {
  it("should report Create / Update / Delete actions aren't supported for external vanilla alertmanager", () => {
    setupDataSources(
      mockDataSource<AlertManagerDataSourceJsonData>({
        name: GRAFANA_RULES_SOURCE_NAME,
        type: DataSourceType.Alertmanager,
        jsonData: { implementation: AlertManagerImplementation.prometheus },
      })
    );

    const { result } = renderHook(() => useAllAlertmanagerAbilityStates(), {
      wrapper: createAlertmanagerWrapper('does-not-exist'),
    });
    expect(result.current).toMatchSnapshot();
  });

  it('should report everything is applicable for the builtin alertmanager', () => {
    setupDataSources(
      mockDataSource<AlertManagerDataSourceJsonData>({
        name: GRAFANA_RULES_SOURCE_NAME,
        type: DataSourceType.Alertmanager,
      })
    );

    grantUserPermissions([AccessControlAction.AlertingNotificationsRead, AccessControlAction.AlertingInstanceRead]);

    const { result } = renderHook(() => useAllAlertmanagerAbilityStates(), {
      wrapper: createAlertmanagerWrapper(GRAFANA_RULES_SOURCE_NAME),
    });

    // Every action should be applicable (either granted or denied-but-visible)
    Object.values(result.current).forEach((ability) => {
      expect(isAvailable(ability) || ability.granted).toBe(true);
    });

    // read permission was granted — view should be granted
    const { result: viewResult } = renderHook(() => useAlertmanagerAbilityState(AlertmanagerAction.ViewSilence), {
      wrapper: createAlertmanagerWrapper(GRAFANA_RULES_SOURCE_NAME),
    });
    expect(viewResult.current.granted).toBe(true);

    expect(result.current).toMatchSnapshot();
  });

  it('should report everything except exporting for Mimir alertmanager', () => {
    setupDataSources(
      mockDataSource<AlertManagerDataSourceJsonData>({
        name: MIMIR_DATASOURCE_UID,
        type: DataSourceType.Alertmanager,
        jsonData: { implementation: AlertManagerImplementation.mimir },
      })
    );

    grantUserPermissions([
      AccessControlAction.AlertingNotificationsExternalRead,
      AccessControlAction.AlertingNotificationsExternalWrite,
      AccessControlAction.AlertingInstancesExternalRead,
      AccessControlAction.AlertingInstancesExternalWrite,
    ]);

    const { result } = renderHook(() => useAllAlertmanagerAbilityStates(), {
      wrapper: createAlertmanagerWrapper('mimir'),
    });

    expect(result.current).toMatchSnapshot();
  });

  it('should return multiple ability states for a list of actions', () => {
    setupDataSources(
      mockDataSource<AlertManagerDataSourceJsonData>({
        name: GRAFANA_RULES_SOURCE_NAME,
        type: DataSourceType.Alertmanager,
      })
    );

    grantUserPermissions([AccessControlAction.AlertingNotificationsRead]);

    const { result } = renderHook(
      () =>
        useAlertmanagerAbilityStates([
          AlertmanagerAction.ViewContactPoint,
          AlertmanagerAction.CreateContactPoint,
          AlertmanagerAction.ExportContactPoint,
        ]),
      { wrapper: createAlertmanagerWrapper(GRAFANA_RULES_SOURCE_NAME) }
    );

    expect(result.current).toHaveLength(3);
    // ViewContactPoint — read permission was granted
    expect(result.current[0].granted).toBe(true);
    // CreateContactPoint — applicable but not granted (no write permission)
    expect(isAvailable(result.current[1])).toBe(true);
    expect(result.current[1].granted).toBe(false);
    expect(isInsufficientPermissions(result.current[1])).toBe(true);
    // ExportContactPoint — granted (Grafana AM supports export; view implies export)
    expect(result.current[2].granted).toBe(true);
  });
});

function createAlertmanagerWrapper(alertmanagerSourceName: string) {
  const ProviderWrapper = getWrapper({ renderWithRouter: true });
  return (props: PropsWithChildren) => (
    <ProviderWrapper>
      <AlertmanagerProvider accessType={'notification'} alertmanagerSourceName={alertmanagerSourceName}>
        {props.children}
      </AlertmanagerProvider>
    </ProviderWrapper>
  );
}
