import { ComponentType } from 'react';

import { IconName } from '@grafana/ui';

import { DashboardModel } from '../../state';

export interface SettingsPage {
  id: string;
  title: string;
  icon: IconName;
  component: ComponentType<SettingsPageProps>;
}

export interface SettingsPageProps {
  dashboard: DashboardModel;
  editIndex?: number;
}
