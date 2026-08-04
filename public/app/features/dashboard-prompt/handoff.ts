import { createAssistantContextItem, openAssistant } from '@grafana/assistant';
import { locationService } from '@grafana/runtime';

import { PROMPT_ORIGIN, formatDatasources } from './prompts';
import { type PromptDatasource } from './types';

/**
 * The title of the hidden context item that carries the planning
 * instructions. The assistant's dashboarding mode matches on this exact
 * phrase to enter its plan-first workflow, so keep the two in sync
 * (grafana-assistant-app: dashboardingPrompt.ts, <plan_first_workflow>).
 */
const PLANNING_INSTRUCTIONS_TITLE = 'Dashboard planning instructions';

/** Where the plan (and later the build) plays out. */
const NEW_DASHBOARD_PATH = '/dashboard/new';

interface StartPlanningArgs {
  /** The user's free text plus any entry-point hint (see composeRequest in the modal). */
  request: string;
  /** The request as the user typed it — shown as their message in the conversation. */
  displayPrompt: string;
  /** Datasources already scoped to the seed. */
  datasources: PromptDatasource[];
  /** Folder the draft should land in, when the entry point knows one. */
  folderUid?: string;
}

/**
 * Hands the user’s prompt to the assistant sidebar for planning:
 * lands the user in the new-dashboard editor and opens a dashboarding-mode
 * conversation seeded with their own words plus a hidden instruction item.
 * The assistant grounds a plan with its own datasource tools, asks clarifying
 * questions in the chat, renders the plan as a card with a "Build it" button,
 * and builds in the same conversation once the plan is accepted.
 *
 * Returns false when the navigation was refused and nothing was started, so the
 * caller can keep the user's prompt on screen instead of losing it.
 */
export function startPlanningInAssistant(args: StartPlanningArgs): boolean {
  // Land in the new-dashboard editor first so the plan (and later the build)
  // plays out next to the dashboard it will produce.
  locationService.push(
    args.folderUid ? `${NEW_DASHBOARD_PATH}?folderUid=${encodeURIComponent(args.folderUid)}` : NEW_DASHBOARD_PATH
  );

  // An unsaved dashboard blocks navigation (dashboard-scene's DashboardPrompt
  // installs a history blocker and shows its own modal instead). That runs
  // synchronously, so a pathname that hasn't moved means we never left: opening
  // a dashboarding conversation now would point the assistant at the dashboard
  // the user is still sitting on, and tell it a blank one is open.
  if (locationService.getLocation().pathname !== NEW_DASHBOARD_PATH) {
    return false;
  }

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
    context: [planningItem],
  });

  return true;
}

/**
 * The hidden instruction block that puts the conversation into the
 * plan-first flow. It carries what the modal knows and the sidebar cannot
 * discover on its own: the composed request (with the entry point's hint)
 * and the datasource scope the user arrived with.
 */
export function buildPlanningInstructions(args: StartPlanningArgs): string {
  const parts: string[] = [
    'The user clicked "Generate dashboard" and is starting from a brand-new dashboard (the new-dashboard editor is open). Follow your plan-first workflow: ground the plan in verified data with your datasource tools, ask at most one round of clarifying questions, present the plan with propose_dashboard_plan, and only build after the plan is accepted.',
    `The user's full request:\n${args.request}`,
    `The available datasources (query them by these exact uids — no others exist):\n${formatDatasources(args.datasources)}`,
  ];

  parts.push(
    `Planning and build requirements:
- Every panel must be planned around data you verified exists — never invent services, metrics, or labels.
- Plan template variables only for labels you confirmed on the planned metrics.
- Do NOT save the dashboard at any point. The user reviews and saves the finished draft themselves.`
  );

  return parts.join('\n\n');
}
