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

//TODO change name
type customDashboardTabType = new (...args: SceneShareDrawerState[]) => SceneObject;
interface ShareDrawerMenuItem {
  testId: string;
  label: string;
  description?: string;
  icon: IconName;
  condition: boolean;
  onClick: (d: DashboardScene) => void;
}

const customShareDrawerItem: ShareDrawerMenuItem[] = [];

export function addDashboardShareDrawerItem(item: ShareDrawerMenuItem) {
  customShareDrawerItem.push(item);
}

export default function ShareMenu({ dashboard, panel }: { dashboard: DashboardScene; panel?: VizPanel }) {
  const buildMenuItems = useCallback(() => {
    const menuItems: ShareDrawerMenuItem[] = [];

    menuItems.push({
      testId: newShareButtonSelector.shareInternally,
      icon: 'building',
      label: t('share-dashboard.menu.share-internally-title', 'Share internally'),
      description: t('share-dashboard.menu.share-internally-description', 'Advanced settings'),
      condition: true,
      onClick: () =>
        onMenuItemClick(t('share-dashboard.menu.share-internally-title', 'Share internally'), ShareInternally),
    });

    menuItems.push({
      testId: newShareButtonSelector.shareExternally,
      icon: 'share-alt',
      label: t('share-dashboard.menu.share-externally-title', 'Share externally'),
      condition: !panel && isPublicDashboardsEnabled(),
      onClick: () => {
        onMenuItemClick(t('share-dashboard.menu.share-externally-title', 'Share externally'), ShareExternally);
      },
    });

    customShareDrawerItem.forEach((d) => menuItems.push(d));

    menuItems.push({
      testId: newShareButtonSelector.shareSnapshot,
      icon: 'camera',
      label: t('share-dashboard.menu.share-snapshot-title', 'Share snapshot'),
      condition: contextSrv.isSignedIn && config.snapshotEnabled && dashboard.canEditDashboard(),
      onClick: () => {
        // @ts-ignore
        onMenuItemClick(t('share-dashboard.menu.share-snapshot-title', 'Share snapshot'), ShareSnapshot);
      },
    });

    return menuItems.filter((item) => item.condition);
  }, [dashboard, panel]);

  const onMenuItemClick = (title: string, component: customDashboardTabType) => {
    const drawer = new ShareDrawer({
      title,
      body: new component({ dashboardRef: dashboard.getRef(), panelRef: panel?.getRef() }),
    });

    dashboard.showModal(drawer);
  };

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
