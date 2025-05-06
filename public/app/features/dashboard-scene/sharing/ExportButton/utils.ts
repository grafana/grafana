import { lastValueFrom } from 'rxjs';

import { config, getBackendSrv } from '@grafana/runtime';
import { getDashboardUrl } from 'app/features/dashboard-scene/utils/getDashboardUrl';

import { DashboardScene } from '../../scene/DashboardScene';
import { DashboardGridItem } from '../../scene/layout-default/DashboardGridItem';

/**
 * Error types for image generation
 */
export enum ImageGenerationError {
  RENDERER_NOT_AVAILABLE = 'renderer_not_available',
  GENERATION_FAILED = 'generation_failed',
  INVALID_RESPONSE = 'invalid_response',
  NETWORK_ERROR = 'network_error',
}

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
  errorCode?: ImageGenerationError;
}

/**
 * Calculates the total dimensions needed for the dashboard
 * @param dashboard The dashboard scene
 * @returns The calculated dimensions in pixels
 */
export function calculateDashboardDimensions(dashboard: DashboardScene): { width: number; height: number } {
  // Get all panels from the layout manager
  const panels = dashboard.state.body.getVizPanels();

  // Default dimensions
  let maxWidth = window.innerWidth;
  let maxHeight = MIN_DASHBOARD_HEIGHT;

  // Calculate dimensions based on grid positions
  for (const panel of panels) {
    const parent = panel.parent;
    if (parent instanceof DashboardGridItem) {
      const gridPos = parent.state;
      const y = gridPos.y ?? 0;
      const height = gridPos.height ?? 0;
      const x = gridPos.x ?? 0;
      const width = gridPos.width ?? 0;

      // Calculate total height including margins between cells
      const panelBottom =
        y * (GRID_CELL_HEIGHT + GRID_CELL_MARGIN) + height * GRID_CELL_HEIGHT + (height - 1) * GRID_CELL_MARGIN;
      // Calculate total width including margins between cells
      const panelRight =
        x * (GRID_CELL_HEIGHT + GRID_CELL_MARGIN) + width * GRID_CELL_HEIGHT + (width - 1) * GRID_CELL_MARGIN;

      maxHeight = Math.max(maxHeight, panelBottom);
      maxWidth = Math.max(maxWidth, panelRight);
    }
  }

  // Add extra padding for better visualization
  return {
    width: maxWidth + EXTRA_PADDING,
    height: maxHeight + EXTRA_PADDING,
  };
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
      errorCode: ImageGenerationError.RENDERER_NOT_AVAILABLE,
    };
  }

  try {
    const dimensions = calculateDashboardDimensions(dashboard);
    const imageUrl = getDashboardUrl({
      uid: dashboard.state.uid,
      currentQueryParams: window.location.search,
      render: true,
      absolute: true,
      updateQuery: {
        width: Math.round(dimensions.width * scale),
        height: Math.round(dimensions.height * scale),
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
        errorCode: ImageGenerationError.GENERATION_FAILED,
      };
    }

    if (!(response.data instanceof Blob)) {
      return {
        blob: new Blob(),
        error: 'Invalid response data format',
        errorCode: ImageGenerationError.INVALID_RESPONSE,
      };
    }

    return {
      blob: response.data,
    };
  } catch (error) {
    return {
      blob: new Blob(),
      error: error instanceof Error ? error.message : 'Failed to generate image',
      errorCode: ImageGenerationError.NETWORK_ERROR,
    };
  }
}
