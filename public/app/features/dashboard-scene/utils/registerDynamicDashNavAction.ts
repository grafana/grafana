import React from 'react';

import { DashboardModel } from '../../dashboard/state';

interface ComponentProps {
  dashboard: DashboardModel;
}
export interface DynamicDashNavButtonModel {
  show: (props: ComponentProps) => boolean;
  component: React.FC<Partial<ComponentProps>>;
  index?: number | 'end';
}

export const dynamicDashNavActions: { left: DynamicDashNavButtonModel[]; right: DynamicDashNavButtonModel[] } = {
  left: [],
  right: [],
};

export function registerDynamicDashNavAction(side: 'left' | 'right', action: DynamicDashNavButtonModel) {
  dynamicDashNavActions[side].push(action);
}
