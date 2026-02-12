import { cloneDeep } from 'lodash';

import { PanelPluginVisualizationSuggestion, VisualizationSuggestionScore } from '@grafana/data';
import { createTool, type InlineToolRunnable, type ToolOutput } from '@grafana/assistant';

import { EnrichedAISuggestion, SuggestVisualizationsInput } from '../types';

/**
 * Creates the suggest_visualizations tool that AI must call to submit recommendations.
 *
 * This tool validates plugin IDs and enriches suggestions with options/fieldConfig
 * from rule-based suggestions when available.
 */
export function createSuggestVisualizationsTool(
  validPluginIds: Set<string>,
  ruleBasedSuggestions: PanelPluginVisualizationSuggestion[],
  onSuggestionsReceived: (suggestions: EnrichedAISuggestion[]) => void
): InlineToolRunnable {
  return createTool(
    async (input: SuggestVisualizationsInput): Promise<ToolOutput> => {
      const enriched: EnrichedAISuggestion[] = [];
      const errors: string[] = [];

      for (const suggestion of input.suggestions) {
        // Validate plugin ID
        if (!validPluginIds.has(suggestion.pluginId)) {
          errors.push(`Invalid pluginId: ${suggestion.pluginId}`);
          continue;
        }

        // Find matching rule-based suggestion for options/fieldConfig
        const ruleBased = ruleBasedSuggestions.find((r) => r.pluginId === suggestion.pluginId);

        // Generate a unique hash for the suggestion
        const hash = `ai-${suggestion.pluginId}-${suggestion.name.replace(/\s+/g, '-').toLowerCase()}`;

        enriched.push({
          pluginId: suggestion.pluginId,
          name: suggestion.name,
          hash,
          description: suggestion.reason,
          reason: suggestion.reason,
          // Deep clone to avoid read-only errors when Grafana modifies these
          options: ruleBased?.options ? cloneDeep(ruleBased.options) : undefined,
          fieldConfig: ruleBased?.fieldConfig ? cloneDeep(ruleBased.fieldConfig) : undefined,
          score: VisualizationSuggestionScore.Best, // AI suggestions get highest priority
          isAISuggestion: true,
        });
      }

      // Call the callback with enriched suggestions
      onSuggestionsReceived(enriched);

      const message =
        errors.length > 0
          ? `Accepted ${enriched.length} suggestions. Errors: ${errors.join(', ')}`
          : `Accepted ${enriched.length} visualization suggestions.`;

      return [message, enriched];
    },
    {
      name: 'suggest_visualizations',
      description: `Submit your visualization suggestions. You MUST call this tool to provide your recommendations. Each suggestion needs a pluginId (from the available list), a short name, and a reason explaining why it fits the data.`,
      inputSchema: {
        type: 'object',
        properties: {
          suggestions: {
            type: 'array',
            description: 'List of visualization suggestions, ordered by relevance (best first)',
            items: {
              type: 'object',
              properties: {
                pluginId: {
                  type: 'string',
                  description: 'Plugin ID from the availableVisualizations list',
                },
                name: {
                  type: 'string',
                  description: 'Short display name (2-4 words)',
                },
                reason: {
                  type: 'string',
                  description: 'One sentence explaining why this visualization fits the data',
                },
              },
              required: ['pluginId', 'name', 'reason'],
            },
            minItems: 1,
            maxItems: 5,
          },
        },
        required: ['suggestions'],
      },
      validate: (input) => input as SuggestVisualizationsInput,
      responseFormat: 'content_and_artifact',
    }
  );
}
