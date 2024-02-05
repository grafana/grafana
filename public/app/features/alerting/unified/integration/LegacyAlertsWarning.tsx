import React from 'react';
import { useToggle } from 'react-use';

import { PanelModel } from '@grafana/data';
import { Alert, Collapse, Column, InteractiveTable, TextLink } from '@grafana/ui';

import { makePanelLink } from '../utils/misc';

interface Props {
  dashboardUid: string;
  panels?: PanelModel[];
}

export default function LegacyAlertsWarning({ dashboardUid, panels = [] }: Props) {
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
        You are using legacy Grafana alerts in this dashboard, those have been deprecated in Grafana 11 and are no
        longer supported. We encourage you to upgrade to the new Grafana Alerting experience.
      </p>
      <p>
        Check out our documentation on how to migrate these alert rules and how to use provisioning with the new Grafana
        Alerting.
      </p>

      <Collapse label={'List of panels using legacy alerts'} collapsible isOpen={isOpen} onToggle={toggleCollapsible}>
        <InteractiveTable columns={columns} data={panels} getRowId={(panel) => String(panel.id)} />
      </Collapse>
    </Alert>
  );
}
