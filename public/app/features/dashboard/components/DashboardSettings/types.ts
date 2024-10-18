import { ComponentType } from 'react';

import { NavModel } from '@grafana/data';
import { IconName } from '@grafana/ui';

import { DashboardModel } from '../../state';

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
