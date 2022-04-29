import { contextSrv } from 'app/core/services/context_srv';
import { AccessControlAction } from 'app/types';

import { isGrafanaRulesSource } from './datasource';

type RulesSourceType = 'grafana' | 'external';

function getRulesSourceType(alertManagerSourceName: string): RulesSourceType {
  return isGrafanaRulesSource(alertManagerSourceName) ? 'grafana' : 'external';
}

const instancesPermissions = {
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
};

const notificationsPermissions = {
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

const rulesPermissions = {
  read: {
    grafana: AccessControlAction.AlertingRuleRead,
    external: AccessControlAction.AlertingRuleExternalRead,
  },
  create: {
    grafana: AccessControlAction.AlertingRuleCreate,
    external: AccessControlAction.AlertingRuleExternalWrite,
  },
  update: {
    grafana: AccessControlAction.AlertingRuleUpdate,
    external: AccessControlAction.AlertingRuleExternalWrite,
  },
  delete: {
    grafana: AccessControlAction.AlertingRuleDelete,
    external: AccessControlAction.AlertingRuleExternalWrite,
  },
};

export function getInstancesPermissions(rulesSourceName: string) {
  const sourceType = getRulesSourceType(rulesSourceName);

  return {
    read: instancesPermissions.read[sourceType],
    create: instancesPermissions.create[sourceType],
    update: instancesPermissions.update[sourceType],
    delete: instancesPermissions.delete[sourceType],
  };
}

export function getNotificationsPermissions(rulesSourceName: string) {
  const sourceType = getRulesSourceType(rulesSourceName);

  return {
    read: notificationsPermissions.read[sourceType],
    create: notificationsPermissions.create[sourceType],
    update: notificationsPermissions.update[sourceType],
    delete: notificationsPermissions.delete[sourceType],
  };
}

export function getRulesPermissions(rulesSourceName: string) {
  const sourceType = getRulesSourceType(rulesSourceName);

  return {
    read: rulesPermissions.read[sourceType],
    create: rulesPermissions.create[sourceType],
    update: rulesPermissions.update[sourceType],
    delete: rulesPermissions.delete[sourceType],
  };
}

export function evaluateAccess(actions: AccessControlAction[], fallBackUserRoles: string[]) {
  return () => {
    return contextSrv.evaluatePermission(() => fallBackUserRoles, actions);
  };
}

export function getRulesAccess() {
  return {
    canCreateGrafanaRules:
      contextSrv.hasAccess(AccessControlAction.FoldersRead, contextSrv.isEditor) &&
      contextSrv.hasAccess(rulesPermissions.create.grafana, contextSrv.isEditor),
    canCreateCloudRules:
      contextSrv.hasAccess(AccessControlAction.DataSourcesRead, contextSrv.isEditor) &&
      contextSrv.hasAccess(rulesPermissions.create.external, contextSrv.isEditor),
    canEditRules: (rulesSourceName: string) =>
      contextSrv.hasAccess(getRulesPermissions(rulesSourceName).update, contextSrv.isEditor),
  };
}
