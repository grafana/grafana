import { useLayoutEffect } from 'react';

import { DashboardLayoutManager } from '../scene/types/DashboardLayoutManager';

import { DashboardOutlineTree } from './DashboardOutlineTree';

interface Props {
  layout: DashboardLayoutManager;
}

export function DashboardOutline({ layout }: Props) {
  const { key } = layout.useState();

  useLayoutEffect(() => layout.activateRepeaters?.(), [layout]);

  return <DashboardOutlineTree items={layout.getOutline()} key={key} />;
}
