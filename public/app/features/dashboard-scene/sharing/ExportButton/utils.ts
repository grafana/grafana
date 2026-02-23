import { lastValueFrom } from 'rxjs';

import { config, getBackendSrv } from '@grafana/runtime';
import { getDashboardUrl } from 'app/features/dashboard-scene/utils/getDashboardUrl';

import { contextSrv } from '../../../../core/services/context_srv';
import { DashboardScene } from '../../scene/DashboardScene';

/**
 * Options for generating a dashboard image
 */
export interface ImageGenerationOptions {
  dashboard: DashboardScene;
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
 * Generates a dashboard image using the renderer service
 * @param options The options for image generation
 * @returns A promise that resolves to the image generation result
 */
export async function generateDashboardImage({
  dashboard,
  scale = config.rendererDefaultImageScale || 2,
}: ImageGenerationOptions): Promise<ImageGenerationResult> {
  try {
    // Check if renderer plugin is available
    if (!config.rendererAvailable) {
      return {
        blob: new Blob(),
        error: 'Image renderer plugin not installed',
      };
    }

    const imageUrl = getDashboardUrl({
      uid: dashboard.state.uid,
      currentQueryParams: window.location.search,
      render: true,
      absolute: true,
      updateQuery: {
        height: -1, // image renderer will scroll through the dashboard and set the appropriate height
        width: window.innerWidth || config.rendererDefaultImageWidth || 1000,
        scale,
        kiosk: true,
        hideNav: true,
        orgId: String(contextSrv.user.orgId),
        fullPageImage: true,
      },
    });

    const response = await lastValueFrom(
      getBackendSrv().fetch<Blob>({
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

    // Validate response data format
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
      error: error instanceof Error && error.message ? error.message : 'Failed to generate image',
    };
  }
}
