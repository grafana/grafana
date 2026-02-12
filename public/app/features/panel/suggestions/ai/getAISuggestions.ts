import { useInlineAssistant, isAssistantAvailable, type InlineToolRunnable } from '@grafana/assistant';
import { PanelData, PanelPluginVisualizationSuggestion } from '@grafana/data';

import { getAllSuggestions } from '../getAllSuggestions';

import { buildAIContext, buildUserPrompt, getFilteredPanelPlugins } from './buildAIContext';
import { SYSTEM_PROMPT, AI_SUGGESTIONS_ORIGIN } from './prompts';
import { createGetFieldDetailsTool } from './tools/getFieldDetails';
import { createGetVisualizationCapabilitiesTool } from './tools/getVisualizationCapabilities';
import { createSuggestVisualizationsTool } from './tools/suggestVisualizations';
import { EnrichedAISuggestion } from './types';

const AI_TIMEOUT_MS = 5000;

/**
 * Check if AI suggestions are available (Assistant plugin is loaded and available)
 */
export function useAISuggestionsAvailable(): boolean {
  try {
    // isAssistantAvailable returns an observable, but we can check current state
    let available = false;
    const subscription = isAssistantAvailable().subscribe((value) => {
      available = value;
    });
    subscription.unsubscribe();
    return available;
  } catch {
    return false;
  }
}

export interface AISuggestionsResult {
  aiSuggestions: EnrichedAISuggestion[];
  ruleBasedSuggestions: PanelPluginVisualizationSuggestion[];
  hasErrors: boolean;
}

/**
 * Hook to get AI-powered visualization suggestions.
 *
 * This combines AI suggestions with rule-based suggestions, using rule-based
 * as fallback and for enriching AI suggestions with options/fieldConfig.
 */
export function useAISuggestions() {
  const { generate } = useInlineAssistant();

  const getAISuggestions = async (
    data: PanelData,
    panelState: 'new' | 'editing',
    currentVisualization?: string
  ): Promise<AISuggestionsResult> => {
    // 1. Get rule-based suggestions first (always available as fallback)
    const ruleBasedResult = await getAllSuggestions(data.series);

    // 2. Build AI context
    const context = buildAIContext(data, panelState, currentVisualization);
    const validPluginIds = new Set(context.availableVisualizations.map((v) => v.id));
    const plugins = getFilteredPanelPlugins();

    // 3. Create a promise to receive the tool result
    let resolveWithSuggestions: (suggestions: EnrichedAISuggestion[]) => void;
    const suggestionsPromise = new Promise<EnrichedAISuggestion[]>((resolve) => {
      resolveWithSuggestions = resolve;
    });

    // 4. Create tools
    const tools: InlineToolRunnable[] = [
      createSuggestVisualizationsTool(validPluginIds, ruleBasedResult.suggestions, (suggestions) =>
        resolveWithSuggestions(suggestions)
      ),
      createGetFieldDetailsTool(data.series),
      createGetVisualizationCapabilitiesTool(plugins),
    ];

    // 5. Call the AI with tools
    try {
      await generate({
        origin: AI_SUGGESTIONS_ORIGIN,
        prompt: buildUserPrompt(context),
        systemPrompt: SYSTEM_PROMPT,
        tools,
        onComplete: () => {
          // If AI completes without calling the tool, resolve with empty
          resolveWithSuggestions([]);
        },
        onError: (error) => {
          console.warn('AI suggestions error:', error);
          resolveWithSuggestions([]);
        },
      });
    } catch (error) {
      console.warn('AI suggestions generation failed:', error);
      resolveWithSuggestions([]);
    }

    // 6. Wait for tool result (with timeout)
    const timeout = new Promise<EnrichedAISuggestion[]>((resolve) => setTimeout(() => resolve([]), AI_TIMEOUT_MS));

    const aiSuggestions = await Promise.race([suggestionsPromise, timeout]);

    return {
      aiSuggestions,
      ruleBasedSuggestions: ruleBasedResult.suggestions,
      hasErrors: ruleBasedResult.hasErrors,
    };
  };

  return { getAISuggestions };
}

/**
 * Merge AI suggestions with rule-based suggestions.
 *
 * AI suggestions come first (with isAISuggestion flag), followed by
 * rule-based suggestions that weren't already suggested by AI.
 */
export function mergeSuggestions(
  aiSuggestions: EnrichedAISuggestion[],
  ruleBasedSuggestions: PanelPluginVisualizationSuggestion[]
): PanelPluginVisualizationSuggestion[] {
  // Get plugin IDs that AI already suggested
  const aiPluginIds = new Set(aiSuggestions.map((s) => s.pluginId));

  // Filter out rule-based suggestions that duplicate AI suggestions (by pluginId)
  const uniqueRuleBased = ruleBasedSuggestions.filter((s) => !aiPluginIds.has(s.pluginId));

  // AI suggestions first, then unique rule-based
  return [...aiSuggestions, ...uniqueRuleBased];
}
