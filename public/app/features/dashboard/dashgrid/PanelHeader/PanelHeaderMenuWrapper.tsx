import React from 'react';

import { LoadingState } from '@grafana/data';

import { DashboardModel, PanelModel } from '../../state';

import { PanelHeaderMenu } from './PanelHeaderMenu';
import { PanelHeaderMenuProvider } from './PanelHeaderMenuProvider';

interface Props {
  panel: PanelModel;
  dashboard: DashboardModel;
  loadingState?: LoadingState;
  onClose: () => void;
}

export function PanelHeaderMenuWrapper({ panel, dashboard, loadingState }: Props) {
  return (
    <PanelHeaderMenuProvider panel={panel} dashboard={dashboard} loadingState={loadingState}>
      {({ items }) => {
        return <PanelHeaderMenu items={items} />;
      }}
    </PanelHeaderMenuProvider>
  );
}
