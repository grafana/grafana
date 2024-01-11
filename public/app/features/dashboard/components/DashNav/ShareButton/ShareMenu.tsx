import React, { useContext } from 'react';
import { useLocation } from 'react-router-dom';

import { Menu, ModalsContext } from '@grafana/ui';

import { DashboardModel } from '../../../state';
import { ShareModal } from '../../ShareModal';

import { ShareSlackModal } from './ShareSlackModal';

export function ShareMenu({ dashboard }: { dashboard: DashboardModel }) {
  const location = useLocation();
  const { showModal, hideModal } = useContext(ModalsContext);

  return (
    <Menu>
      <Menu.Item
        key="share-dashboard"
        icon="share-alt"
        label="Share dashboard"
        onClick={() => {
          showModal(ShareModal, {
            dashboard,
            onDismiss: hideModal,
          });
        }}
      />
      <Menu.Item
        key="share-to-slack"
        icon="slack"
        label="Share to slack"
        onClick={() => {
          showModal(ShareSlackModal, {
            dashboardUid: dashboard.uid,
            dashboardUrl: `${location.pathname}${location.search}${location.hash}`,
            onDismiss: hideModal,
          });
        }}
      />
    </Menu>
  );
}
