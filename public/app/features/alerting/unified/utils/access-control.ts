import { AccessControlAction } from 'app/types';
import { isGrafanaRulesSource } from './datasource';
import { contextSrv } from 'app/core/services/context_srv';

type RulesSourceType = 'grafana' | 'external';

function getRulesSourceType(alertManagerSourceName: string): RulesSourceType {
  return isGrafanaRulesSource(alertManagerSourceName) ? 'grafana' : 'external';
}

export function getInstancesPermissions(rulesSourceName: string) {
  const sourceType = getRulesSourceType(rulesSourceName);

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
  };

  return {
    read: permissions.read[sourceType],
    create: permissions.create[sourceType],
    update: permissions.update[sourceType],
    delete: permissions.delete[sourceType],
  };
}

export function getNotificationsPermissions(rulesSourceName: string) {
  const sourceType = getRulesSourceType(rulesSourceName);

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
    read: permissions.read[sourceType],
    create: permissions.create[sourceType],
    update: permissions.update[sourceType],
    delete: permissions.delete[sourceType],
  };
}

export function getRulesPermissions(rulesSourceName: string) {
  const sourceType = getRulesSourceType(rulesSourceName);

  const permissions = {
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

  return {
    read: permissions.read[sourceType],
    create: permissions.create[sourceType],
    update: permissions.update[sourceType],
    delete: permissions.delete[sourceType],
  };
}

export function evaluateAccess(actions: AccessControlAction[], fallBackUserRoles: string[]) {
  return () => {
    return contextSrv.evaluatePermission(() => fallBackUserRoles, actions);
  };
}
