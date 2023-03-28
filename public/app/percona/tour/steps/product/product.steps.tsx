import React from 'react';

import { Settings } from 'app/percona/settings/Settings.types';
import { TourStep } from 'app/percona/shared/core/reducers/tour';
import { ServiceType } from 'app/percona/shared/services/services/Services.types';
import SidebarStep from 'app/percona/tour/components/SidebarStep';

import { Messages } from './product.messages';
import { getPMMDashboardsStep } from './product.utils';

export const getProductTourSteps = (
  isPmmAdmin = true,
  settings?: Settings,
  activeServices?: ServiceType[]
): TourStep[] => [
  {
    selector: '.dropdown > [aria-label="Dashboards"]',
    content: (
      <SidebarStep title={Messages.dashboards.title}>
        <p>{Messages.dashboards.browse}</p>
        <p>{Messages.dashboards.folders}</p>
        <p>{Messages.dashboards.playlists}</p>
      </SidebarStep>
    ),
  },
  getPMMDashboardsStep(activeServices || []),
  {
    selector: '.dropdown > [aria-label="Query Analytics (QAN)"]',
    content: (
      <SidebarStep title={Messages.qan.title}>
        <p>{Messages.qan.queries}</p>
        <p>{Messages.qan.analyze}</p>
      </SidebarStep>
    ),
  },
  ...(isPmmAdmin
    ? [
        {
          selector: '.dropdown > [aria-label="Explore"]',
          content: (
            <SidebarStep title={Messages.explore.title}>
              <p>{Messages.explore.data}</p>
              <p>{Messages.explore.graphs}</p>
              <p>{Messages.explore.query}</p>
            </SidebarStep>
          ),
        },
      ]
    : []),
  {
    selector: '.dropdown > [aria-label="Alerting"]',
    content: (
      <SidebarStep title={Messages.alerting.title}>
        <p>
          {Messages.alerting.simplerToUse}
          <strong>{Messages.alerting.admin}</strong>
          {Messages.alerting.thatWorks}
        </p>
        <p>{Messages.alerting.youDefine}</p>
        <p>{Messages.alerting.howToUse}</p>
        <p>
          {Messages.alerting.moreInfo}
          <a
            href="https://docs.percona.com/percona-monitoring-and-management/using/alerting.html"
            target="_blank"
            rel="noreferrer noopener"
          >
            {Messages.alerting.docs}
          </a>
          .
        </p>
      </SidebarStep>
    ),
  },
  ...(isPmmAdmin && !!settings?.sttEnabled
    ? [
        {
          selector: '.dropdown > [aria-label="Advisor Checks"]',
          content: (
            <SidebarStep title={Messages.advisors.title}>
              <p>{Messages.advisors.pmmIncludes}</p>
              <p>
                {Messages.advisors.findOutMore}
                <a
                  href="https://docs.percona.com/percona-platform/advisors.html"
                  target="_blank"
                  rel="noreferrer noopener"
                >
                  {Messages.advisors.docs}
                </a>
                .
              </p>
            </SidebarStep>
          ),
        },
      ]
    : []),
  ...(isPmmAdmin && !!settings?.dbaasEnabled
    ? [
        {
          selector: '.dropdown > [aria-label="DBaaS"]',
          content: (
            <SidebarStep title={Messages.dbaas.title}>
              <p>{Messages.dbaas.feature}</p>
              <p>{Messages.dbaas.techPreview}</p>
              <p>{Messages.dbaas.benefits}</p>
              <ul>
                <li>{Messages.dbaas.singleInterface}</li>
                <li>{Messages.dbaas.dbManagement}</li>
                <li>{Messages.dbaas.automation}</li>
              </ul>
            </SidebarStep>
          ),
        },
      ]
    : []),
  ...(isPmmAdmin && !!settings?.backupEnabled
    ? [
        {
          selector: '.dropdown > [aria-label="Backup"]',
          content: (
            <SidebarStep title={Messages.backup.title}>
              <p>{Messages.backup.feature}</p>
              <p>{Messages.backup.onDemand}</p>
              <p>{Messages.backup.shedule}</p>
            </SidebarStep>
          ),
        },
      ]
    : []),
  ...(isPmmAdmin
    ? [
        {
          selector: '.dropdown > [aria-label="Configuration"]',
          content: (
            <SidebarStep title={Messages.configPanel.title}>
              <p>{Messages.configPanel.services}</p>
              <p>{Messages.configPanel.settings}</p>
              <p>
                {Messages.configPanel.settingsDocs}{' '}
                <a
                  href="https://docs.percona.com/percona-monitoring-and-management/how-to/configure.html"
                  target="_blank"
                  rel="noreferrer noopener"
                >
                  {Messages.configPanel.settingsDocsLink}
                </a>
                .
              </p>
            </SidebarStep>
          ),
        },
        {
          selector: '.dropdown > [aria-label="Server admin"]',
          content: (
            <SidebarStep title={Messages.serverAdmin.title}>
              <p>{Messages.serverAdmin.userManagement}</p>
              <ul>
                <li>{Messages.serverAdmin.addEditRemove}</li>
                <li>{Messages.serverAdmin.grant}</li>
                <li>{Messages.serverAdmin.manageOrg}</li>
                <li>{Messages.serverAdmin.changeOrg}</li>
              </ul>
            </SidebarStep>
          ),
        },
      ]
    : []),
];

export default getProductTourSteps;
