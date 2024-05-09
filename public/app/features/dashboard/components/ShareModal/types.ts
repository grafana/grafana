import React from 'react';

import { NavModelItem } from '@grafana/data';
// @todo: replace barrel import path
import { DashboardModel, PanelModel } from 'app/features/dashboard/state/index';

export interface ShareModalTabProps {
  dashboard: DashboardModel;
  panel?: PanelModel;
  onDismiss?(): void;
}

export interface ShareModalTabModel {
  label: string;
  value: string;
  tabSuffix?: NavModelItem['tabSuffix'];
  component: React.ComponentType<ShareModalTabProps>;
}
