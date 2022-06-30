import { StepType } from '@reactour/tour';
import React from 'react';

import SidebarStep from './SidebarStep';
import { Messages } from './steps.messages';

const steps: StepType[] = [
  {
    selector: '.dropdown > [aria-label="PMM dashboards"]',
    content: (
      <SidebarStep title="PMM Dashboards">
        <p>{Messages.dashboards.pmmShipping}</p>
        <p>
          {Messages.dashboards.checkOur}
          <a
            href="https://github.com/percona/grafana-dashboards"
            target="_blank"
            rel="noreferrer noopener"
            style={{ textDecoration: 'underline' }}
          >
            {Messages.dashboards.dashboardsRepo}
          </a>
          {Messages.dashboards.contribute}
        </p>
      </SidebarStep>
    ),
  },
  {
    selector: '.dropdown > [aria-label="Alerting"]',
    content: (
      <SidebarStep title="PMM Alerting">
        <p>{Messages.alerting.simplerToUse}</p>
        <p>{Messages.alerting.youDefine}</p>
        <p>{Messages.alerting.howToUse}</p>
        <p>
          {Messages.alerting.moreInfo}
          <a
            href="https://docs.percona.com/percona-monitoring-and-management/using/alerting.html"
            target="_blank"
            rel="noreferrer noopener"
            style={{ textDecoration: 'underline' }}
          >
            {Messages.alerting.docs}
          </a>
          .
        </p>
      </SidebarStep>
    ),
  },
  {
    selector: '.dropdown > [aria-label="Configuration"]',
    content: (
      <SidebarStep title="Configuration Panel">
        <p>{Messages.configPanel.services}</p>
        <p>{Messages.configPanel.settings}</p>
        <p>
          {Messages.configPanel.settingsDocs}{' '}
          <a
            href="https://docs.percona.com/percona-monitoring-and-management/how-to/configure.html"
            target="_blank"
            rel="noreferrer noopener"
            style={{ textDecoration: 'underline' }}
          >
            {Messages.configPanel.settingsDocsLink}
          </a>
          .
        </p>
      </SidebarStep>
    ),
  },
  {
    selector: '.dropdown > [aria-label="Advisor Checks"]',
    content: (
      <SidebarStep title="Advisor checks">
        <p>{Messages.advisors.pmmIncludes}</p>
        <p>
          {Messages.advisors.findOutMore}
          <a
            href="https://docs.percona.com/percona-platform/checks.html"
            target="_blank"
            rel="noreferrer noopener"
            style={{ textDecoration: 'underline' }}
          >
            {Messages.advisors.docs}
          </a>
          .
        </p>
      </SidebarStep>
    ),
  },
];

export default steps;
