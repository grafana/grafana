import { contextSrv } from 'app/core/services/context_srv';
import { AccessControlAction } from 'app/types/accessControl';

// Page-level access predicates shared between the navigation tree (item
// visibility) and route guards (redirect on direct navigation), so the two
// can't drift apart. Kept as a leaf module (no ability-system imports): the
// nav tree builder calls these during redux store creation.

const hasAny = (...actions: string[]) => actions.some((action) => contextSrv.hasPermission(action));

export const alertRulesAccess = () =>
  hasAny(AccessControlAction.AlertingRuleRead, AccessControlAction.AlertingRuleExternalRead);

export const alertInstanceAccess = () =>
  hasAny(AccessControlAction.AlertingInstanceRead, AccessControlAction.AlertingInstancesExternalRead);

export const silencesAccess = () =>
  hasAny(
    AccessControlAction.AlertingInstanceRead,
    AccessControlAction.AlertingInstancesExternalRead,
    AccessControlAction.AlertingSilenceRead
  );

export const contactPointsAccess = () =>
  hasAny(
    AccessControlAction.AlertingNotificationsRead,
    AccessControlAction.AlertingNotificationsExternalRead,
    AccessControlAction.AlertingReceiversRead,
    AccessControlAction.AlertingReceiversReadSecrets,
    AccessControlAction.AlertingReceiversCreate,
    AccessControlAction.AlertingTemplatesRead,
    AccessControlAction.AlertingTemplatesWrite,
    AccessControlAction.AlertingTemplatesDelete
  );

export const notificationPoliciesAccess = () =>
  hasAny(
    AccessControlAction.AlertingNotificationsRead,
    AccessControlAction.AlertingNotificationsExternalRead,
    AccessControlAction.AlertingRoutesRead,
    AccessControlAction.AlertingRoutesWrite,
    AccessControlAction.AlertingTimeIntervalsRead,
    AccessControlAction.AlertingTimeIntervalsWrite,
    AccessControlAction.ActionAlertingManagedRoutesRead,
    AccessControlAction.ActionAlertingManagedRoutesWrite
  );
