import { createAssistantContextItem, type ChatContextItem, openAssistant } from '@grafana/assistant';

import { PROMPT_ORIGIN, MAX_LISTED_DATASOURCES, formatDashboardRefs, formatDatasources } from './prompts';
import { type PromptDashboardRef, type PromptDatasource } from './types';

/**
 * The title of the hidden context item that carries the planning
 * instructions. The assistant's dashboarding mode matches on this exact
 * phrase to enter its plan-first workflow, so keep the two in sync
 * (grafana-assistant-app: dashboardingPrompt.ts, <plan_first_workflow>).
 */
const PLANNING_INSTRUCTIONS_TITLE = 'Dashboard planning instructions';

interface StartPlanningArgs {
  /** The user's dashboard request. */
  request: string;
  /** The request as the user typed it — shown as their message in the conversation. */
  displayPrompt: string;
  /** Datasources selected on the landing prompt, or all available datasources. */
  datasources: PromptDatasource[];
  /** Original context items selected in the landing prompt. */
  context?: ChatContextItem[];
  /** Dashboards the user attached as context on the landing prompt. */
  dashboards?: PromptDashboardRef[];
}

/**
 * Hands the user’s prompt to the assistant sidebar for planning:
 * opens a dashboarding-mode conversation seeded with their own words
 * plus a hidden instruction item.
 * The assistant grounds a plan with its own datasource tools, asks clarifying
 * questions in the chat, renders the plan as a card with a "Build it" button,
 * and builds in the same conversation once the plan is accepted.
 */
export function startPlanningInAssistant(args: StartPlanningArgs): void {
  const planningItem = createAssistantContextItem('structured', {
    title: PLANNING_INSTRUCTIONS_TITLE,
    hidden: true,
    bypassLimits: true,
    data: { instructions: buildPlanningInstructions(args) },
  });

  openAssistant({
    origin: PROMPT_ORIGIN,
    mode: 'dashboarding',
    autoSend: true,
    prompt: args.displayPrompt,
    context: [planningItem, ...(args.context ?? [])],
  });
}

/**
 * The hidden instruction block that puts the conversation into the
 * plan-first flow. It carries the user's request and datasource scope
 * from the landing prompt.
 */
export function buildPlanningInstructions(args: StartPlanningArgs): string {
  // Only a complete list can back a "no others exist" claim. Once truncated,
  // that claim would hide real, queryable datasources from the assistant
  // instead of just trimming the prompt, so point it at list_datasources for
  // anything the user's request implies isn't in this preview.
  const isTruncated = args.datasources.length > MAX_LISTED_DATASOURCES;
  const datasourceScopeInstruction = isTruncated
    ? `A preview of the datasources available (this instance has ${args.datasources.length}; only the first ${MAX_LISTED_DATASOURCES} are listed here by uid). Query the listed ones by these exact uids. If the request implies a datasource not shown here, use your datasource discovery tool to look up its uid before assuming it doesn't exist:\n${formatDatasources(args.datasources)}`
    : `The available datasources (query them by these exact uids — no others exist):\n${formatDatasources(args.datasources)}`;

  const parts: string[] = [
    'The user is starting from a brand-new dashboard (the new-dashboard editor is open). Follow your plan-first workflow: ground the plan in verified data with your datasource tools, ask at most one round of clarifying questions, present the plan with propose_dashboard_plan, and only build after the plan is accepted.',
    `The user's full request:\n${args.request}`,
    datasourceScopeInstruction,
  ];

  if (args.dashboards && args.dashboards.length > 0) {
    parts.push(`Dashboards the user attached as context:\n${formatDashboardRefs(args.dashboards)}`);
  }

  parts.push(
    `Planning and build requirements:
- Every panel must be planned around data you verified exists — never invent services, metrics, or labels.
- Plan template variables only for labels you confirmed on the planned metrics.
- Do NOT save the dashboard at any point. The user reviews and saves the finished draft themselves.`
  );

  return parts.join('\n\n');
}
