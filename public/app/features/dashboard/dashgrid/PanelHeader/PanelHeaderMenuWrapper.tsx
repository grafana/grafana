import React from 'react';

import { LoadingState } from '@grafana/data';

import { DashboardModel, PanelModel } from '../../state';

import { PanelHeaderMenu } from './PanelHeaderMenu';
import { PanelHeaderMenuProvider } from './PanelHeaderMenuProvider';

interface Props {
  panel: PanelModel;
  dashboard: DashboardModel;
  loadingState?: LoadingState;
  style?: React.CSSProperties;
  menuItemsClassName?: string;
  menuWrapperClassName?: string;
  panelSize?: { width: number; height: number };
}

export function PanelHeaderMenuWrapper({ style, panel, dashboard, loadingState, panelSize }: Props) {
  return (
    <PanelHeaderMenuProvider panel={panel} dashboard={dashboard} loadingState={loadingState} panelSize={panelSize}>
      {({ items }) => <PanelHeaderMenu style={style} items={items} />}
    </PanelHeaderMenuProvider>
  );
}
