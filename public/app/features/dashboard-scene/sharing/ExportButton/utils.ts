import { lastValueFrom } from 'rxjs';

import { config, getBackendSrv } from '@grafana/runtime';
import { getDashboardUrl } from 'app/features/dashboard-scene/utils/getDashboardUrl';

import { DashboardScene } from '../../scene/DashboardScene';

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
    const imageUrl = getDashboardUrl({
      uid: dashboard.state.uid,
      currentQueryParams: window.location.search,
      render: true,
      absolute: true,
      updateQuery: {
        height: -1, // this will make the image renderer scroll through the dashboard and set the appropriate height
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
