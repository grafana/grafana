import { isEmpty } from 'lodash';
import React from 'react';
import { useToggle } from 'react-use';

import { config } from '@grafana/runtime';
import { Dashboard, Panel, RowPanel } from '@grafana/schema';
import { Alert, Collapse, Column, InteractiveTable, TextLink } from '@grafana/ui';

import { makePanelLink } from '../utils/misc';

interface DeprecationNoticeProps {
  dashboard: Dashboard;
}

const usingLegacyAlerting = !config.unifiedAlertingEnabled;

export default function LegacyAlertsDeprecationNotice({ dashboard }: DeprecationNoticeProps) {
  // if the user is still using legacy alerting we don't need to show any notice at all – they will probably keep using legacy alerting and do not intend to upgrade.
  if (usingLegacyAlerting) {
    return null;
  }

  const panelsWithLegacyAlerts = getLegacyAlertPanelsFromDashboard(dashboard);

  // don't show anything when the user has no legacy alerts defined
  const hasLegacyAlerts = !isEmpty(panelsWithLegacyAlerts);
  if (!hasLegacyAlerts) {
    return null;
  }

  return dashboard.uid ? <LegacyAlertsWarning dashboardUid={dashboard.uid} panels={panelsWithLegacyAlerts} /> : null;
}

/**
 * This function uses two different ways to detect legacy alerts based on what dashboard system is being used.
 *
 * 1. if using the older (non-scenes) dashboard system we can simply check for "alert" in the panel definition.
 * 2. for dashboard scenes the alerts are no longer added to the model but we can check for "alertThreshold" in the panel options object
 */
function getLegacyAlertPanelsFromDashboard(dashboard: Dashboard): Panel[] {
  const panelsWithLegacyAlerts = dashboard.panels?.filter((panel) => {
    const hasAlertDefinition = 'alert' in panel;
    const hasAlertThreshold = 'options' in panel && panel.options ? 'alertThreshold' in panel.options : false;
    return hasAlertDefinition || hasAlertThreshold;
  });

  return panelsWithLegacyAlerts ?? [];
}

interface Props {
  dashboardUid: string;
  panels: Panel[];
}

function LegacyAlertsWarning({ dashboardUid, panels }: Props) {
  const [isOpen, toggleCollapsible] = useToggle(false);

  const columns: Array<Column<Panel | RowPanel>> = [
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
