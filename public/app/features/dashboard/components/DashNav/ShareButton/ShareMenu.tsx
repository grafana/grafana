import React, { useContext } from 'react';
import { useLocation } from 'react-router-dom';

import { config, locationService } from '@grafana/runtime';
import { Menu, ModalsContext } from '@grafana/ui';

import { DashboardModel } from '../../../state';

import { ShareSlackModal } from './ShareSlackModal';

export function ShareMenu({ dashboard }: { dashboard: DashboardModel }) {
  const location = useLocation();
  const { showModal } = useContext(ModalsContext);

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
      {isSlackPreviewEnabled && (
        <Menu.Item
          key="share-to-slack"
          icon="slack"
          label="Share to Slack"
          onClick={() => {
            showModal(ShareSlackModal, {
              dashboardUid: dashboard.uid,
              resourcePath: `${location.pathname}${location.search}${location.hash}`.substring(1),
            });
          }}
        />
      )}
    </Menu>
  );
}
