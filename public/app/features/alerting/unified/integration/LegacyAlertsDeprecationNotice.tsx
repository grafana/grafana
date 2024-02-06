import { isEmpty } from 'lodash';
import React from 'react';
import { useAsync, useToggle } from 'react-use';

import { PanelModel } from '@grafana/data';
import { Alert, Collapse, Column, InteractiveTable, TextLink } from '@grafana/ui';
import { DashboardModel } from 'app/features/dashboard/state';
import { getDashboardScenePageStateManager } from 'app/features/dashboard-scene/pages/DashboardScenePageStateManager';
import { DashboardDataDTO, DashboardRoutes } from 'app/types';

import { makePanelLink } from '../utils/misc';

interface DeprecationNoticeProps {
  dashboardUid?: string;
  dashboardModel?: DashboardModel;
}

export default function LegacyAlertsDeprecationNotice({ dashboardUid, dashboardModel }: DeprecationNoticeProps) {
  const dashboardStateManager = getDashboardScenePageStateManager();

  const {
    loading,
    value: dashboardData,
    error,
  } = useAsync(() => {
    if (dashboardModel) {
      return Promise.resolve(dashboardModel);
    } else if (dashboardUid) {
      return dashboardStateManager
        .fetchDashboard({
          uid: dashboardUid,
          route: DashboardRoutes.Normal,
        })
        .then((data) => (data ? data.dashboard : undefined));
    } else {
      throw new Error('LegacyAlertsDeprecationNotice missing any of "dashboardUid" or "dashboardModel"');
    }
  }, [dashboardStateManager]);

  if (loading) {
    return null;
  }

  // we probably don't want to show the user an error if this fails because there's nothing they can do about it
  if (error) {
    console.error(error);
  }

  const panelsWithLegacyAlerts = getLegacyAlertPanelsFromDashboard(dashboardData);

  // don't show anything when the user has no legacy alerts defined
  const hasLegacyAlerts = !isEmpty(panelsWithLegacyAlerts);
  if (!hasLegacyAlerts) {
    return null;
  }

  return <LegacyAlertsWarning dashboardUid={dashboardData.uid} panels={panelsWithLegacyAlerts} />;
}

function getLegacyAlertPanelsFromDashboard(dashboard: DashboardDataDTO): PanelModel[] {
  const panelsWithLegacyAlerts = dashboard.panels?.filter((panel: PanelModel) => {
    return 'alert' in panel;
  });

  return panelsWithLegacyAlerts ?? [];
}

interface Props {
  dashboardUid: string;
  panels: PanelModel[];
}

function LegacyAlertsWarning({ dashboardUid, panels }: Props) {
  const [isOpen, toggleCollapsible] = useToggle(false);

  const columns: Array<Column<PanelModel>> = [
    { id: 'id', header: 'ID' },
    {
      id: 'title',
      header: 'Title',
      cell: (cell) => (
        <TextLink
          external
          href={makePanelLink(dashboardUid, String(cell.row.id), { editPanel: cell.row.id, tab: 'alert' })}
        >
          {cell.value}
        </TextLink>
      ),
    },
  ];

  return (
    <Alert severity="warning" title="Legacy alert rules are deprecated">
      <p>
        You have legacy alert rules in this dashboard that were deprecated in Grafana 11 and are no longer supported.
      </p>
      <p>
        Refer to{' '}
        <TextLink href="https://grafana.com/docs/grafana/latest/alerting/set-up/migrating-alerts/" external>
          our documentation
        </TextLink>{' '}
        on how to migrate legacy alert rules and how to import and export using Grafana Alerting.
      </p>

      <Collapse label={'List of panels using legacy alerts'} collapsible isOpen={isOpen} onToggle={toggleCollapsible}>
        <InteractiveTable columns={columns} data={panels} getRowId={(panel) => String(panel.id)} pageSize={5} />
      </Collapse>
    </Alert>
  );
}
