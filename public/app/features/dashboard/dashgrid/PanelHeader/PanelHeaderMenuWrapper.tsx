import React from 'react';

import { DashboardModel, PanelModel } from '../../state';

import { PanelHeaderMenu } from './PanelHeaderMenu';
import { PanelHeaderMenuProvider } from './PanelHeaderMenuProvider';

interface Props {
  panel: PanelModel;
  dashboard: DashboardModel;
  isStreaming?: boolean;
  onClose: () => void;
}

export function PanelHeaderMenuWrapper({ panel, dashboard, isStreaming }: Props) {
  return (
    <PanelHeaderMenuProvider panel={panel} dashboard={dashboard} isStreaming={isStreaming}>
      {({ items }) => {
        return <PanelHeaderMenu items={items} />;
      }}
    </PanelHeaderMenuProvider>
  );
}
