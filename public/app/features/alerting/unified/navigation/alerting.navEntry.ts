import { type NavModelItem } from '@grafana/data';
import { t } from '@grafana/i18n';
import { config } from '@grafana/runtime';
import { NavID, NavWeight } from 'app/core/navtree/constants';
import { type NavEntryBuilder, buildEntries, has, hasAny, isOrgAdmin } from 'app/core/navtree/utils';
import { AccessControlAction } from 'app/types/accessControl';

import {
  alertInstanceAccess,
  alertRulesAccess,
  contactPointsAccess,
  notificationPoliciesAccess,
  silencesAccess,
} from '../utils/pageAccess';

const isAlertingV2 = () => Boolean(config.featureToggles.alertingNavigationV2);
const isAlertingTriage = () => Boolean(config.featureToggles.alertingTriage);

const ALERTING_CHILDREN: NavEntryBuilder[] = [
  {
    // V2 navigation groups alert activity and groups under one page (tabs managed on the frontend)
    when: () => isAlertingTriage() && isAlertingV2() && (alertRulesAccess() || alertInstanceAccess()),
    build: () => ({
      text: t('nav.alerting-activity.title', 'Alert activity'),
      subTitle: t('nav.alerting-activity.subtitle', 'View alerts and active notifications'),
      id: 'alert-activity',
      url: '/alerting/alerts',
      icon: 'bell',
      isNew: true,
    }),
  },
  {
    when: () => isAlertingTriage() && !isAlertingV2() && alertRulesAccess(),
    build: () => ({
      text: t('nav.alerting-alerts.title', 'Alert activity'),
      subTitle: t('nav.alerting-alerts.subtitle', 'Visualize active and pending alerts'),
      id: 'alert-alerts',
      url: '/alerting/alerts',
      icon: 'bell',
      isNew: true,
    }),
  },
  {
    when: alertRulesAccess,
    build: () => ({
      text: t('nav.alerting-list.title', 'Alert rules'),
      subTitle: t('nav.alerting-list.subtitle', 'Rules that determine whether an alert will fire'),
      // V2 navigation renders rules with frontend-managed tabs under a different nav id
      id: isAlertingV2() ? 'alert-rules' : 'alert-list',
      url: '/alerting/list',
      icon: 'list-ul',
    }),
  },
  {
    when: () => isAlertingV2() && (contactPointsAccess() || notificationPoliciesAccess()),
    build: () => ({
      text: t('nav.alerting-notification-config.title', 'Notification configuration'),
      subTitle: t(
        'nav.alerting-notification-config.subtitle',
        'Manage contact points, notification policies, templates, and time intervals'
      ),
      id: 'notification-config',
      url: '/alerting/notifications',
      icon: 'comment-alt-share',
    }),
  },
  {
    when: () => !isAlertingV2() && contactPointsAccess(),
    build: () => ({
      text: t('nav.alerting-receivers.title', 'Contact points'),
      subTitle: t(
        'nav.alerting-receivers.subtitle',
        'Choose how to notify your contact points when an alert instance fires'
      ),
      id: 'receivers',
      url: '/alerting/notifications',
      icon: 'comment-alt-share',
    }),
  },
  {
    when: () => !isAlertingV2() && notificationPoliciesAccess(),
    build: () => ({
      text: t('nav.alerting-am-routes.title', 'Notification policies'),
      subTitle: t('nav.alerting-am-routes.subtitle', 'Determine how alerts are routed to contact points'),
      id: 'am-routes',
      url: '/alerting/routes',
      icon: 'sitemap',
    }),
  },
  {
    when: silencesAccess,
    build: () => ({
      text: t('nav.alerting-silences.title', 'Silences'),
      subTitle: t('nav.alerting-silences.subtitle', 'Stop notifications from one or more alerting rules'),
      id: 'silences',
      url: '/alerting/silences',
      icon: 'bell-slash',
    }),
  },
  {
    // In V2 navigation with triage enabled, Alert groups is shown as a tab under Alert activity
    when: () => alertInstanceAccess() && !(isAlertingV2() && isAlertingTriage()),
    build: () => ({
      text: t('nav.alerting-groups.title', 'Active notifications'),
      subTitle: t('nav.alerting-groups.subtitle', 'See grouped alerts with active notifications'),
      id: 'groups',
      url: '/alerting/groups',
      icon: 'layer-group',
    }),
  },
  {
    when: () => Boolean(config.featureToggles.alertingCentralAlertHistory) && has(AccessControlAction.AlertingRuleRead),
    build: () => ({
      text: t('nav.alerting-history.title', 'History'),
      id: 'alerts-history',
      url: '/alerting/history',
      icon: 'history',
    }),
  },
  {
    when: () =>
      isOrgAdmin() &&
      Boolean(config.featureToggles.alertRuleRestore) &&
      Boolean(config.featureToggles.alertingRuleRecoverDeleted) &&
      !isAlertingV2(),
    build: () => ({
      text: t('nav.alerts-recently-deleted.title', 'Recently deleted'),
      subTitle: t('nav.alerts-recently-deleted.subtitle', 'See recently deleted alert rules'),
      id: 'alerts/recently-deleted',
      url: '/alerting/recently-deleted',
    }),
  },
  {
    when: isOrgAdmin,
    build: () => ({
      text: t('nav.alerting-admin.title', 'Settings'),
      id: 'alerting-admin',
      url: '/alerting/admin',
      icon: 'cog',
    }),
  },
  {
    when: () => hasAny(AccessControlAction.AlertingRuleCreate, AccessControlAction.AlertingRuleExternalWrite),
    build: () => ({
      text: t('nav.create-alert.title', 'New alert rule'),
      subTitle: t('nav.create-alert.subtitle', 'Create an alert rule'),
      id: 'alert',
      icon: 'plus',
      url: '/alerting/new',
      hideFromTabs: true,
      isCreateAction: true,
    }),
  },
];

export const alertingNavEntry: NavEntryBuilder = {
  when: () => config.unifiedAlertingEnabled,
  build: (): NavModelItem | undefined => {
    const children = buildEntries(ALERTING_CHILDREN);
    if (children.length === 0) {
      return undefined;
    }

    return {
      text: t('nav.alerting.title', 'Alerting'),
      subTitle: t('nav.alerting.subtitle', 'Learn about problems in your systems moments after they occur'),
      id: NavID.alerting,
      icon: 'bell',
      children,
      sortWeight: NavWeight.alerting,
      url: '/alerting',
    };
  },
};
