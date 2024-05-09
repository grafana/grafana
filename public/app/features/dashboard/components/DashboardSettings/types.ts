import { ComponentType } from 'react';

import { NavModel } from '@grafana/data';
import { IconName } from '@grafana/ui';

// @todo: replace barrel import path
import { DashboardModel } from '../../state/index';

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
