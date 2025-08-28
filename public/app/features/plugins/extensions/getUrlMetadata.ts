import { GetUrlMetadataOptions, GetUrlMetadataResult } from '@grafana/runtime/internal';

import { urlRecognizersRegistry } from './registry/setup';

export async function getUrlMetadata(options: GetUrlMetadataOptions): Promise<GetUrlMetadataResult> {
  const { url } = options;
  const results: GetUrlMetadataResult = [];

  // Get all registered URL recognizers
  const state = await urlRecognizersRegistry.getState();
  const recognizers = state['url-recognizers'] || [];

  // Run all recognizers in parallel
  const promises = recognizers.map(async (recognizer) => {
    try {
      const metadata = await recognizer.recognizer(url);
      if (metadata) {
        return {
          pluginId: recognizer.pluginId,
          metadata,
        };
      }
      return null;
    } catch (error) {
      console.error(`Error in URL recognizer from plugin ${recognizer.pluginId}:`, error);
      return null;
    }
  });

  const settledResults = await Promise.allSettled(promises);

  for (const result of settledResults) {
    if (result.status === 'fulfilled' && result.value) {
      results.push(result.value);
    }
  }

  return results;
}