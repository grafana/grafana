import React from 'react';

import { LoadingState } from '@grafana/data';

import { DashboardModel, PanelModel } from '../../state';

import { PanelHeaderMenu, PanelHeaderMenuNew } from './PanelHeaderMenu';
import { PanelHeaderMenuProvider } from './PanelHeaderMenuProvider';

interface Props {
  panel: PanelModel;
  dashboard: DashboardModel;
  loadingState?: LoadingState;
  style?: React.CSSProperties;
  menuItemsClassName?: string;
  menuWrapperClassName?: string;
}

export function PanelHeaderMenuWrapper({
  panel,
  dashboard,
  loadingState,
  style,
  menuItemsClassName,
  menuWrapperClassName,
}: Props) {
  return (
    <PanelHeaderMenuProvider panel={panel} dashboard={dashboard} loadingState={loadingState}>
      {({ items }) => (
        <PanelHeaderMenu
          className={menuWrapperClassName}
          itemsClassName={menuItemsClassName}
          style={style}
          items={items}
        />
      )}
    </PanelHeaderMenuProvider>
  );
}

export function PanelHeaderMenuWrapperNew({ style, panel, dashboard, loadingState }: Props) {
  return (
    <PanelHeaderMenuProvider panel={panel} dashboard={dashboard} loadingState={loadingState}>
      {({ items }) => <PanelHeaderMenuNew style={style} items={items} />}
    </PanelHeaderMenuProvider>
  );
}
