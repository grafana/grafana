import { type ReactNode, useEffect, useState } from 'react';

import { logError, logMeasurement } from '@grafana/runtime';
import { type SceneGridLayout } from '@grafana/scenes';
import { ErrorBoundary } from '@grafana/ui';
import { isDashboardNewLayoutsEnabled } from 'app/features/dashboard/api/utils';

import { isNewGridViewEnabled, isUnifiedDragAndDropEnabled } from '../../layouts-shared/unifiedDragAndDrop';

import { type CustomGridController } from './CustomGridController';
import { CustomGridRenderer } from './CustomGridRenderer';
import { hasGridRows } from './gridItemLayout';

/**
 * Whether a custom grid is rendered by the new grid instead of react-grid-layout. In edit sessions (every
 * mode in which the dashboard is editing) with the unified drag and drop flag, and in view mode too with
 * the new grid view flag. Then a dashboard keeps its renderer when editing starts or ends, so the panels
 * are not remounted. It needs the dynamic dashboards layouts, since drag and drop is driven by their layout
 * orchestrator. Grids with rows and grids that fit panels to the screen are not supported by the new grid.
 */
export function shouldRenderCustomGrid(grid: SceneGridLayout, isEditing: boolean): boolean {
  const isEnabled = isEditing ? isUnifiedDragAndDropEnabled() : isNewGridViewEnabled();
  return isEnabled && isDashboardNewLayoutsEnabled() && !grid.state.UNSAFE_fitPanels && !hasGridRows(grid);
}

/**
 * Counts renders of the new grid and how many fell back to the old grid, so the rollout can tell the fallback
 * rate: the sum of `fallback` over the sum of `rendered`. `editing` tells edit sessions (1) from view mode (0),
 * which only renders the new grid with the new grid view flag on. Each grid counts once per page load in
 * each of them.
 */
export const CUSTOM_GRID_RENDER_MEASUREMENT = 'dashboard_custom_grid_render';
const countedEditRenders = new WeakSet<CustomGridController>();
const countedViewRenders = new WeakSet<CustomGridController>();

interface Props {
  grid: SceneGridLayout;
  controller: CustomGridController;
  /** The grid only takes part in drags and resizes while editing */
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
    const counted = isEditing ? countedEditRenders : countedViewRenders;
    if (!counted.has(controller)) {
      counted.add(controller);
      logMeasurement(CUSTOM_GRID_RENDER_MEASUREMENT, {
        rendered: 1,
        fallback: controller.hasRenderFailed() ? 1 : 0,
        editing: isEditing ? 1 : 0,
      });
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
          if ((isEditing ? countedEditRenders : countedViewRenders).has(controller)) {
            logMeasurement(CUSTOM_GRID_RENDER_MEASUREMENT, { rendered: 0, fallback: 1, editing: isEditing ? 1 : 0 });
          }
        }
        setHasFailed(true);
      }}
    >
      {({ error }) =>
        error ? null : (
          <CustomGridRenderer grid={grid} controller={controller} isEditing={isEditing} dropTargetKey={dropTargetKey} />
        )
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
