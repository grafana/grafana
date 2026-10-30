import { type ReactNode, useEffect, useState } from 'react';

import { logError, logMeasurement } from '@grafana/runtime';
import { type SceneGridLayout } from '@grafana/scenes';
import { ErrorBoundary } from '@grafana/ui';
import { isDashboardNewLayoutsEnabled } from 'app/features/dashboard/api/utils';

import { isUnifiedDragAndDropEnabled } from '../../layouts-shared/unifiedDragAndDrop';

import { type CustomGridController } from './CustomGridController';
import { CustomGridRenderer } from './CustomGridRenderer';
import { hasGridRows } from './gridItemLayout';

/**
 * Whether a custom grid is rendered by the new grid instead of react-grid-layout. The new grid is used
 * for the whole edit session (every mode in which the dashboard is editing), so switching between those
 * modes does not remount the panels. It needs the dynamic dashboards layouts, since drag and drop is
 * driven by their layout orchestrator. Grids with rows and grids that fit panels to the screen are not
 * supported by the new grid.
 */
export function shouldRenderCustomGrid(grid: SceneGridLayout, isEditing: boolean): boolean {
  return (
    isEditing &&
    isUnifiedDragAndDropEnabled() &&
    isDashboardNewLayoutsEnabled() &&
    !grid.state.UNSAFE_fitPanels &&
    !hasGridRows(grid)
  );
}

/**
 * Counts renders of the new grid in edit sessions and how many fell back to the old grid, so the rollout can tell
 * the fallback rate: the sum of `fallback` over the sum of `rendered`. Each grid counts once per page load.
 */
export const CUSTOM_GRID_RENDER_MEASUREMENT = 'dashboard_custom_grid_render';
const countedRenders = new WeakSet<CustomGridController>();

interface Props {
  grid: SceneGridLayout;
  controller: CustomGridController;
  /** Renders are only counted in edit sessions */
  isEditing: boolean;
  /** Today's grid, rendered instead if the new grid fails */
  fallback: ReactNode;
  /** Key the grid is found by as a drop target, for its own items and items dragged in from elsewhere */
  dropTargetKey?: string;
}

export function CustomGrid({ grid, controller, isEditing, fallback, dropTargetKey }: Props) {
  const [hasFailed, setHasFailed] = useState(() => controller.hasRenderFailed());

  // Runs after the error boundary caught an error in the first render, so that one counts as a fallback
  useEffect(() => {
    if (isEditing && !countedRenders.has(controller)) {
      countedRenders.add(controller);
      logMeasurement(CUSTOM_GRID_RENDER_MEASUREMENT, { rendered: 1, fallback: controller.hasRenderFailed() ? 1 : 0 });
    }
  }, [controller, isEditing]);

  if (hasFailed) {
    return fallback;
  }

  // The fallback is rendered outside of the boundary, so that an error in it is not caught here again
  return (
    <ErrorBoundary
      boundaryName="custom-grid"
      errorLogger={ignoreError}
      onError={(error) => {
        if (controller.markRenderFailed()) {
          reportRenderFailure(error);
          // A grid that already counted its render, failing later on
          if (countedRenders.has(controller)) {
            logMeasurement(CUSTOM_GRID_RENDER_MEASUREMENT, { rendered: 0, fallback: 1 });
          }
        }
        setHasFailed(true);
      }}
    >
      {({ error }) =>
        error ? null : <CustomGridRenderer grid={grid} controller={controller} dropTargetKey={dropTargetKey} />
      }
    </ErrorBoundary>
  );
}

// The default logger reports the error as is, and its message could contain keys from the dashboard
function ignoreError() {}

function reportRenderFailure(error: Error) {
  logError(new Error('Custom grid failed to render, fell back to the react-grid-layout grid'), {
    errorName: error.name,
  });
}
