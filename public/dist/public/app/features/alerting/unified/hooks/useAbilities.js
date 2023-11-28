import { useMemo } from 'react';
import { contextSrv as ctx } from 'app/core/services/context_srv';
import { AccessControlAction } from 'app/types';
import { useAlertmanager } from '../state/AlertmanagerContext';
import { getInstancesPermissions, getNotificationsPermissions } from '../utils/access-control';
/**
 * These hooks will determine if
 *  1. the action is supported in the current alertmanager or data source context
 *  2. user is allowed to perform actions based on their set of permissions / assigned role
 */
export var AlertmanagerAction;
(function (AlertmanagerAction) {
    // configuration
    AlertmanagerAction["ViewExternalConfiguration"] = "view-external-configuration";
    AlertmanagerAction["UpdateExternalConfiguration"] = "update-external-configuration";
    // contact points
    AlertmanagerAction["CreateContactPoint"] = "create-contact-point";
    AlertmanagerAction["ViewContactPoint"] = "view-contact-point";
    AlertmanagerAction["UpdateContactPoint"] = "edit-contact-points";
    AlertmanagerAction["DeleteContactPoint"] = "delete-contact-point";
    AlertmanagerAction["ExportContactPoint"] = "export-contact-point";
    // notification templates
    AlertmanagerAction["CreateNotificationTemplate"] = "create-notification-template";
    AlertmanagerAction["ViewNotificationTemplate"] = "view-notification-template";
    AlertmanagerAction["UpdateNotificationTemplate"] = "edit-notification-template";
    AlertmanagerAction["DeleteNotificationTemplate"] = "delete-notification-template";
    AlertmanagerAction["DecryptSecrets"] = "decrypt-secrets";
    // notification policies
    AlertmanagerAction["CreateNotificationPolicy"] = "create-notification-policy";
    AlertmanagerAction["ViewNotificationPolicyTree"] = "view-notification-policy-tree";
    AlertmanagerAction["UpdateNotificationPolicyTree"] = "update-notification-policy-tree";
    AlertmanagerAction["DeleteNotificationPolicy"] = "delete-notification-policy";
    AlertmanagerAction["ExportNotificationPolicies"] = "export-notification-policies";
    // silences – these cannot be deleted only "expired" (updated)
    AlertmanagerAction["CreateSilence"] = "create-silence";
    AlertmanagerAction["ViewSilence"] = "view-silence";
    AlertmanagerAction["UpdateSilence"] = "update-silence";
    // mute timings
    AlertmanagerAction["ViewMuteTiming"] = "view-mute-timing";
    AlertmanagerAction["CreateMuteTiming"] = "create-mute-timing";
    AlertmanagerAction["UpdateMuteTiming"] = "update-mute-timing";
    AlertmanagerAction["DeleteMuteTiming"] = "delete-mute-timing";
})(AlertmanagerAction || (AlertmanagerAction = {}));
export var AlertSourceAction;
(function (AlertSourceAction) {
    // internal (Grafana managed)
    AlertSourceAction["CreateAlertRule"] = "create-alert-rule";
    AlertSourceAction["ViewAlertRule"] = "view-alert-rule";
    AlertSourceAction["UpdateAlertRule"] = "update-alert-rule";
    AlertSourceAction["DeleteAlertRule"] = "delete-alert-rule";
    // external (any compatible alerting data source)
    AlertSourceAction["CreateExternalAlertRule"] = "create-external-alert-rule";
    AlertSourceAction["ViewExternalAlertRule"] = "view-external-alert-rule";
    AlertSourceAction["UpdateExternalAlertRule"] = "update-external-alert-rule";
    AlertSourceAction["DeleteExternalAlertRule"] = "delete-external-alert-rule";
})(AlertSourceAction || (AlertSourceAction = {}));
const AlwaysSupported = true; // this just makes it easier to understand the code
export function useAlertSourceAbilities() {
    // TODO add the "supported" booleans here, we currently only do authorization
    const abilities = {
        // -- Grafana managed alert rules --
        [AlertSourceAction.CreateAlertRule]: [AlwaysSupported, ctx.hasPermission(AccessControlAction.AlertingRuleCreate)],
        [AlertSourceAction.ViewAlertRule]: [AlwaysSupported, ctx.hasPermission(AccessControlAction.AlertingRuleRead)],
        [AlertSourceAction.UpdateAlertRule]: [AlwaysSupported, ctx.hasPermission(AccessControlAction.AlertingRuleUpdate)],
        [AlertSourceAction.DeleteAlertRule]: [AlwaysSupported, ctx.hasPermission(AccessControlAction.AlertingRuleDelete)],
        // -- External alert rules (Mimir / Loki / etc) --
        // for these we only have "read" and "write" permissions
        [AlertSourceAction.CreateExternalAlertRule]: [
            AlwaysSupported,
            ctx.hasPermission(AccessControlAction.AlertingRuleExternalWrite),
        ],
        [AlertSourceAction.ViewExternalAlertRule]: [
            AlwaysSupported,
            ctx.hasPermission(AccessControlAction.AlertingRuleExternalRead),
        ],
        [AlertSourceAction.UpdateExternalAlertRule]: [
            AlwaysSupported,
            ctx.hasPermission(AccessControlAction.AlertingRuleExternalWrite),
        ],
        [AlertSourceAction.DeleteExternalAlertRule]: [
            AlwaysSupported,
            ctx.hasPermission(AccessControlAction.AlertingRuleExternalWrite),
        ],
    };
    return abilities;
}
export function useAllAlertmanagerAbilities() {
    const { selectedAlertmanager, hasConfigurationAPI, isGrafanaAlertmanager: isGrafanaFlavoredAlertmanager, } = useAlertmanager();
    // These are used for interacting with Alertmanager resources where we apply alert.notifications:<name> permissions.
    // There are different permissions based on wether the built-in alertmanager is selected (grafana) or an external one.
    const notificationsPermissions = getNotificationsPermissions(selectedAlertmanager);
    const instancePermissions = getInstancesPermissions(selectedAlertmanager);
    // list out all of the abilities, and if the user has permissions to perform them
    const abilities = {
        // -- configuration --
        [AlertmanagerAction.ViewExternalConfiguration]: [
            AlwaysSupported,
            ctx.hasPermission(AccessControlAction.AlertingNotificationsExternalRead),
        ],
        [AlertmanagerAction.UpdateExternalConfiguration]: [
            hasConfigurationAPI,
            ctx.hasPermission(AccessControlAction.AlertingNotificationsExternalWrite),
        ],
        // -- contact points --
        [AlertmanagerAction.CreateContactPoint]: [hasConfigurationAPI, ctx.hasPermission(notificationsPermissions.create)],
        [AlertmanagerAction.ViewContactPoint]: [AlwaysSupported, ctx.hasPermission(notificationsPermissions.read)],
        [AlertmanagerAction.UpdateContactPoint]: [hasConfigurationAPI, ctx.hasPermission(notificationsPermissions.update)],
        [AlertmanagerAction.DeleteContactPoint]: [hasConfigurationAPI, ctx.hasPermission(notificationsPermissions.delete)],
        // only Grafana flavored alertmanager supports exporting
        [AlertmanagerAction.ExportContactPoint]: [
            isGrafanaFlavoredAlertmanager,
            ctx.hasPermission(notificationsPermissions.provisioning.read) ||
                ctx.hasPermission(notificationsPermissions.provisioning.readSecrets),
        ],
        // -- notification templates --
        [AlertmanagerAction.CreateNotificationTemplate]: [
            hasConfigurationAPI,
            ctx.hasPermission(notificationsPermissions.create),
        ],
        [AlertmanagerAction.ViewNotificationTemplate]: [AlwaysSupported, ctx.hasPermission(notificationsPermissions.read)],
        [AlertmanagerAction.UpdateNotificationTemplate]: [
            hasConfigurationAPI,
            ctx.hasPermission(notificationsPermissions.update),
        ],
        [AlertmanagerAction.DeleteNotificationTemplate]: [
            hasConfigurationAPI,
            ctx.hasPermission(notificationsPermissions.delete),
        ],
        // -- notification policies --
        [AlertmanagerAction.CreateNotificationPolicy]: [
            hasConfigurationAPI,
            ctx.hasPermission(notificationsPermissions.create),
        ],
        [AlertmanagerAction.ViewNotificationPolicyTree]: [
            AlwaysSupported,
            ctx.hasPermission(notificationsPermissions.read),
        ],
        [AlertmanagerAction.UpdateNotificationPolicyTree]: [
            hasConfigurationAPI,
            ctx.hasPermission(notificationsPermissions.update),
        ],
        [AlertmanagerAction.DeleteNotificationPolicy]: [
            hasConfigurationAPI,
            ctx.hasPermission(notificationsPermissions.delete),
        ],
        [AlertmanagerAction.ExportNotificationPolicies]: [
            isGrafanaFlavoredAlertmanager,
            ctx.hasPermission(notificationsPermissions.provisioning.read) ||
                ctx.hasPermission(notificationsPermissions.provisioning.readSecrets),
        ],
        [AlertmanagerAction.DecryptSecrets]: [
            isGrafanaFlavoredAlertmanager,
            ctx.hasPermission(notificationsPermissions.provisioning.readSecrets),
        ],
        // -- silences --
        [AlertmanagerAction.CreateSilence]: [hasConfigurationAPI, ctx.hasPermission(instancePermissions.create)],
        [AlertmanagerAction.ViewSilence]: [AlwaysSupported, ctx.hasPermission(instancePermissions.read)],
        [AlertmanagerAction.UpdateSilence]: [hasConfigurationAPI, ctx.hasPermission(instancePermissions.update)],
        // -- mute timtings --
        [AlertmanagerAction.CreateMuteTiming]: [hasConfigurationAPI, ctx.hasPermission(notificationsPermissions.create)],
        [AlertmanagerAction.ViewMuteTiming]: [AlwaysSupported, ctx.hasPermission(notificationsPermissions.read)],
        [AlertmanagerAction.UpdateMuteTiming]: [hasConfigurationAPI, ctx.hasPermission(notificationsPermissions.update)],
        [AlertmanagerAction.DeleteMuteTiming]: [hasConfigurationAPI, ctx.hasPermission(notificationsPermissions.delete)],
    };
    return abilities;
}
export function useAlertmanagerAbility(action) {
    const abilities = useAllAlertmanagerAbilities();
    return useMemo(() => {
        return abilities[action];
    }, [abilities, action]);
}
export function useAlertmanagerAbilities(actions) {
    const abilities = useAllAlertmanagerAbilities();
    return useMemo(() => {
        return actions.map((action) => abilities[action]);
    }, [abilities, actions]);
}
export function useAlertSourceAbility(action) {
    const abilities = useAlertSourceAbilities();
    return useMemo(() => abilities[action], [abilities, action]);
}
//# sourceMappingURL=useAbilities.js.map