import { lazy, Suspense } from 'react';

import { DrilldownAppToDashboardPanelProps } from './addToDashboard/DrilldownAppToDashboardPanel';

// Lazy load the component
const DrilldownAppToDashboardPanelLazy = lazy(() => import('./addToDashboard/DrilldownAppToDashboardPanel'));

// Wrap with Suspense and properly typed props
export const DrilldownAppToDashboardPanelComponent = (props: DrilldownAppToDashboardPanelProps) => (
  <Suspense fallback={null}>
    <DrilldownAppToDashboardPanelLazy {...props} />
  </Suspense>
);
