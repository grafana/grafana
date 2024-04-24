import React from 'react';
import { useAsyncFn } from 'react-use';

import { Menu } from '@grafana/ui';

import { createAndCopyDashboardShortLink } from '../../../../core/utils/shortLinks';
import { SceneDrawerAsScene } from '../../../trails/Integrations/SceneDrawer';
import { DashboardScene } from '../../scene/DashboardScene';

import { ShareExternallyDrawer } from './ShareExternallyDrawer';

export default function ShareMenu({ dashboard }: { dashboard: DashboardScene }) {
  const [_, buildUrl] = useAsyncFn(async () => {
    return await createAndCopyDashboardShortLink(dashboard, { useAbsoluteTimeRange: true, theme: 'current' });
  }, [dashboard]);

  const getAsyncText = async () => {
    return await buildUrl();
  };

  const onShareExternallyClick = () => {
    const drawer = new SceneDrawerAsScene({
      title: 'Share externally',
      size: 'md',
      closeOnMaskClick: false,
      scene: new ShareExternallyDrawer({ dashboardRef: dashboard.getRef() }),
      onDismiss: () => dashboard.closeModal(),
    });

    dashboard.showModal(drawer);
  };

  return (
    <Menu>
      <Menu.Item label="Share internally" description="Copy link" icon="building" onClick={getAsyncText} />
      <Menu.Item label="Share externally" icon="share-alt" onClick={onShareExternallyClick} />
    </Menu>
  );
}
