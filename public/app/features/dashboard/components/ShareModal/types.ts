import React from 'react';
import { PanelModel } from '@grafana/data';
import { DashboardModel, PanelModel as InternalPanelModel } from 'app/features/dashboard/state';

export interface ShareModalTabProps {
  dashboard: DashboardModel;
  panel?: PanelModel;
  onDismiss?(): void;
}

type ShareModalTabPropsWithInternalModel = ShareModalTabProps & { panel?: InternalPanelModel };
export type ShareModalTab =
  | React.ComponentType<ShareModalTabProps>
  | React.ComponentType<ShareModalTabPropsWithInternalModel>;

export interface ShareModalTabModel {
  label: string;
  value: string;
  component: ShareModalTab;
}
