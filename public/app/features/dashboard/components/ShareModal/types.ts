import React from 'react';
import { PanelModel } from '@grafana/data';
import { DashboardModel } from 'app/features/dashboard/state';

export interface ShareModalTabProps {
  dashboard: DashboardModel;
  panel?: PanelModel;
  onDismiss?(): void;
}

export type ShareModalTab = React.ComponentType<ShareModalTabProps>;

export interface ShareModalTabModel {
  label: string;
  value: string;
  component: ShareModalTab;
}
