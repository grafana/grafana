import { useCallback } from 'react';

import { selectors as e2eSelectors } from '@grafana/e2e-selectors';
import { config, locationService } from '@grafana/runtime';
import { VizPanel } from '@grafana/scenes';
import { IconName, Menu } from '@grafana/ui';
import { contextSrv } from 'app/core/core';
import { t } from 'app/core/internationalization';
import { AccessControlAction } from 'app/types';

import { isPublicDashboardsEnabled } from '../../../dashboard/components/ShareModal/SharePublicDashboard/SharePublicDashboardUtils';
import { getTrackingSource, shareDashboardType } from '../../../dashboard/components/ShareModal/utils';
import { DashboardScene } from '../../scene/DashboardScene';
import { DashboardInteractions } from '../../utils/interactions';

const newShareButtonSelector = e2eSelectors.pages.Dashboard.DashNav.newShareButton.menu;

export interface ShareDrawerMenuItem {
  shareId: string;
  testId: string;
  label: string;
  description?: string;
  icon: IconName;
  renderCondition: boolean;
  onClick: (d: DashboardScene) => void;
}

let customShareDrawerItems: ShareDrawerMenuItem[] = [];

export function addDashboardShareDrawerItem(item: ShareDrawerMenuItem) {
  customShareDrawerItems.push(item);
}

export function resetDashboardShareDrawerItems() {
  customShareDrawerItems = [];
}

export default function ShareMenu({ dashboard, panel }: { dashboard: DashboardScene; panel?: VizPanel }) {
  const onMenuItemClick = (shareView: string) => {
    locationService.partial({ shareView });
  };

  const buildMenuItems = useCallback(() => {
    const menuItems: ShareDrawerMenuItem[] = [];

    menuItems.push({
      shareId: shareDashboardType.link,
      testId: newShareButtonSelector.shareInternally,
      icon: 'building',
      label: t('share-dashboard.menu.share-internally-title', 'Share internally'),
      renderCondition: true,
      onClick: () => onMenuItemClick(shareDashboardType.link),
    });

    menuItems.push({
      shareId: shareDashboardType.publicDashboard,
      testId: newShareButtonSelector.shareExternally,
      icon: 'share-alt',
      label: t('share-dashboard.menu.share-externally-title', 'Share externally'),
      renderCondition: !panel && isPublicDashboardsEnabled(),
      onClick: () => {
        onMenuItemClick(shareDashboardType.publicDashboard);
      },
    });

    customShareDrawerItems.forEach((d) => menuItems.push(d));

    menuItems.push({
      shareId: shareDashboardType.snapshot,
      testId: newShareButtonSelector.shareSnapshot,
      icon: 'camera',
      label: t('share-dashboard.menu.share-snapshot-title', 'Share snapshot'),
      renderCondition:
        contextSrv.isSignedIn &&
        config.snapshotEnabled &&
        contextSrv.hasPermission(AccessControlAction.SnapshotsCreate),
      onClick: () => {
        onMenuItemClick(shareDashboardType.snapshot);
      },
    });

    return menuItems.filter((item) => item.renderCondition);
  }, [panel]);

  const onClick = (item: ShareDrawerMenuItem) => {
    DashboardInteractions.sharingCategoryClicked({
      item: item.shareId,
      shareResource: getTrackingSource(panel?.getRef()),
    });

    item.onClick(dashboard);
  };

  return (
    <Menu data-testid={newShareButtonSelector.container}>
      {buildMenuItems().map((item) => (
        <Menu.Item
          key={item.shareId}
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
