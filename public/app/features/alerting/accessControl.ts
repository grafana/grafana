import { contextSrv } from 'app/core/services/context_srv';
import { AccessControlAction } from 'app/types';
import { isGrafanaRulesSource } from './unified/utils/datasource';

function getDSVersion(alertManagerSourceName: string) {
  return isGrafanaRulesSource(alertManagerSourceName) ? 'grafana' : 'external';
}

export function getRulesPermissions(dataSourceName: string) {
  const dsVersion = getDSVersion(dataSourceName);

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
    read: permissions.read[dsVersion],
    create: permissions.create[dsVersion],
    update: permissions.update[dsVersion],
    delete: permissions.delete[dsVersion],
  };
}

export function evaluateAccess(actions: AccessControlAction[], fallBackUserRoles: string[]) {
  return () => {
    return contextSrv.evaluatePermission(() => fallBackUserRoles, actions);
  };
}
