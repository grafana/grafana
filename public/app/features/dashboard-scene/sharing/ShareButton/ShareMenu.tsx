import React from 'react';

import { selectors as e2eSelectors } from '@grafana/e2e-selectors';
import { VizPanel } from '@grafana/scenes';
import { Menu } from '@grafana/ui';
import { t } from 'app/core/internationalization';

import { isPublicDashboardsEnabled } from '../../../dashboard/components/ShareModal/SharePublicDashboard/SharePublicDashboardUtils';
import { DashboardScene } from '../../scene/DashboardScene';
import { ShareDrawer } from '../ShareDrawer/ShareDrawer';

import { ShareExternally } from './share-externally/ShareExternally';
import { ShareInternally } from './share-internally/ShareInternally';
import { ShareSnapshot } from './share-snapshot/ShareSnapshot';

const newShareButtonSelector = e2eSelectors.pages.Dashboard.DashNav.newShareButton.menu;

export default function ShareMenu({ dashboard, panel }: { dashboard: DashboardScene; panel?: VizPanel }) {
  const onShareInternallyClick = () => {
    const drawer = new ShareDrawer({
      title: t('share-dashboard.menu.share-internally-title', 'Share internally'),
      body: new ShareInternally({ panelRef: panel?.getRef() }),
    });

    dashboard.showModal(drawer);
  };

  const onShareExternallyClick = () => {
    const drawer = new ShareDrawer({
      title: t('share-dashboard.menu.share-externally-title', 'Share externally'),
      body: new ShareExternally({}),
    });

    dashboard.showModal(drawer);
  };

  const onShareSnapshotClick = () => {
    const drawer = new ShareDrawer({
      title: t('share-dashboard.menu.share-snapshot-title', 'Share snapshot'),
      body: new ShareSnapshot({ dashboardRef: dashboard.getRef() }),
    });

    dashboard.showModal(drawer);
  };

  return (
    <Menu data-testid={newShareButtonSelector.container}>
      <Menu.Item
        testId={newShareButtonSelector.shareInternally}
        label={t('share-dashboard.menu.share-internally-title', 'Share internally')}
        description={t('share-dashboard.menu.share-internally-description', 'Advanced settings')}
        icon="building"
        onClick={onShareInternallyClick}
      />
      {isPublicDashboardsEnabled() && (
        <Menu.Item
          testId={newShareButtonSelector.shareExternally}
          label={t('share-dashboard.menu.share-externally-title', 'Share externally')}
          icon="share-alt"
          onClick={onShareExternallyClick}
        />
      )}
      <Menu.Item
        testId={newShareButtonSelector.shareSnapshot}
        label={t('share-dashboard.menu.share-snapshot-title', 'Share snapshot')}
        icon="camera"
        onClick={onShareSnapshotClick}
      />
    </Menu>
  );
}
