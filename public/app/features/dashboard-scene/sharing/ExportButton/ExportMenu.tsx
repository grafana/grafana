import React from 'react';
// import { useAsyncFn } from 'react-use';

import { selectors as e2eSelectors } from '@grafana/e2e-selectors';
import { Menu } from '@grafana/ui';

import { SceneDrawerAsScene } from '../../SceneDrawer';
import { DashboardScene } from '../../scene/DashboardScene';

import { ExportAsJSONDrawer } from './ExportAsJSONDrawer';
import { ExportAsPDFDrawer } from './ExportAsPDFDrawer';

const newShareButtonSelector = e2eSelectors.pages.Dashboard.DashNav.newShareButton.menu;

export default function ExportMenu({ dashboard }: { dashboard: DashboardScene }) {
  const onExportAsPDFClick = () => {
    const drawer = new SceneDrawerAsScene({
      title: 'Export As PDF',
      size: 'md',
      closeOnMaskClick: false,
      scene: new ExportAsPDFDrawer({ dashboardRef: dashboard.getRef() }),
      onClose: () => dashboard.closeModal(),
    });

    dashboard.showModal(drawer);
  };

  const onExportAsJSONClick = () => {
    const drawer = new SceneDrawerAsScene({
      title: 'Save dashboard JSON',
      size: 'md',
      closeOnMaskClick: false,
      scene: new ExportAsJSONDrawer({ dashboardRef: dashboard.getRef() }),
      onClose: () => dashboard.closeModal(),
    });

    dashboard.showModal(drawer);
  };

  return (
    <Menu>
      <Menu.Item
        // testId={newShareButtonSelector.exportAsPDF}
        label="Export as PDF"
        icon="file-alt"
        onClick={onExportAsPDFClick}
      />
      <Menu.Item
        // testId={newShareButtonSelector.exportAsJSON}
        label="Export as JSON"
        icon="file-alt"
        onClick={onExportAsJSONClick}
      />
    </Menu>
  );
}
