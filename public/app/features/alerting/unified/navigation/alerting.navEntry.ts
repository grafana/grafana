/* eslint-disable @grafana/i18n/no-untranslated-strings -- nav item text is translated by id in public/app/core/utils/navBarItem-translations.ts, whose lookup takes precedence, so the strings below are only the English fallback. The core nav sections declare theirs the same way and are exempt only because the rule's autofix is scoped to public/app/features; making nav entries exempt everywhere is the real fix. */
import { type NavModelItem } from '@grafana/data';
import { config } from '@grafana/runtime';
import { NavID, NavWeight } from 'app/core/navtree/constants';
import { type NavEntryBuilder, buildEntries, hasAny } from 'app/core/navtree/utils';
import { contextSrv } from 'app/core/services/context_srv';
import { AccessControlAction } from 'app/types/accessControl';

import {
  alertInstanceAccess,
  alertRulesAccess,
  contactPointsAccess,
  notificationPoliciesAccess,
  silencesAccess,
} from '../utils/pageAccess';

// TODO: migrate these to OpenFeature flags. They are legacy-only toggles, so
// they live solely in the config.featureToggles map, which the multi-tenant
// frontend service ships empty — both read false there and the section falls
// back to its legacy shape. OpenFeature flags resolve over OFREP instead.
const isAlertingV2 = () => Boolean(config.featureToggles.alertingNavigationV2);
const isAlertingTriage = () => Boolean(config.featureToggles.alertingTriage);

// The history page is only available when state-history queries are served by
// Loki: either as the only backend, or as the primary of the "multiple"
// backend. Values are trimmed and compared case-insensitively to match Go's
// isStateHistoryBackend, so `backend = Loki` is recognised too.
const isStateHistoryBackend = (value: string | undefined, backend: string) => value?.trim().toLowerCase() === backend;

const stateHistoryServedByLoki = () => {
  const stateHistory = config.unifiedAlerting.stateHistory;
  return isStateHistoryBackend(stateHistory?.backend, 'multiple')
    ? isStateHistoryBackend(stateHistory?.primary, 'loki')
    : isStateHistoryBackend(stateHistory?.backend, 'loki');
};

const ALERTING_CHILDREN: NavEntryBuilder[] = [
  {
    // V2 navigation groups alert activity and groups under one page (tabs managed on the frontend)
    when: () => isAlertingTriage() && isAlertingV2() && (alertRulesAccess() || alertInstanceAccess()),
    build: () => ({
      text: 'Alert activity',
      subTitle: 'View alerts and active notifications',
      id: 'alert-activity',
      url: '/alerting/alerts',
      icon: 'bell',
    }),
  },
  {
    when: () => isAlertingTriage() && !isAlertingV2() && alertRulesAccess(),
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
      // V2 navigation renders rules with frontend-managed tabs under a different nav id
      id: isAlertingV2() ? 'alert-rules' : 'alert-list',
      url: '/alerting/list',
      icon: 'list-ul',
    }),
  },
  {
    when: () => isAlertingV2() && (contactPointsAccess() || notificationPoliciesAccess()),
    build: () => ({
      text: 'Notification configuration',
      subTitle: 'Manage contact points, notification policies, templates, and time intervals',
      id: 'notification-config',
      url: '/alerting/notifications',
      icon: 'comment-alt-share',
    }),
  },
  {
    when: () => !isAlertingV2() && contactPointsAccess(),
    build: () => ({
      text: 'Contact points',
      subTitle: 'Choose how to notify your contact points when an alert instance fires',
      id: 'receivers',
      url: '/alerting/notifications',
      icon: 'comment-alt-share',
    }),
  },
  {
    when: () => !isAlertingV2() && notificationPoliciesAccess(),
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
    // In V2 navigation with triage enabled, Alert groups is shown as a tab under Alert activity
    when: () => alertInstanceAccess() && !(isAlertingV2() && isAlertingTriage()),
    build: () => ({
      text: 'Active notifications',
      subTitle: 'See grouped alerts with active notifications',
      id: 'groups',
      url: '/alerting/groups',
      icon: 'layer-group',
    }),
  },
  {
    when: () => stateHistoryServedByLoki() && contextSrv.hasPermission(AccessControlAction.AlertingRuleRead),
    build: () => ({
      text: 'History',
      id: 'alerts-history',
      url: '/alerting/history',
      icon: 'history',
    }),
  },
  {
    // TODO: migrate these two to OpenFeature flags as well — being legacy-only
    // they read false in the multi-tenant frontend service, so this item never
    // appears there.
    when: () =>
      contextSrv.hasRole('Admin') &&
      Boolean(config.featureToggles.alertRuleRestore) &&
      Boolean(config.featureToggles.alertingRuleRecoverDeleted) &&
      !isAlertingV2(),
    build: () => ({
      text: 'Recently deleted',
      subTitle: 'See recently deleted alert rules',
      id: 'alerts/recently-deleted',
      url: '/alerting/recently-deleted',
    }),
  },
  {
    when: () => contextSrv.hasRole('Admin'),
    build: () => ({
      text: 'Settings',
      id: 'alerting-admin',
      url: '/alerting/admin',
      icon: 'cog',
    }),
  },
  {
    when: () => hasAny(AccessControlAction.AlertingRuleCreate, AccessControlAction.AlertingRuleExternalWrite),
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
  when: () => config.unifiedAlertingEnabled,
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
