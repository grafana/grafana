import React from 'react';

import { NavModelItem } from '@grafana/data';
import { DashboardModel, PanelModel } from 'app/features/dashboard/state';
import { DashboardGridItem } from 'app/features/dashboard-scene/scene/DashboardGridItem';

export interface ShareModalTabProps {
  dashboard: DashboardModel;
  gridItem?: DashboardGridItem;
  panel?: PanelModel;
  onDismiss?(): void;
}

export interface ShareModalTabModel {
  label: string;
  value: string;
  tabSuffix?: NavModelItem['tabSuffix'];
  component: React.ComponentType<ShareModalTabProps>;
}
