import React from 'react';

import { DashboardModel, PanelModel } from '../../state';

import { PanelHeaderMenu } from './PanelHeaderMenu';
import { PanelHeaderMenuProvider } from './PanelHeaderMenuProvider';

interface Props {
  panel: PanelModel;
  dashboard: DashboardModel;
  onClose: () => void;
}

export function PanelHeaderMenuWrapper({ panel, dashboard }: Props) {
  return (
    <PanelHeaderMenuProvider panel={panel} dashboard={dashboard}>
      {({ items }) => {
        return <PanelHeaderMenu items={items} />;
      }}
    </PanelHeaderMenuProvider>
  );
}
