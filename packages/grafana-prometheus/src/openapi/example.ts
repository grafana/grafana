/**
 * Example: How to use OpenAPI types in language_provider.ts
 *
 * This shows the exact pattern for adding types to your existing code.
 */

import type { paths } from './gen-types';

// Extract types for the metadata endpoint
type MetadataResponse = paths['/metadata']['get']['responses']['200']['content']['application/json'];
type MetadataParams = paths['/metadata']['get']['parameters']['query'];

/**
 * Example: Type-safe metadata fetching
 *
 * This is how you would update the _queryMetadata method in language_provider.ts
 */
async function queryMetadata(
  request: (url: string, params?: any) => Promise<any>,
  limit?: number
): Promise<MetadataResponse> {
  // Type-safe parameters
  const params: MetadataParams = {
    limit: limit ?? 1000,
    limit_per_metric: 10,  // IDE will autocomplete this!
  };

  // Type-safe response
  const response: MetadataResponse = await request('/api/v1/metadata', params);

  // Access response with full type information
  if (response.status !== 'success') {
    throw new Error('Failed to fetch metadata');
  }

  // response.data is now typed as: { [key: string]: Metadata[] }
  return response;
}

// Extract types for the labels endpoint
type LabelsResponse = paths['/labels']['get']['responses']['200']['content']['application/json'];
type LabelsParams = paths['/labels']['get']['parameters']['query'];

/**
 * Example: Type-safe label fetching
 */
async function queryLabels(
  request: (url: string, params?: any) => Promise<any>,
  start: number,
  end: number
): Promise<string[]> {
  const params: LabelsParams = {
    start,
    end,
    'match[]': ['{job="prometheus"}'],
    limit: 1000,
  };

  const response: LabelsResponse = await request('/api/v1/labels', params);

  // response.data is typed as string[]
  return response.data;
}

// Extract types for the label values endpoint
type LabelValuesResponse = paths['/label/{name}/values']['get']['responses']['200']['content']['application/json'];
type LabelValuesParams = paths['/label/{name}/values']['get']['parameters']['query'];

/**
 * Example: Type-safe label values fetching
 */
async function queryLabelValues(
  request: (url: string, params?: any) => Promise<any>,
  labelName: string,
  start: number,
  end: number
): Promise<string[]> {
  const params: LabelValuesParams = {
    start,
    end,
    'match[]': ['{job="prometheus"}'],
    limit: 1000,
  };

  const response: LabelValuesResponse = await request(
    `/api/v1/label/${labelName}/values`,
    params
  );

  return response.data;
}

/**
 * Example: Runtime feature detection
 *
 * Detect which features are supported by checking if OpenAPI spec exists
 */
async function detectFeatures(baseUrl: string): Promise<Set<string>> {
  try {
    const response = await fetch(`${baseUrl}/api/v1/openapi.yaml`);

    if (!response.ok) {
      return new Set();  // OpenAPI not available
    }

    const spec = await response.text();
    const features = new Set<string>();

    if (spec.includes('lookback_delta')) {
      features.add('lookback_delta');
    }

    if (spec.includes('stats')) {
      features.add('stats');
    }

    return features;
  } catch {
    return new Set();
  }
}

/**
 * Usage in datasource:
 *
 * 1. Add this to language_provider.ts:
 *    import type { paths } from './openapi/generated';
 *
 * 2. Extract the types you need:
 *    type MetadataResponse = paths['/metadata']['get']['responses']['200']['content']['application/json'];
 *    type MetadataParams = paths['/metadata']['get']['parameters']['query'];
 *
 * 3. Update your methods to use the types:
 *    private async _queryMetadata(limit?: number): Promise<MetadataResponse> {
 *      const params: MetadataParams = { limit: limit ?? this.datasource.seriesLimit };
 *      const response: MetadataResponse = await this.request('/api/v1/metadata', params);
 *      return response;
 *    }
 */
