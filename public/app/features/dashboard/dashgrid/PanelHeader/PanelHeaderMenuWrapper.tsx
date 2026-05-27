import * as React from 'react';

import { type LoadingState } from '@grafana/data';

import { type DashboardModel } from '../../state/DashboardModel';
import { type PanelModel } from '../../state/PanelModel';

import { PanelHeaderMenu } from './PanelHeaderMenu';
import { PanelHeaderMenuProvider } from './PanelHeaderMenuProvider';

interface Props {
  panel: PanelModel;
  dashboard: DashboardModel;
  loadingState?: LoadingState;
  style?: React.CSSProperties;
  menuItemsClassName?: string;
  menuWrapperClassName?: string;
}

export function PanelHeaderMenuWrapper({ style, panel, dashboard, loadingState }: Props) {
  return (
    <PanelHeaderMenuProvider panel={panel} dashboard={dashboard} loadingState={loadingState}>
      {({ items }) => <PanelHeaderMenu style={style} items={items} />}
    </PanelHeaderMenuProvider>
  );
}
