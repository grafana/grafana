import * as React from 'react';

import { NavModelItem } from '@grafana/data';
import { LibraryPanel } from '@grafana/schema/dist/esm/index.gen';
import { DashboardModel } from 'app/features/dashboard/state/DashboardModel';
import { PanelModel } from 'app/features/dashboard/state/PanelModel';

export interface ShareModalTabProps {
  dashboard: DashboardModel;
  panel?: PanelModel;
  onDismiss?(): void;
  onCreateLibraryPanel?(libPanel: LibraryPanel): void;
}

export interface ShareModalTabModel {
  label: string;
  value: string;
  tabSuffix?: NavModelItem['tabSuffix'];
  component: React.ComponentType<ShareModalTabProps>;
}
