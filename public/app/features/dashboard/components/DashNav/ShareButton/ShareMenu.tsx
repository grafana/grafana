import React, { useContext, useEffect, useState } from 'react';

import { config, locationService } from '@grafana/runtime';
import { Menu, ModalsContext } from '@grafana/ui';

import { DashboardModel } from '../../../state';
import { buildShareUrl } from '../../ShareModal/utils';

import { ShareSlackModal } from './ShareSlackModal';

export function ShareMenu({ dashboard }: { dashboard: DashboardModel }) {
  const [shareUrl, setShareUrl] = useState<string>();
  const { showModal } = useContext(ModalsContext);

  useEffect(() => {
    const getShareUrl = async () => {
      const url = await buildShareUrl(true, 'current', undefined, false);
      setShareUrl(url);
    };

    getShareUrl();
  }, []);

  const isSlackPreviewEnabled = config.featureToggles.slackSharePreview;

  return (
    <Menu>
      <Menu.Item
        key="share-dashboard"
        icon="share-alt"
        label="Share dashboard"
        onClick={() => {
          locationService.partial({ shareView: 'link' });
        }}
      />
      {isSlackPreviewEnabled && shareUrl && (
        <Menu.Item
          key="share-to-slack"
          icon="slack"
          label="Share to Slack"
          onClick={() => {
            showModal(ShareSlackModal, {
              resourceType: 'dashboard',
              resourcePath: shareUrl,
              title: dashboard.title,
              dashboardUid: dashboard.uid,
            });
          }}
        />
      )}
    </Menu>
  );
}
