import { OrgRole } from '@grafana/data';
import { contextSrv } from 'app/core/services/context_srv';
import { AlertManagerImplementation } from 'app/plugins/datasource/alertmanager/types';

import { useAlertmanager } from '../state/AlertmanagerContext';
import { getNotificationsPermissions } from '../utils/access-control';
import { GRAFANA_DATASOURCE_NAME } from '../utils/datasource';

const { hasAccess, hasRole } = contextSrv;

export enum Action {
  // contact points
  CreateContactPoint,
  ViewContactPoints,
  EditContactPoint,
  DeleteContactPoint,
  ExportContactPoint,
}

type Ability = [actionSupported: boolean, actionPermitted: boolean];
type Abilities = Record<Action, Ability>;

const RULER_ENABLED_ALERTMANAGER_FLAVORS = [AlertManagerImplementation.mimir, AlertManagerImplementation.cortex];

/**
 * This hook will determine if
 *  1. action is supported in the current alertmanager context
 *  2. user is allowed to perform actions based on their set of permissions / assigned role
 */
function useAbilities(): Abilities {
  const { selectedAlertmanager, selectedAlertmanagerConfig } = useAlertmanager();

  // determine if we're dealing with an Alertmanager data source that supports the ruler API
  const isGrafanaFlavoredAlertmanager = selectedAlertmanager === GRAFANA_DATASOURCE_NAME;
  const isRulerFlavoredAlertmanager = RULER_ENABLED_ALERTMANAGER_FLAVORS.includes(
    selectedAlertmanagerConfig?.implementation!
  );

  const hasRuler = isGrafanaFlavoredAlertmanager || isRulerFlavoredAlertmanager;

  // These are used for interacting with Alertmanager resources where we apply alert.notifications:<name> permissions.
  // There are different permissions based on wether the built-in alertmanager is selected (grafana) or an external one.
  const notificationsPermissions = getNotificationsPermissions(selectedAlertmanager!);

  // list out all of the abilities, and if the user has permissions to perform them
  const abilities: Abilities = {
    // contact points
    [Action.CreateContactPoint]: [hasRuler, hasAccess(notificationsPermissions.create, hasRole(OrgRole.Editor))],
    [Action.ViewContactPoints]: [hasRuler, hasAccess(notificationsPermissions.read, hasRole(OrgRole.Viewer))],
    [Action.EditContactPoint]: [hasRuler, hasAccess(notificationsPermissions.update, hasRole(OrgRole.Editor))],
    [Action.DeleteContactPoint]: [hasRuler, hasAccess(notificationsPermissions.delete, hasRole(OrgRole.Admin))],
    [Action.ExportContactPoint]: [
      hasRuler,
      hasAccess(notificationsPermissions.provisioning.read, hasRole(OrgRole.Viewer)),
    ],
  };

  return abilities;
}

export default useAbilities;
