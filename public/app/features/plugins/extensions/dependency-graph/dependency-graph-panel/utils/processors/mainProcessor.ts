import { GraphData, PanelOptions } from '../../types';
import { getCacheKey, getCachedResult, getPluginData, setCachedResult } from '../helpers/dataAccess';

import { processPluginDataToAddedComponentsGraph } from './addedComponentsProcessor';
import { processPluginDataToAddedFunctionsGraph } from './addedFunctionsProcessor';
import { processPluginDataToAddedLinksGraph } from './addedLinksProcessor';
import { processPluginDataToExposeGraph } from './exposedComponentsProcessor';
import { processPluginDataToExtensionPointGraph } from './extensionPointProcessor';

const ENABLE_DEBUG_LOGS = true; // Set to true for debugging

/**
 * Processes plugin data from data.json into a graph format for visualization.
 *
 * This is the main entry point for data processing. It routes to the appropriate
 * processor based on the visualization mode and implements result caching for
 * performance optimization.
 *
 * @param options - Panel configuration options that determine visualization mode and filtering
 * @returns GraphData structure containing nodes, dependencies, and extension information
 *
 * @example
 * ```typescript
 * const options: PanelOptions = {
 *   visualizationMode: 'addedlinks',
 *   selectedContentProviders: [],
 *   selectedContentConsumers: []
 * };
 * const graphData = processPluginDataToGraph(options);
 * ```
 */
export const processPluginDataToGraph = (options: PanelOptions): GraphData => {
  if (ENABLE_DEBUG_LOGS) {
    console.log('processPluginDataToGraph - called with options:', options);
  }

  // Check cache first
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
  const cacheKey = getCacheKey(options as unknown as Record<string, unknown>);
  const cachedResult = getCachedResult<GraphData>(cacheKey);
  if (cachedResult) {
    if (ENABLE_DEBUG_LOGS) {
      console.log('processPluginDataToGraph - returning cached result for:', cacheKey);
    }
    return cachedResult;
  }

  const pluginData = getPluginData();
  if (ENABLE_DEBUG_LOGS) {
    console.log('processPluginDataToGraph - processing plugin data:', Object.keys(pluginData).length, 'plugins');
  }

  // Route to the appropriate processor based on visualization mode
  let result: GraphData;
  switch (options.visualizationMode) {
    case 'exposedComponents':
      if (ENABLE_DEBUG_LOGS) {
        console.log('processPluginDataToGraph - routing to exposed components mode');
      }
      result = processPluginDataToExposeGraph(options, pluginData);
      break;
    case 'extensionpoint':
      if (ENABLE_DEBUG_LOGS) {
        console.log('processPluginDataToGraph - routing to extension point mode');
      }
      result = processPluginDataToExtensionPointGraph(options, pluginData);
      break;
    case 'addedlinks':
      if (ENABLE_DEBUG_LOGS) {
        console.log('processPluginDataToGraph - routing to added links mode');
      }
      result = processPluginDataToAddedLinksGraph(options, pluginData);
      break;
    case 'addedcomponents':
      if (ENABLE_DEBUG_LOGS) {
        console.log('processPluginDataToGraph - routing to added components mode');
      }
      result = processPluginDataToAddedComponentsGraph(options, pluginData);
      break;
    case 'addedfunctions':
      if (ENABLE_DEBUG_LOGS) {
        console.log('processPluginDataToGraph - routing to added functions mode');
      }
      result = processPluginDataToAddedFunctionsGraph(options, pluginData);
      break;
    default:
      if (ENABLE_DEBUG_LOGS) {
        console.log('processPluginDataToGraph - routing to added links mode (default)');
      }
      result = processPluginDataToAddedLinksGraph(options, pluginData);
      break;
  }

  // Cache the result
  setCachedResult(cacheKey, result);
  return result;
};

// Keep the original function for backward compatibility, but it now just calls the new one
export const processTableDataToGraph = (data: unknown, options: PanelOptions): GraphData => {
  if (ENABLE_DEBUG_LOGS) {
    console.log('processTableDataToGraph - redirecting to processPluginDataToGraph');
  }
  return processPluginDataToGraph(options);
};
