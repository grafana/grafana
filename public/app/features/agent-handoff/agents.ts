import { store } from '@grafana/data';

import { type AgentId } from './deeplinks';

export interface AgentDescriptor {
  id: AgentId;
  /** A product name, so deliberately not translated. */
  name: string;
}

/**
 * The agents offered in the menu, in order.
 *
 * A list rather than a pair of hardcoded items, because the Grafana MCP server
 * documents setup for eight clients and the next one to render MCP Apps should be an
 * entry here, not another branch.
 */
export const HANDOFF_AGENTS: AgentDescriptor[] = [
  { id: 'claude', name: 'Claude Code' },
  { id: 'cursor', name: 'Cursor' },
];

/**
 * Panel types the agent-side viewer can draw. Anything else reaches the agent and
 * reports "unsupported panel type", which reads as broken rather than unfinished, so
 * the menu does not offer itself there.
 *
 * Kept as data because the viewer's panel registry grows one type at a time.
 */
const SUPPORTED_PANEL_TYPES = new Set(['timeseries']);

/**
 * The single gate on whether a panel can be handed off. One predicate rather than
 * conditions spread through the menu, so a feature flag or an allowlist later has one
 * place to live.
 */
export function canOpenPanelInAgent(pluginId: string | undefined): boolean {
  return pluginId !== undefined && SUPPORTED_PANEL_TYPES.has(pluginId);
}

/**
 * Whether this browser has been through the setup step for an agent.
 *
 * Local to the browser on purpose. It records "this person has seen the connect
 * instructions", not "the server is connected", which Grafana cannot observe from
 * here: an agent runs on the user's machine and never calls back. Getting it wrong
 * costs one extra visit to a drawer, so it does not deserve server state.
 */
const setupKey = (agent: AgentId) => `grafana.agent-handoff.${agent}.setup-seen`;

export function hasSeenAgentSetup(agent: AgentId): boolean {
  return store.getBool(setupKey(agent), false);
}

export function markAgentSetupSeen(agent: AgentId): void {
  store.set(setupKey(agent), true);
}
