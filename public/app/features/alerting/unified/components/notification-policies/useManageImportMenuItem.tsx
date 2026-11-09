import { type JSX } from 'react';

import { OrgRole } from '@grafana/data';
import { t } from '@grafana/i18n';
import { Menu } from '@grafana/ui';
import { contextSrv } from 'app/core/services/context_srv';
import { type RouteWithID } from 'app/plugins/datasource/alertmanager/types';

import { alertmanagerApi } from '../../api/alertmanagerApi';
import { useIsAlertmanagerImportEnabled } from '../../featureToggles';
import { ALERTING_IMPORT_SETTINGS_URL } from '../../settings/navigation';
import { KnownProvenance } from '../../types/knownProvenance';
import { GRAFANA_RULES_SOURCE_NAME } from '../../utils/datasource';
import { WithReturnButton } from '../WithReturnButton';

/**
 * A "Manage in Import settings" menu item for the policy tree of the staged Alertmanager import, which
 * is promoted, reverted and kept in sync from the Import settings tab.
 *
 * The routing tree only says it was imported (by its provenance), not whether it is still the staged
 * import, so the tree is matched against the staged config's identifier, which is also the tree's
 * name. The Import settings tab is admin-only.
 */
export function useManageImportMenuItem(
  currentRoute: RouteWithID,
  provenance: string | undefined,
  isDefaultPolicy: boolean
): JSX.Element | null {
  const alertmanagerImportEnabled = useIsAlertmanagerImportEnabled();
  const isTreeRoot = isDefaultPolicy && Boolean(currentRoute.name);
  const mightBeStagedImport =
    alertmanagerImportEnabled &&
    isTreeRoot &&
    provenance === KnownProvenance.ConvertedPrometheus &&
    contextSrv.hasRole(OrgRole.Admin);

  const { stagedIdentifier } = alertmanagerApi.endpoints.getAlertmanagerConfiguration.useQuery(
    GRAFANA_RULES_SOURCE_NAME,
    {
      skip: !mightBeStagedImport,
      // There is at most one staged import.
      selectFromResult: ({ data }) => ({ stagedIdentifier: data?.extra_config?.[0]?.identifier }),
    }
  );

  if (!mightBeStagedImport || !stagedIdentifier || stagedIdentifier !== currentRoute.name) {
    return null;
  }

  return (
    <WithReturnButton
      key="manage-import"
      title={t('alerting.policies.manage-import.return-title', 'Notification policies')}
      component={
        <Menu.Item
          icon="cloud-upload"
          label={t('alerting.policies.manage-import.label', 'Manage in Import settings')}
          url={ALERTING_IMPORT_SETTINGS_URL}
        />
      }
    />
  );
}
