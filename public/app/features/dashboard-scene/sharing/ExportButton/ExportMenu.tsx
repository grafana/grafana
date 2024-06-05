import React from 'react';
// import { useAsyncFn } from 'react-use';

// import { selectors as e2eSelectors } from '@grafana/e2e-selectors';
import { Menu } from '@grafana/ui';

import { DashboardScene } from '../../scene/DashboardScene';
import { ShareDrawer } from '../ShareDrawer';

import ExportAsJSON from './ExportAsJSON';

// const newShareButtonSelector = e2eSelectors.pages.Dashboard.DashNav.newShareButton.menu;

export default function ExportMenu({ dashboard }: { dashboard: DashboardScene }) {
  const onExportAsJSONClick = () => {
    const drawer = new ShareDrawer({
      title: 'Save dashboard JSON',
      body: <ExportAsJSON dashboardRef={dashboard.getRef()} />,
    });

    dashboard.showModal(drawer);
  };

  return (
    <Menu>
      <Menu.Item
        // testId={newShareButtonSelector.exportAsJSON}
        label="Export as JSON"
        icon="file-alt"
        onClick={onExportAsJSONClick}
      />
    </Menu>
  );
}
