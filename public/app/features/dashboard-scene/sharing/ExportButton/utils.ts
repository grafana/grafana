import { lastValueFrom } from 'rxjs';

import { config, getBackendSrv } from '@grafana/runtime';
import { getDashboardUrl } from 'app/features/dashboard-scene/utils/getDashboardUrl';

import { DashboardScene } from '../../scene/DashboardScene';
import { DashboardGridItem } from '../../scene/layout-default/DashboardGridItem';
import { DefaultGridLayoutManager } from '../../scene/layout-default/DefaultGridLayoutManager';

/**
 * Constants for grid layout calculations
 */
export const GRID_CELL_HEIGHT = 30; // Height of a single grid cell in pixels
export const GRID_CELL_MARGIN = 8; // Margin between grid cells in pixels
export const EXTRA_PADDING = 80; // Additional padding for the dashboard image
export const MIN_DASHBOARD_HEIGHT = 400; // Minimum height of the dashboard image

/**
 * Supported image formats for export
 */
export type ImageFormat = 'png' | 'jpg';

/**
 * Options for generating a dashboard image
 */
export interface ImageGenerationOptions {
  dashboard: DashboardScene;
  format?: ImageFormat;
  scale?: number;
}

/**
 * Result of image generation attempt
 */
export interface ImageGenerationResult {
  blob: Blob;
  error?: string;
}

/**
 * Type guard for DefaultGridLayoutManager
 */
function isDefaultGridLayoutManager(obj: unknown): obj is DefaultGridLayoutManager {
  return (
    obj instanceof DefaultGridLayoutManager ||
    (typeof obj === 'object' &&
      obj !== null &&
      'constructor' in obj &&
      obj.constructor?.name === 'DefaultGridLayoutManager')
  );
}

/**
 * Type guard for DashboardGridItem
 */
function isDashboardGridItem(obj: unknown): obj is DashboardGridItem {
  return (
    obj instanceof DashboardGridItem ||
    (typeof obj === 'object' && obj !== null && 'constructor' in obj && obj.constructor?.name === 'DashboardGridItem')
  );
}

/**
 * Calculates height based on grid layout
 * @param layout The grid layout manager
 * @returns The calculated height in pixels
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
 * @param container The container element containing panels
 * @returns The calculated height in pixels
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
      // Continue with other panels if one fails
      continue;
    }
  }

  return maxBottom - containerTop + EXTRA_PADDING;
}

/**
 * Calculates the total height needed for the dashboard
 * @param dashboard The dashboard scene
 * @returns The calculated height in pixels
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
 * @param options The options for image generation
 * @returns A promise that resolves to the image generation result
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
      absolute: true,
      updateQuery: {
        width: Math.round(window.innerWidth * scale),
        height: Math.round(height * scale),
        format,
        scale,
        kiosk: true,
        hideNav: true,
        orgId: String(config.bootData.user.orgId),
        fullPageImage: true,
      },
    });

    const response = await lastValueFrom(
      getBackendSrv().fetch({
        url: imageUrl,
        responseType: 'blob',
      })
    );

    if (!response.ok) {
      return {
        blob: new Blob(),
        error: `Failed to generate image: ${response.status} ${response.statusText}`,
      };
    }

    if (!(response.data instanceof Blob)) {
      return {
        blob: new Blob(),
        error: 'Invalid response data format',
      };
    }

    return {
      blob: response.data,
    };
  } catch (error) {
    return {
      blob: new Blob(),
      error: error instanceof Error ? error.message : 'Failed to generate image',
    };
  }
}
