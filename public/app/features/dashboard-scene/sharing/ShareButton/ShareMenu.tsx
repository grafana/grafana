import { useCallback } from 'react';

import { selectors as e2eSelectors } from '@grafana/e2e-selectors';
import { config } from '@grafana/runtime';
import { SceneObject, VizPanel } from '@grafana/scenes';
import { IconName, Menu } from '@grafana/ui';
import { contextSrv } from 'app/core/core';
import { t } from 'app/core/internationalization';

import { isPublicDashboardsEnabled } from '../../../dashboard/components/ShareModal/SharePublicDashboard/SharePublicDashboardUtils';
import { DashboardScene } from '../../scene/DashboardScene';
import { ShareDrawer } from '../ShareDrawer/ShareDrawer';
import { SceneShareDrawerState } from '../types';

import { ShareExternally } from './share-externally/ShareExternally';
import { ShareInternally } from './share-internally/ShareInternally';
import { ShareSnapshot } from './share-snapshot/ShareSnapshot';

const newShareButtonSelector = e2eSelectors.pages.Dashboard.DashNav.newShareButton.menu;

type CustomDashboardDrawer = new (...args: SceneShareDrawerState[]) => SceneObject;

export interface ShareDrawerMenuItem {
  testId: string;
  label: string;
  description?: string;
  icon: IconName;
  renderCondition: boolean;
  onClick: (d: DashboardScene) => void;
}

const customShareDrawerItem: ShareDrawerMenuItem[] = [];

export function addDashboardShareDrawerItem(item: ShareDrawerMenuItem) {
  customShareDrawerItem.push(item);
}

export default function ShareMenu({ dashboard, panel }: { dashboard: DashboardScene; panel?: VizPanel }) {
  const onMenuItemClick = useCallback(
    (title: string, component: CustomDashboardDrawer) => {
      const drawer = new ShareDrawer({
        title,
        body: new component({ dashboardRef: dashboard.getRef(), panelRef: panel?.getRef() }),
      });

      dashboard.showModal(drawer);
    },
    [dashboard, panel]
  );

  const buildMenuItems = useCallback(() => {
    const menuItems: ShareDrawerMenuItem[] = [];

    menuItems.push({
      testId: newShareButtonSelector.shareInternally,
      icon: 'building',
      label: t('share-dashboard.menu.share-internally-title', 'Share internally'),
      description: t('share-dashboard.menu.share-internally-description', 'Advanced settings'),
      renderCondition: true,
      onClick: () =>
        onMenuItemClick(t('share-dashboard.menu.share-internally-title', 'Share internally'), ShareInternally),
    });

    menuItems.push({
      testId: newShareButtonSelector.shareExternally,
      icon: 'share-alt',
      label: t('share-dashboard.menu.share-externally-title', 'Share externally'),
      renderCondition: !panel && isPublicDashboardsEnabled(),
      onClick: () => {
        onMenuItemClick(t('share-dashboard.menu.share-externally-title', 'Share externally'), ShareExternally);
      },
    });

    customShareDrawerItem.forEach((d) => menuItems.push(d));

    menuItems.push({
      testId: newShareButtonSelector.shareSnapshot,
      icon: 'camera',
      label: t('share-dashboard.menu.share-snapshot-title', 'Share snapshot'),
      renderCondition: contextSrv.isSignedIn && config.snapshotEnabled && dashboard.canEditDashboard(),
      onClick: () => {
        onMenuItemClick(t('share-dashboard.menu.share-snapshot-title', 'Share snapshot'), ShareSnapshot);
      },
    });

    return menuItems.filter((item) => item.renderCondition);
  }, [onMenuItemClick, dashboard, panel]);

  return (
    <Menu data-testid={newShareButtonSelector.container}>
      {buildMenuItems().map((item) => (
        <Menu.Item
          key={item.label}
          testId={item.testId}
          label={item.label}
          icon={item.icon}
          description={item.description}
          onClick={() => item.onClick(dashboard)}
        />
      ))}
    </Menu>
  );
}
