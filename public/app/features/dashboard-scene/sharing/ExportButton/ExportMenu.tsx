import { useCallback } from 'react';

import { selectors as e2eSelectors } from '@grafana/e2e-selectors';
import { SceneObject } from '@grafana/scenes';
import { IconName, Menu } from '@grafana/ui';
import { t } from 'app/core/internationalization';
import { getTrackingSource, shareDashboardType } from 'app/features/dashboard/components/ShareModal/utils';

import { DashboardScene } from '../../scene/DashboardScene';
import { DashboardInteractions } from '../../utils/interactions';
import { ShareDrawer } from '../ShareDrawer/ShareDrawer';
import { SceneShareDrawerState } from '../types';

import { ExportAsJson } from './ExportAsJson';

const newExportButtonSelector = e2eSelectors.pages.Dashboard.DashNav.NewExportButton.Menu;

type CustomDashboardDrawer = new (...args: SceneShareDrawerState[]) => SceneObject;

export interface ExportDrawerMenuItem {
  shareId: string;
  testId: string;
  label: string;
  description?: string;
  icon: IconName;
  renderCondition: boolean;
  onClick: (d: DashboardScene) => void;
}

const customShareDrawerItem: ExportDrawerMenuItem[] = [];

export function addDashboardExportDrawerItem(item: ExportDrawerMenuItem) {
  customShareDrawerItem.push(item);
}

export default function ExportMenu({ dashboard }: { dashboard: DashboardScene }) {
  const onMenuItemClick = useCallback(
    (title: string, component: CustomDashboardDrawer) => {
      const drawer = new ShareDrawer({
        title,
        body: new component(),
      });

      dashboard.showModal(drawer);
    },
    [dashboard]
  );

  const buildMenuItems = useCallback(() => {
    const menuItems: ExportDrawerMenuItem[] = [];

    customShareDrawerItem.forEach((d) => menuItems.push(d));

    menuItems.push({
      shareId: shareDashboardType.export,
      testId: newExportButtonSelector.exportAsJson,
      icon: 'arrow',
      label: t('share-dashboard.menu.export-json-title', 'Export as JSON'),
      renderCondition: true,
      onClick: () => onMenuItemClick(t('export.json.title', 'Save dashboard JSON'), ExportAsJson),
    });

    return menuItems.filter((item) => item.renderCondition);
  }, [onMenuItemClick]);

  const onClick = (item: ExportDrawerMenuItem) => {
    DashboardInteractions.sharingCategoryClicked({
      item: item.shareId,
      shareResource: getTrackingSource(),
    });

    item.onClick(dashboard);
  };

  return (
    <Menu data-testid={newExportButtonSelector.container}>
      {buildMenuItems().map((item) => (
        <Menu.Item
          key={item.label}
          testId={item.testId}
          label={item.label}
          icon={item.icon}
          description={item.description}
          onClick={() => onClick(item)}
        />
      ))}
    </Menu>
  );
}
