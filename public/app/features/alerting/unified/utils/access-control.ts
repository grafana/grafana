import { getConfig } from 'app/core/config';
import { contextSrv } from 'app/core/services/context_srv';
import { AccessControlAction } from 'app/types/accessControl';

import { GRAFANA_RULES_SOURCE_NAME, isGrafanaRulesSource } from './datasource';

type RulesSourceType = 'grafana' | 'external';

function getRulesSourceType(alertManagerSourceName: string): RulesSourceType {
  return isGrafanaRulesSource(alertManagerSourceName) ? 'grafana' : 'external';
}

export const instancesPermissions = {
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

export const notificationsPermissions = {
  read: {
    grafana: AccessControlAction.AlertingNotificationsRead,
    external: AccessControlAction.AlertingNotificationsExternalRead,
  },
  create: {
    grafana: AccessControlAction.AlertingNotificationsWrite,
    external: AccessControlAction.AlertingNotificationsExternalWrite,
  },
  update: {
    grafana: AccessControlAction.AlertingNotificationsWrite,
    external: AccessControlAction.AlertingNotificationsExternalWrite,
  },
  delete: {
    grafana: AccessControlAction.AlertingNotificationsWrite,
    external: AccessControlAction.AlertingNotificationsExternalWrite,
  },
};

export const silencesPermissions = {
  read: {
    grafana: AccessControlAction.AlertingSilenceRead,
    external: AccessControlAction.AlertingInstanceRead,
  },
  create: {
    grafana: AccessControlAction.AlertingSilenceCreate,
    external: AccessControlAction.AlertingInstancesExternalWrite,
  },
  update: {
    grafana: AccessControlAction.AlertingSilenceUpdate,
    external: AccessControlAction.AlertingInstancesExternalWrite,
  },
};

export const provisioningPermissions = {
  read: AccessControlAction.AlertingProvisioningRead,
  readSecrets: AccessControlAction.AlertingProvisioningReadSecrets,
  write: AccessControlAction.AlertingProvisioningWrite,
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
    provisioning: provisioningPermissions,
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

export function evaluateAccess(actions: AccessControlAction[]) {
  return () => {
    return contextSrv.evaluatePermission(actions);
  };
}

export function getRulesAccess() {
  return {
    canCreateGrafanaRules:
      contextSrv.hasPermission(AccessControlAction.FoldersRead) &&
      contextSrv.hasPermission(rulesPermissions.create.grafana),
    canCreateCloudRules:
      contextSrv.hasPermission(AccessControlAction.DataSourcesRead) &&
      contextSrv.hasPermission(rulesPermissions.create.external),
    canEditRules: (rulesSourceName: string) => {
      return contextSrv.hasPermission(getRulesPermissions(rulesSourceName).update);
    },
  };
}

export function getCreateAlertInMenuAvailability() {
  const { unifiedAlertingEnabled } = getConfig();
  const hasRuleReadPermissions = contextSrv.hasPermission(getRulesPermissions(GRAFANA_RULES_SOURCE_NAME).read);
  const hasRuleUpdatePermissions = contextSrv.hasPermission(getRulesPermissions(GRAFANA_RULES_SOURCE_NAME).update);
  const isAlertingAvailableForRead = unifiedAlertingEnabled && hasRuleReadPermissions;

  return isAlertingAvailableForRead && hasRuleUpdatePermissions;
}
