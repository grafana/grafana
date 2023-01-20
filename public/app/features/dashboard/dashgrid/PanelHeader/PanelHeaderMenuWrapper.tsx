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
  style?: React.CSSProperties;
}

export function PanelHeaderMenuWrapper({ style, panel, dashboard, loadingState }: Props) {
  return (
    <PanelHeaderMenuProvider panel={panel} dashboard={dashboard} loadingState={loadingState}>
      {({ items }) => {
        return <PanelHeaderMenu style={style} items={items} />;
      }}
    </PanelHeaderMenuProvider>
  );
}
