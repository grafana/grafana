import { FC } from 'react';

import { DashboardScene } from '../DashboardScene';

export interface ToolbarAction {
  key: string;
  component: FC<ToolbarActionProps>;
  group: string;
  condition: boolean;
}

export interface ToolbarActionProps {
  dashboard: DashboardScene;
}
