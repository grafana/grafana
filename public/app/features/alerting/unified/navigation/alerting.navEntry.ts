/* eslint-disable @grafana/i18n/no-untranslated-strings -- nav item text is translated by id in public/app/core/utils/navBarItem-translations.ts, whose lookup takes precedence, so the strings below are only the English fallback. The core nav sections declare theirs the same way and are exempt only because the rule's autofix is scoped to public/app/features; making nav entries exempt everywhere is the real fix. */
import { type NavModelItem } from '@grafana/data';
import { NavID, NavWeight } from 'app/core/navtree/constants';
import { type NavEntryBuilder, buildEntries } from 'app/core/navtree/utils';

import {
  activeNotificationsAccess,
  alertActivityAccess,
  alertRulesAccess,
  alertRulesNavId,
  alertingAdminAccess,
  alertingEnabled,
  contactPointsAccess,
  historyAccess,
  legacyAlertActivityAccess,
  newAlertRuleAccess,
  notificationConfigAccess,
  notificationPoliciesAccess,
  recentlyDeletedAccess,
  silencesAccess,
} from '../utils/pageAccess';

const ALERTING_CHILDREN: NavEntryBuilder[] = [
  {
    when: alertActivityAccess,
    build: () => ({
      text: 'Alert activity',
      subTitle: 'View alerts and active notifications',
      id: 'alert-activity',
      url: '/alerting/alerts',
      icon: 'bell',
    }),
  },
  {
    when: legacyAlertActivityAccess,
    build: () => ({
      text: 'Alert activity',
      subTitle: 'Visualize active and pending alerts',
      id: 'alert-alerts',
      url: '/alerting/alerts',
      icon: 'bell',
    }),
  },
  {
    when: alertRulesAccess,
    build: () => ({
      text: 'Alert rules',
      subTitle: 'Rules that determine whether an alert will fire',
      id: alertRulesNavId(),
      url: '/alerting/list',
      icon: 'list-ul',
    }),
  },
  {
    when: notificationConfigAccess,
    build: () => ({
      text: 'Notification configuration',
      subTitle: 'Manage contact points, notification policies, templates, and time intervals',
      id: 'notification-config',
      url: '/alerting/notifications',
      icon: 'comment-alt-share',
    }),
  },
  {
    when: contactPointsAccess,
    build: () => ({
      text: 'Contact points',
      subTitle: 'Choose how to notify your contact points when an alert instance fires',
      id: 'receivers',
      url: '/alerting/notifications',
      icon: 'comment-alt-share',
    }),
  },
  {
    when: notificationPoliciesAccess,
    build: () => ({
      text: 'Notification policies',
      subTitle: 'Determine how alerts are routed to contact points',
      id: 'am-routes',
      url: '/alerting/routes',
      icon: 'sitemap',
    }),
  },
  {
    when: silencesAccess,
    build: () => ({
      text: 'Silences',
      subTitle: 'Stop notifications from one or more alerting rules',
      id: 'silences',
      url: '/alerting/silences',
      icon: 'bell-slash',
    }),
  },
  {
    when: activeNotificationsAccess,
    build: () => ({
      text: 'Active notifications',
      subTitle: 'See grouped alerts with active notifications',
      id: 'groups',
      url: '/alerting/groups',
      icon: 'layer-group',
    }),
  },
  {
    when: historyAccess,
    build: () => ({
      text: 'History',
      id: 'alerts-history',
      url: '/alerting/history',
      icon: 'history',
    }),
  },
  {
    when: recentlyDeletedAccess,
    build: () => ({
      text: 'Recently deleted',
      subTitle: 'See recently deleted alert rules',
      id: 'alerts/recently-deleted',
      url: '/alerting/recently-deleted',
    }),
  },
  {
    when: alertingAdminAccess,
    build: () => ({
      text: 'Settings',
      id: 'alerting-admin',
      url: '/alerting/admin',
      icon: 'cog',
    }),
  },
  {
    when: newAlertRuleAccess,
    build: () => ({
      text: 'New alert rule',
      subTitle: 'Create an alert rule',
      id: 'alert',
      icon: 'plus',
      url: '/alerting/new',
      hideFromTabs: true,
      isCreateAction: true,
    }),
  },
];

export const alertingNavEntry: NavEntryBuilder = {
  // TODO: only the global unifiedAlertingEnabled is exposed to the frontend, so
  // an org listed in unified_alerting.disabled_orgs still gets Alerting here
  // even though the server omits it. Needs a per-org availability flag in
  // frontend settings; fix in follow-up work.
  when: alertingEnabled,
  build: (): NavModelItem | undefined => {
    const children = buildEntries(ALERTING_CHILDREN);
    if (children.length === 0) {
      return undefined;
    }

    return {
      text: 'Alerting',
      subTitle: 'Learn about problems in your systems moments after they occur',
      id: NavID.alerting,
      icon: 'bell',
      children,
      sortWeight: NavWeight.alerting,
      url: '/alerting',
    };
  },
};
