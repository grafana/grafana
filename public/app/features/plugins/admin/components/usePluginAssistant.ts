import { createAssistantContextItem, useAssistant } from '@grafana/assistant';
import { reportInteraction } from '@grafana/runtime';

import { CatalogPlugin } from '../types';

const ORIGIN = 'grafana/plugins';

interface PluginSummary {
  id: string;
  name: string;
  description: string;
  type?: string;
  orgName: string;
  isInstalled: boolean;
  isDeprecated: boolean;
  isCore: boolean;
  isEnterprise: boolean;
  updatedAt: string;
  signature: string;
  downloads: number;
}

function summarizePlugins(plugins: CatalogPlugin[]): Record<string, PluginSummary> {
  const result: Record<string, PluginSummary> = {};
  for (const p of plugins.slice(0, 20)) {
    result[p.id] = {
      id: p.id,
      name: p.name,
      description: p.description,
      type: p.type,
      orgName: p.orgName,
      isInstalled: p.isInstalled,
      isDeprecated: p.isDeprecated,
      isCore: p.isCore,
      isEnterprise: p.isEnterprise,
      updatedAt: p.updatedAt,
      signature: p.signature,
      downloads: p.downloads,
    };
  }
  return result;
}

function buildSearchPrompt(query: string, pluginCount: number): string {
  return [
    `Try to understand the user's intent based on the content's of "${query}", the ${pluginCount} in the context and any filters in the URL.`,
    'ask questions if needed to clarify their intent, but do your best to provide a helpful response first even if the query is vague.',
    'If comparing a set of plugins, summarize the search results in a table with recommendations based on use case — what each does, current maintenance status, and any caveats (deprecated, enterprise-only, cloud-only, stale).',
    'You can mention relevant Grafana Cloud or Enterprise options, even if not in the returned list, but clearly label these as such and provide links to learn more.',
    'Help continue their learning journey, include 2-3 follow-up suggestions as navigation_suggestions with type "followup".',
    'Make them specific to the search results — reference actual plugin names where relevant.',
    'Good examples: comparing specific plugins from the results, asking the user about their setup to narrow down, or learning how to configure a given plugin.',
    'Keep labels short and action-oriented (they appear as buttons).',
  ].join(' ');
}

function buildGetStartedPrompt(pluginCount: number): string {
  return [
    'The user is new to the Grafana plugin catalog and wants help getting started, assume they have little to no prior experience with Grafana plugins.',
    'Ask the user what they are trying to achieve and to include relevant detail, provide suggestions like do they want help selecting the right plugin for a specific use case, do they want to understand plugin types?',
    'Consider whether their use case may be better served by Grafana Cloud apps or Integrations which ingest and store the data in Grafana Cloud',
    'After your response, include 2-3 follow-up suggestions as navigation_suggestions with type "followup".',
    'Keep labels short and action-oriented (they appear as buttons).',
  ].join(' ');
}

export function usePluginAssistant() {
  const { isAvailable, openAssistant } = useAssistant();

  const handleOpenAssistant = (query: string, plugins: CatalogPlugin[]) => {
    if (!openAssistant) {
      return;
    }

    reportInteraction('plugin_search_assistant_opened', {
      origin: ORIGIN,
      query,
      resultCount: plugins.length,
    });

    const context = [
      createAssistantContextItem('structured', {
        title: `Plugin search results for "${query}"`,
        data: {
          totalResults: plugins.length,
          plugins: summarizePlugins(plugins),
        },
      }),
    ];

    openAssistant({
      origin: ORIGIN,
      prompt: buildSearchPrompt(query, plugins.length),
      context,
      autoSend: true,
    });
  };

  const handleGetStarted = (plugins: CatalogPlugin[]) => {
    if (!openAssistant) {
      return;
    }

    reportInteraction('plugin_search_assistant_get_started', {
      origin: ORIGIN,
      resultCount: plugins.length,
    });

    const context = [
      createAssistantContextItem('structured', {
        title: 'Available plugins in the catalog',
        data: {
          totalResults: plugins.length,
          plugins: summarizePlugins(plugins),
        },
      }),
    ];

    openAssistant({
      origin: ORIGIN,
      prompt: buildGetStartedPrompt(plugins.length),
      context,
      autoSend: true,
    });
  };

  return {
    isAvailable: isAvailable && !!openAssistant,
    handleOpenAssistant,
    handleGetStarted,
  };
}
