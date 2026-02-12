import { DataFrame } from '@grafana/data';
import { createTool, type InlineToolRunnable, type ToolOutput } from '@grafana/assistant';

import { GetFieldDetailsInput } from '../types';

const MAX_SAMPLE_VALUES = 5;

/**
 * Creates the get_field_details tool that allows AI to query more details about a specific data frame.
 */
export function createGetFieldDetailsTool(series: DataFrame[]): InlineToolRunnable {
  return createTool(
    async (input: GetFieldDetailsInput): Promise<ToolOutput> => {
      const frame = series[input.frameIndex];
      if (!frame) {
        return `Frame ${input.frameIndex} not found. Available frames: 0-${series.length - 1}`;
      }

      const details = frame.fields.map((f) => ({
        name: f.name,
        type: f.type,
        labels: f.labels,
        config: {
          unit: f.config?.unit,
          displayName: f.config?.displayName,
        },
        sampleValues: f.values.slice(0, MAX_SAMPLE_VALUES),
      }));

      return [JSON.stringify(details, null, 2), details];
    },
    {
      name: 'get_field_details',
      description: 'Get detailed field information for a specific data frame including sample values',
      inputSchema: {
        type: 'object',
        properties: {
          frameIndex: {
            type: 'number',
            description: 'Index of the data frame (0-based)',
          },
        },
        required: ['frameIndex'],
      },
      validate: (input) => input as GetFieldDetailsInput,
    }
  );
}
