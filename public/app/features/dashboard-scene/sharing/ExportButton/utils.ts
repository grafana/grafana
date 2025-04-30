import { lastValueFrom } from 'rxjs';

import { config, getBackendSrv } from '@grafana/runtime';
import { getDashboardUrl } from 'app/features/dashboard-scene/utils/getDashboardUrl';

import { DashboardScene } from '../../scene/DashboardScene';
import { DashboardGridItem } from '../../scene/layout-default/DashboardGridItem';
import { DefaultGridLayoutManager } from '../../scene/layout-default/DefaultGridLayoutManager';

export const GRID_CELL_HEIGHT = 30;
export const GRID_CELL_MARGIN = 8;
export const EXTRA_PADDING = 40;
export const MIN_DASHBOARD_HEIGHT = 400;

interface GridItem {
  state: {
    height?: number;
    y?: number;
  };
}

interface GridLayout {
  state: {
    grid: {
      state: {
        children: GridItem[];
      };
    };
  };
}

interface ImageGenerationOptions {
  dashboard: DashboardScene;
  format?: 'png' | 'jpg';
  scale?: number;
}

interface ImageGenerationResult {
  blob: Blob;
  error?: string;
}

interface FetchResponse {
  ok: boolean;
  status: number;
  statusText: string;
  data: ArrayBuffer;
}

function isDefaultGridLayoutManager(obj: unknown): obj is DefaultGridLayoutManager {
  return obj instanceof DefaultGridLayoutManager || obj?.constructor?.name === 'DefaultGridLayoutManager';
}

function isDashboardGridItem(obj: unknown): obj is DashboardGridItem {
  return obj instanceof DashboardGridItem || obj?.constructor?.name === 'DashboardGridItem';
}

/**
 * Calculates height based on grid layout
 */
export function calculateGridBasedHeight(layout: DefaultGridLayoutManager): number {
  const gridItems = layout.state.grid.state.children.filter(isDashboardGridItem);

  if (gridItems.length === 0) {
    return EXTRA_PADDING;
  }

  let maxBottom = 0;

  for (const item of gridItems) {
    const height = item.state.height ?? 0;
    const y = item.state.y ?? 0;
    const bottom = y + height;
    maxBottom = Math.max(maxBottom, bottom);
  }

  return maxBottom * GRID_CELL_HEIGHT + (maxBottom - 1) * GRID_CELL_MARGIN + EXTRA_PADDING;
}

/**
 * Calculates height based on DOM elements
 */
export function calculateDOMBasedHeight(container: HTMLElement): number {
  const panels = Array.from(container.querySelectorAll('.panel-container'));
  if (panels.length === 0) {
    return 0;
  }

  const containerTop = container.getBoundingClientRect().top;
  let maxBottom = 0;

  for (const panel of panels) {
    try {
      const rect = panel.getBoundingClientRect();
      if (rect) {
        maxBottom = Math.max(maxBottom, rect.bottom);
      }
    } catch (error) {
      console.warn('Error getting panel dimensions:', error);
    }
  }

  return maxBottom - containerTop + EXTRA_PADDING;
}

/**
 * Calculates the total height needed for the dashboard
 */
export function calculateDashboardHeight(dashboard: DashboardScene): number {
  let totalHeight = MIN_DASHBOARD_HEIGHT;

  // Calculate height based on grid layout if available
  if (dashboard.state.body && isDefaultGridLayoutManager(dashboard.state.body)) {
    totalHeight = calculateGridBasedHeight(dashboard.state.body);
  }

  // Calculate height based on DOM elements if available
  const container = document.querySelector('.dashboard-container');
  if (container instanceof HTMLElement) {
    const domHeight = calculateDOMBasedHeight(container);
    totalHeight = Math.max(totalHeight, domHeight);
  }

  return Math.max(totalHeight, MIN_DASHBOARD_HEIGHT);
}

/**
 * Generates a dashboard image using the renderer service
 */
export async function generateDashboardImage({
  dashboard,
  format = 'png',
  scale = config.rendererDefaultImageScale || 1,
}: ImageGenerationOptions): Promise<ImageGenerationResult> {
  if (!config.rendererAvailable) {
    return {
      blob: new Blob(),
      error: 'Image renderer plugin not installed',
    };
  }

  try {
    const height = calculateDashboardHeight(dashboard);
    const imageUrl = getDashboardUrl({
      uid: dashboard.state.uid,
      currentQueryParams: window.location.search,
      render: true,
      updateQuery: {
        width: Math.round(window.innerWidth * scale),
        height: Math.round(height * scale),
        format,
      },
    });

    const response = await lastValueFrom(
      getBackendSrv().fetch({
        url: imageUrl,
        responseType: 'blob',
      })
    );

    if (!isFetchResponse(response)) {
      return {
        blob: new Blob(),
        error: 'Invalid response format',
      };
    }

    if (!response.ok) {
      return {
        blob: new Blob(),
        error: `Failed to generate image: ${response.status} ${response.statusText}`,
      };
    }

    return {
      blob: new Blob([response.data], { type: `image/${format}` }),
    };
  } catch (error) {
    return {
      blob: new Blob(),
      error: error instanceof Error ? error.message : 'Failed to generate image',
    };
  }
}

function isFetchResponse(obj: unknown): obj is FetchResponse {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    'ok' in obj &&
    'status' in obj &&
    'statusText' in obj &&
    'data' in obj &&
    obj.data instanceof ArrayBuffer
  );
}
