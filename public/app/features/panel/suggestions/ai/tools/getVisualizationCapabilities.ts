import { PanelPluginMeta } from '@grafana/data';
import { createTool, type InlineToolRunnable, type ToolOutput } from '@grafana/assistant';

import { GetVisualizationCapabilitiesInput } from '../types';

/**
 * Creates the get_visualization_capabilities tool that allows AI to query details about a specific visualization type.
 */
export function createGetVisualizationCapabilitiesTool(plugins: PanelPluginMeta[]): InlineToolRunnable {
  return createTool(
    async (input: GetVisualizationCapabilitiesInput): Promise<ToolOutput> => {
      const plugin = plugins.find((p) => p.id === input.pluginId);
      if (!plugin) {
        return `Plugin ${input.pluginId} not found.`;
      }

      const info = {
        id: plugin.id,
        name: plugin.name,
        description: plugin.info?.description,
        skipDataQuery: plugin.skipDataQuery,
        supportsSuggestions: plugin.suggestions,
      };

      return [JSON.stringify(info, null, 2), info];
    },
    {
      name: 'get_visualization_capabilities',
      description: 'Get detailed information about a specific visualization type',
      inputSchema: {
        type: 'object',
        properties: {
          pluginId: {
            type: 'string',
            description: 'The visualization plugin ID',
          },
        },
        required: ['pluginId'],
      },
      validate: (input) => input as GetVisualizationCapabilitiesInput,
    }
  );
}
