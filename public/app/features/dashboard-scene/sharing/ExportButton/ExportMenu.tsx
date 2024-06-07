import React from 'react';

import { selectors as e2eSelectors } from '@grafana/e2e-selectors';
import { Menu } from '@grafana/ui';

import { DashboardScene } from '../../scene/DashboardScene';
import { ShareDrawer } from '../ShareDrawer';

import ExportAsJSON from './ExportAsJSON';

const newExportButtonSelector = e2eSelectors.pages.Dashboard.DashNav.newExportButton.menu;

export default function ExportMenu({ dashboard }: { dashboard: DashboardScene }) {
  const onExportAsJSONClick = () => {
    const drawer = new ShareDrawer({
      title: 'Save dashboard JSON',
      body: <ExportAsJSON dashboardRef={dashboard.getRef()} />,
    });

    dashboard.showModal(drawer);
  };

  return (
    <Menu data-testid={newExportButtonSelector.container}>
      <Menu.Item
        testId={newExportButtonSelector.exportAsJson}
        label="Export as JSON"
        icon="file-alt"
        onClick={onExportAsJSONClick}
      />
    </Menu>
  );
}
