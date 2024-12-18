import { SafeDynamicImport } from 'app/core/components/DynamicImports/SafeDynamicImport';
import { config } from 'app/core/config';
import { GrafanaRouteComponent, RouteDescriptor } from 'app/core/navigation/types';
import { AccessControlAction } from 'app/types';

import { PERMISSIONS_CONTACT_POINTS } from './unified/components/contact-points/permissions';
import {
  PERMISSIONS_TIME_INTERVALS_MODIFY,
  PERMISSIONS_TIME_INTERVALS_READ,
} from './unified/components/mute-timings/permissions';
import {
  PERMISSIONS_NOTIFICATION_POLICIES_MODIFY,
  PERMISSIONS_NOTIFICATION_POLICIES_READ,
} from './unified/components/notification-policies/permissions';
import { PERMISSIONS_TEMPLATES } from './unified/components/templates/permissions';
import { evaluateAccess } from './unified/utils/access-control';

export function getAlertingRoutes(cfg = config): RouteDescriptor[] {
  const routes = [
    {
      path: '/alerting',
      component: importAlertingComponent(
        () => import(/* webpackChunkName: "AlertingHome" */ 'app/features/alerting/unified/home/Home')
      ),
    },
    {
      path: '/alerting/home',
      component: importAlertingComponent(
        () => import(/* webpackChunkName: "AlertingHome" */ 'app/features/alerting/unified/home/Home')
      ),
    },
    {
      path: '/alerting/list',
      roles: evaluateAccess([AccessControlAction.AlertingRuleRead, AccessControlAction.AlertingRuleExternalRead]),
      component: importAlertingComponent(
        () => import(/* webpackChunkName: "AlertRuleListIndex" */ 'app/features/alerting/unified/RuleList')
      ),
    },
    {
      path: '/alerting/routes',
      roles: evaluateAccess([
        AccessControlAction.AlertingNotificationsRead,
        AccessControlAction.AlertingNotificationsExternalRead,
        ...PERMISSIONS_NOTIFICATION_POLICIES_READ,
        ...PERMISSIONS_NOTIFICATION_POLICIES_MODIFY,
        ...PERMISSIONS_TIME_INTERVALS_READ,
        ...PERMISSIONS_TIME_INTERVALS_MODIFY,
      ]),
      component: importAlertingComponent(
        () =>
          import(
            /* webpackChunkName: "NotificationPoliciesPage" */ 'app/features/alerting/unified/NotificationPoliciesPage'
          )
      ),
    },
    {
      path: '/alerting/routes/mute-timing/new',
      roles: evaluateAccess([
        AccessControlAction.AlertingNotificationsWrite,
        AccessControlAction.AlertingNotificationsExternalWrite,
        ...PERMISSIONS_TIME_INTERVALS_MODIFY,
      ]),
      component: importAlertingComponent(
        () =>
          import(
            /* webpackChunkName: "NewMuteTiming" */ 'app/features/alerting/unified/components/mute-timings/NewMuteTiming'
          )
      ),
    },
    {
      path: '/alerting/routes/mute-timing/edit',
      roles: evaluateAccess([
        AccessControlAction.AlertingNotificationsWrite,
        AccessControlAction.AlertingNotificationsExternalWrite,
        ...PERMISSIONS_TIME_INTERVALS_READ,
        ...PERMISSIONS_TIME_INTERVALS_MODIFY,
      ]),
      component: importAlertingComponent(
        () =>
          import(
            /* webpackChunkName: "EditMuteTiming" */ 'app/features/alerting/unified/components/mute-timings/EditMuteTiming'
          )
      ),
    },
    {
      path: '/alerting/silences',
      roles: evaluateAccess([
        AccessControlAction.AlertingInstanceRead,
        AccessControlAction.AlertingInstancesExternalRead,
        AccessControlAction.AlertingSilenceRead,
      ]),
      component: importAlertingComponent(
        () =>
          import(
            /* webpackChunkName: "SilencesTablePage" */ 'app/features/alerting/unified/components/silences/SilencesTable'
          )
      ),
    },
    {
      path: '/alerting/silence/new',
      roles: evaluateAccess([
        AccessControlAction.AlertingInstanceCreate,
        AccessControlAction.AlertingInstancesExternalWrite,
        AccessControlAction.AlertingSilenceCreate,
        AccessControlAction.AlertingSilenceUpdate,
      ]),
      component: importAlertingComponent(
        () => import(/* webpackChunkName: "NewSilencePage" */ 'app/features/alerting/unified/NewSilencePage')
      ),
    },
    {
      path: '/alerting/silence/:id/edit',
      component: importAlertingComponent(
        () =>
          import(
            /* webpackChunkName: "ExistingSilenceEditorPage" */ 'app/features/alerting/unified/components/silences/SilencesEditor'
          )
      ),
    },
    {
      path: '/alerting/notifications',
      roles: evaluateAccess([
        AccessControlAction.AlertingNotificationsRead,
        AccessControlAction.AlertingNotificationsExternalRead,
        ...PERMISSIONS_CONTACT_POINTS,
        ...PERMISSIONS_TEMPLATES,
      ]),
      component: importAlertingComponent(
        () =>
          import(
            /* webpackChunkName: "ContactPoints" */ 'app/features/alerting/unified/components/contact-points/ContactPoints'
          )
      ),
    },
    {
      path: '/alerting/notifications/receivers/new',
      roles: evaluateAccess([
        AccessControlAction.AlertingNotificationsRead,
        AccessControlAction.AlertingNotificationsExternalRead,
        ...PERMISSIONS_CONTACT_POINTS,
      ]),
      component: importAlertingComponent(
        () =>
          import(
            /* webpackChunkName: "NewReceiverView" */ 'app/features/alerting/unified/components/receivers/NewReceiverView'
          )
      ),
    },
    {
      path: '/alerting/notifications/receivers/:name/edit',
      roles: evaluateAccess([
        AccessControlAction.AlertingNotificationsWrite,
        AccessControlAction.AlertingNotificationsExternalWrite,
        AccessControlAction.AlertingNotificationsRead,
        AccessControlAction.AlertingNotificationsExternalRead,
        // We check any contact point permission here because a user without edit permissions
        // still has to be able to visit the "edit" page, because we don't have a separate view for edit vs view
        // (we just disable the form instead)
        ...PERMISSIONS_CONTACT_POINTS,
      ]),
      component: importAlertingComponent(
        () =>
          import(
            /* webpackChunkName: "EditContactPoint" */ 'app/features/alerting/unified/components/contact-points/EditContactPoint'
          )
      ),
    },
    {
      path: '/alerting/notifications/templates/*',
      roles: evaluateAccess([
        AccessControlAction.AlertingNotificationsRead,
        AccessControlAction.AlertingNotificationsExternalRead,
        ...PERMISSIONS_TEMPLATES,
      ]),
      component: importAlertingComponent(
        () => import(/* webpackChunkName: "Templates" */ 'app/features/alerting/unified/Templates')
      ),
    },
    {
      path: '/alerting/notifications/global-config',
      roles: evaluateAccess([
        AccessControlAction.AlertingNotificationsWrite,
        AccessControlAction.AlertingNotificationsExternalWrite,
      ]),
      component: importAlertingComponent(
        () =>
          import(
            /* webpackChunkName: "GlobalConfig" */ 'app/features/alerting/unified/components/contact-points/components/GlobalConfig'
          )
      ),
    },
    {
      path: '/alerting/groups/',
      roles: evaluateAccess([
        AccessControlAction.AlertingInstanceRead,
        AccessControlAction.AlertingInstancesExternalRead,
      ]),
      component: importAlertingComponent(
        () => import(/* webpackChunkName: "AlertGroups" */ 'app/features/alerting/unified/AlertGroups')
      ),
    },
    {
      path: '/alerting/history/',
      roles: evaluateAccess([AccessControlAction.AlertingRuleRead]),
      component: importAlertingComponent(
        () =>
          import(
            /* webpackChunkName: "HistoryPage" */ 'app/features/alerting/unified/components/rules/central-state-history/CentralAlertHistoryPage'
          )
      ),
    },
    {
      path: '/alerting/new/:type?',
      pageClass: 'page-alerting',
      roles: evaluateAccess([AccessControlAction.AlertingRuleCreate, AccessControlAction.AlertingRuleExternalWrite]),
      component: importAlertingComponent(
        () => import(/* webpackChunkName: "AlertingRuleForm"*/ 'app/features/alerting/unified/RuleEditor')
      ),
    },
    {
      path: '/alerting/:id/edit',
      pageClass: 'page-alerting',
      roles: evaluateAccess([AccessControlAction.AlertingRuleUpdate, AccessControlAction.AlertingRuleExternalWrite]),
      component: importAlertingComponent(
        () => import(/* webpackChunkName: "AlertingRuleForm"*/ 'app/features/alerting/unified/RuleEditor')
      ),
    },
    {
      path: '/alerting/:id/modify-export',
      pageClass: 'page-alerting',
      roles: evaluateAccess([AccessControlAction.AlertingRuleRead]),
      component: importAlertingComponent(
        () =>
          import(
            /* webpackChunkName: "AlertingRuleForm"*/ 'app/features/alerting/unified/components/export/GrafanaModifyExport'
          )
      ),
    },
    {
      path: '/alerting/export-new-rule',
      pageClass: 'page-alerting',
      roles: evaluateAccess([AccessControlAction.AlertingRuleRead]),
      component: importAlertingComponent(
        () =>
          import(
            /* webpackChunkName: "AlertingRuleForm"*/ 'app/features/alerting/unified/components/export/ExportNewGrafanaRule'
          )
      ),
    },
    {
      path: '/alerting/:sourceName/:id/view',
      pageClass: 'page-alerting',
      roles: evaluateAccess([AccessControlAction.AlertingRuleRead, AccessControlAction.AlertingRuleExternalRead]),
      component: importAlertingComponent(
        () => import(/* webpackChunkName: "AlertingRule"*/ 'app/features/alerting/unified/RuleViewer')
      ),
    },
    {
      path: '/alerting/:sourceName/:name/find',
      pageClass: 'page-alerting',
      roles: evaluateAccess([AccessControlAction.AlertingRuleRead, AccessControlAction.AlertingRuleExternalRead]),
      component: importAlertingComponent(
        () =>
          import(/* webpackChunkName: "AlertingRedirectToRule"*/ 'app/features/alerting/unified/RedirectToRuleViewer')
      ),
    },
    {
      path: '/alerting/admin',
      roles: () => ['Admin'],
      component: importAlertingComponent(
        () => import(/* webpackChunkName: "AlertingSettings" */ 'app/features/alerting/unified/Settings')
      ),
    },
  ];

  return routes;
}

// this function will always load the "feature disabled" component for all alerting routes
function importAlertingComponent(loader: () => any): GrafanaRouteComponent {
  const featureDisabledPageLoader = () =>
    import(/* webpackChunkName: "AlertingDisabled" */ 'app/features/alerting/unified/AlertingNotEnabled');
  return SafeDynamicImport(config.unifiedAlertingEnabled ? loader : featureDisabledPageLoader);
}
