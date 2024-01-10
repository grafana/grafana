import React, { useContext } from 'react';

import { Menu, ModalsContext } from '@grafana/ui';

import { DashboardModel } from '../../../state';
import { ShareModal } from '../../ShareModal';

import { ShareSlackModal } from './ShareSlackModal';

export function ShareMenu({ dashboard }: { dashboard: DashboardModel }) {
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
            onDismiss: hideModal,
          });
        }}
      />
    </Menu>
  );
}
