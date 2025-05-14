import { useCallback } from 'react';

import { selectors as e2eSelectors } from '@grafana/e2e-selectors';
import { config, locationService } from '@grafana/runtime';
import { IconName, Menu } from '@grafana/ui';
import { t } from 'app/core/internationalization';
import { getTrackingSource, shareDashboardType } from 'app/features/dashboard/components/ShareModal/utils';

import { DashboardScene } from '../../scene/DashboardScene';
import { DashboardInteractions } from '../../utils/interactions';

const newExportButtonSelector = e2eSelectors.pages.Dashboard.DashNav.NewExportButton.Menu;

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
  const onMenuItemClick = (shareView: string) => {
    locationService.partial({ shareView });
  };

  const buildMenuItems = useCallback(() => {
    const menuItems: ExportDrawerMenuItem[] = [];

    customShareDrawerItem.forEach((d) => menuItems.push(d));

    const label = config.featureToggles.kubernetesDashboards
      ? t('dashboard.toolbar.new.export.tooltip.as-code', 'Export as code')
      : t('share-dashboard.menu.export-json-title', 'Export as JSON');

    menuItems.push({
      shareId: shareDashboardType.export,
      testId: newExportButtonSelector.exportAsJson,
      icon: 'arrow',
      label,
      renderCondition: true,
      onClick: () => onMenuItemClick(shareDashboardType.export),
    });

    return menuItems.filter((item) => item.renderCondition);
  }, []);

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
