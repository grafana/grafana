import { type ComponentType } from 'react';

import { type NavModel } from '@grafana/data';
import { type IconName } from '@grafana/ui';

import { type DashboardModel } from '../../state/DashboardModel';

export interface SettingsPage {
  id: string;
  title: string;
  icon: IconName;
  component: ComponentType<SettingsPageProps>;
  subTitle?: string;
}

export interface SettingsPageProps {
  dashboard: DashboardModel;
  sectionNav: NavModel;
  editIndex?: number;
}
