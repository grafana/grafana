import { AccessControlAction } from 'app/types';
import { isGrafanaRulesSource } from './datasource';
import { contextSrv } from 'app/core/services/context_srv';

function getAMversion(alertManagerSourceName: string) {
  return isGrafanaRulesSource(alertManagerSourceName) ? 'grafana' : 'external';
}

export function getInstancesPermissions(alertManagerSourceName: string) {
  const amVersion = getAMversion(alertManagerSourceName);

  const permissions = {
    read: {
      grafana: AccessControlAction.AlertingInstanceRead,
      external: AccessControlAction.AlertingInstancesExternalRead,
    },
    create: {
      grafana: AccessControlAction.AlertingInstanceCreate,
      external: AccessControlAction.AlertingInstancesExternalWrite,
    },
    update: {
      grafana: AccessControlAction.AlertingInstanceUpdate,
      external: AccessControlAction.AlertingInstancesExternalWrite,
    },
    delete: {
      grafana: AccessControlAction.AlertingInstanceUpdate,
      external: AccessControlAction.AlertingInstancesExternalWrite,
    },
    viewSource: {
      grafana: AccessControlAction.AlertingInstanceRead,
      external: AccessControlAction.DataSourcesExplore,
    },
  };

  return {
    read: permissions.read[amVersion],
    create: permissions.create[amVersion],
    update: permissions.update[amVersion],
    delete: permissions.delete[amVersion],
    viewSource: permissions.viewSource[amVersion],
  };
}

export function getNotificationsPermissions(alertManagerSourceName: string) {
  const amVersion = getAMversion(alertManagerSourceName);

  const permissions = {
    read: {
      grafana: AccessControlAction.AlertingNotificationsRead,
      external: AccessControlAction.AlertingNotificationsExternalRead,
    },
    create: {
      grafana: AccessControlAction.AlertingNotificationsCreate,
      external: AccessControlAction.AlertingNotificationsExternalWrite,
    },
    update: {
      grafana: AccessControlAction.AlertingNotificationsUpdate,
      external: AccessControlAction.AlertingNotificationsExternalWrite,
    },
    delete: {
      grafana: AccessControlAction.AlertingNotificationsDelete,
      external: AccessControlAction.AlertingNotificationsExternalWrite,
    },
  };

  return {
    read: permissions.read[amVersion],
    create: permissions.create[amVersion],
    update: permissions.update[amVersion],
    delete: permissions.delete[amVersion],
  };
}

export function evaluateAccess(actions: AccessControlAction[], fallBackUserRoles: string[]) {
  return () => {
    return contextSrv.evaluatePermission(() => fallBackUserRoles, actions);
  };
}
