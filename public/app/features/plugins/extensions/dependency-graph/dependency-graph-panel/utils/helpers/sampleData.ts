import { GraphData } from '../../types';
import { processPluginDataToGraph } from '../processors/mainProcessor';

import { getDefaultOptions } from './defaults';

/**
 * Creates sample data for demonstration that matches the new data format
 */
export const createSampleData = (): GraphData => {
  // This will now use the actual data from data.json
  return processPluginDataToGraph(getDefaultOptions());
};
