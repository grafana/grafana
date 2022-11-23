import React from 'react';

import { TourStep } from 'app/percona/shared/core/reducers/tour';
import SidebarStep from 'app/percona/tour/components/SidebarStep';

import { Messages } from './alerting.messages';

export const getAlertingTourSteps = (isAdmin = false): TourStep[] => [
  ...(isAdmin
    ? [
        {
          selector: '[aria-label="Tab Fired alerts"]',
          mutationObservables: ['.page-body'],
          resizeObservables: ['.page-body'],
          content: (
            <SidebarStep title={Messages.firedAlerts.title}>
              <p>{Messages.firedAlerts.view}</p>
              <p>{Messages.firedAlerts.check}</p>
            </SidebarStep>
          ),
        },
        {
          selector: '[aria-label="Tab Alert rule templates"]',
          content: (
            <SidebarStep title={Messages.alertRuleTemplates.title}>
              <p>{Messages.alertRuleTemplates.effortlessly}</p>
              <p>{Messages.alertRuleTemplates.offers}</p>
            </SidebarStep>
          ),
        },
      ]
    : []),
  {
    selector: '[aria-label="Tab Alert rules"]',
    content: (
      <SidebarStep title={Messages.alertRules.title}>
        <p>{Messages.alertRules.rules}</p>
        <p>{Messages.alertRules.start}</p>
        <p>{Messages.alertRules.create}</p>
      </SidebarStep>
    ),
  },
  {
    selector: '[aria-label="Tab Contact points"]',
    content: (
      <SidebarStep title={Messages.contactPoints.title}>
        <p>{Messages.contactPoints.define}</p>
        <p>{Messages.contactPoints.grafana}</p>
      </SidebarStep>
    ),
  },
  {
    selector: '[aria-label="Tab Notification policies"]',
    content: (
      <SidebarStep title={Messages.notificationPolicies.title}>
        <p>{Messages.notificationPolicies.routed}</p>
        <p>{Messages.notificationPolicies.policy}</p>
      </SidebarStep>
    ),
  },
  {
    selector: '[aria-label="Tab Silences"]',
    content: (
      <SidebarStep title={Messages.silences.title}>
        <p>{Messages.silences.create}</p>
        <p>{Messages.silences.silences}</p>
      </SidebarStep>
    ),
  },
  {
    selector: '[aria-label="Tab Alert groups"]',
    content: (
      <SidebarStep title={Messages.alertGroups.title}>
        <p>{Messages.alertGroups.alert}</p>
        <p>{Messages.alertGroups.grouping}</p>
      </SidebarStep>
    ),
  },
  ...(isAdmin
    ? [
        {
          selector: '[aria-label="Tab Admin"]',
          content: (
            <SidebarStep title={Messages.admin.title}>
              <p>{Messages.admin.configure}</p>
            </SidebarStep>
          ),
        },
      ]
    : []),
];

export default getAlertingTourSteps;
