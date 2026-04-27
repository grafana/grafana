import type * as React from 'react';

import type { NavModelItem } from '@grafana/data/types';
import { type LibraryPanel } from '@grafana/schema';
import { type DashboardModel } from 'app/features/dashboard/state/DashboardModel';
import { type PanelModel } from 'app/features/dashboard/state/PanelModel';

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
