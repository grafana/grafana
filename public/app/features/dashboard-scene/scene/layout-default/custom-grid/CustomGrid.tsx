import { type ReactNode, useState } from 'react';

import { logError } from '@grafana/runtime';
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

interface Props {
  grid: SceneGridLayout;
  controller: CustomGridController;
  /** Today's grid, rendered instead if the new grid fails */
  fallback: ReactNode;
  /** Key the grid is found by as a drop target, for its own items and items dragged in from elsewhere */
  dropTargetKey?: string;
}

export function CustomGrid({ grid, controller, fallback, dropTargetKey }: Props) {
  const [hasFailed, setHasFailed] = useState(() => controller.hasRenderFailed());

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
