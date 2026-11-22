import { type Dashboard } from '@grafana/schema';
import { type Spec as DashboardV2Spec } from '@grafana/schema/apis/dashboard.grafana.app/v2';
import { isRecord } from 'app/core/utils/isRecord';
import { isDashboardV2Spec } from 'app/features/dashboard/api/utils';
import { Role, type Message } from 'app/features/dashboard/components/GenAI/utils';
import { type Diffs, getDiffOperationText } from 'app/features/dashboard-scene/settings/version-history/utils';

import { sanitizeBranchName } from './branchName';
import { MAX_PR_DESCRIPTION_LENGTH } from './pullRequestTitle';

// Keeps the prompt inside small context windows.
const MAX_PANELS = 30;
const MAX_DIFF_LINES = 60;
const MAX_DIFF_VALUE_LENGTH = 120;

export interface CommitDetailsContext {
  action: 'create' | 'update';
  title: string;
  description?: string;
  path: string;
  saveModel: Dashboard | DashboardV2Spec;
  /** Changes against the saved version; omitted for new dashboards. */
  diffs?: Diffs;
  includeBranch: boolean;
  includePullRequestDescription: boolean;
}

export interface CommitDetails {
  commitMessage?: string;
  branch?: string;
  pullRequestDescription?: string;
}

export function getPanelTitles(model: Dashboard | DashboardV2Spec): string[] {
  if (isDashboardV2Spec(model)) {
    return Object.values(model.elements ?? {})
      .map((element) => element.spec.title)
      .filter(Boolean);
  }
  const panels = (model.panels ?? []).flatMap((panel) =>
    'panels' in panel ? [panel, ...(panel.panels ?? [])] : [panel]
  );
  return panels.map((panel) => panel.title ?? '').filter(Boolean);
}

function formatDiffValue(value: unknown): string {
  const text = JSON.stringify(value) ?? 'undefined';
  return text.length > MAX_DIFF_VALUE_LENGTH ? `${text.slice(0, MAX_DIFF_VALUE_LENGTH)}…` : text;
}

/** One line per JSON change, e.g. `changed panels.0.title: "CPU" -> "CPU usage"`. */
export function getDiffSummary(diffs: Diffs): string[] {
  const all = Object.values(diffs).flat();
  const lines = all.slice(0, MAX_DIFF_LINES).map((diff) => {
    const path = diff.path.join('.');
    const operation = getDiffOperationText(diff.op);
    if (diff.op === 'add') {
      return `${operation} ${path}: ${formatDiffValue(diff.value)}`;
    }
    if (diff.op === 'remove') {
      return `${operation} ${path} (was ${formatDiffValue(diff.originalValue)})`;
    }
    return `${operation} ${path}: ${formatDiffValue(diff.originalValue)} -> ${formatDiffValue(diff.value)}`;
  });
  if (all.length > MAX_DIFF_LINES) {
    lines.push(`…and ${all.length - MAX_DIFF_LINES} more changes`);
  }
  return lines;
}

export function getCommitDetailsMessages(context: CommitDetailsContext): Message[] {
  const keys = [
    '- "commitMessage": a git commit message. The first line is an imperative summary under 72 characters with no trailing period; it also becomes the pull request title. Optionally add a blank line and up to 3 short bullet lines describing notable changes.',
  ];
  if (context.includeBranch) {
    keys.push(
      '- "branch": a short git branch name (lowercase letters, digits and dashes, under 40 characters) that starts with "dashboard/" and describes the change.'
    );
  }
  if (context.includePullRequestDescription) {
    keys.push(
      '- "pullRequestDescription": a Markdown pull request description under 1500 characters: one sentence summarizing the change and why it matters, then a "## Changes" bullet list. Do not repeat the title.'
    );
  }

  const panelTitles = getPanelTitles(context.saveModel);
  const panelLines = panelTitles.slice(0, MAX_PANELS).map((title) => `- ${title}`);
  if (panelTitles.length > MAX_PANELS) {
    panelLines.push(`…and ${panelTitles.length - MAX_PANELS} more panels`);
  }
  const diffLines = context.diffs ? getDiffSummary(context.diffs) : [];

  const details = [
    `Action: ${context.action === 'create' ? 'create a new dashboard' : 'update an existing dashboard'}`,
    `Dashboard title: ${context.title}`,
    context.description ? `Dashboard description: ${context.description}` : '',
    `File path in the repository: ${context.path}`,
    panelLines.length ? `Panels (${panelTitles.length}):\n${panelLines.join('\n')}` : 'Panels: none',
    context.diffs
      ? `Changes to the dashboard JSON:\n${diffLines.length ? diffLines.join('\n') : 'No JSON changes detected.'}`
      : '',
  ].filter(Boolean);

  return [
    {
      role: Role.system,
      content: [
        'You write the git metadata for a Grafana dashboard change that is committed to a Git repository.',
        'Base it only on the dashboard details and changes provided. Describe what changed for a reader of the repository history, not JSON paths.',
        'Respond with a single JSON object and nothing else, with these string keys:',
        ...keys,
      ].join('\n'),
    },
    { role: Role.user, content: details.join('\n\n') },
  ];
}

function readString(record: Record<string | number | symbol, unknown>, key: string): string | undefined {
  const value = record[key];
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

/** Parses the model's JSON reply, tolerating surrounding prose or code fences. Undefined when unusable. */
export function parseCommitDetails(reply: string): CommitDetails | undefined {
  const start = reply.indexOf('{');
  const end = reply.lastIndexOf('}');
  if (start === -1 || end <= start) {
    return undefined;
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(reply.slice(start, end + 1));
  } catch {
    return undefined;
  }
  if (!isRecord(parsed)) {
    return undefined;
  }
  const details: CommitDetails = {
    commitMessage: readString(parsed, 'commitMessage'),
    branch: sanitizeBranchName(readString(parsed, 'branch') ?? '') || undefined,
    pullRequestDescription: readString(parsed, 'pullRequestDescription')?.slice(0, MAX_PR_DESCRIPTION_LENGTH),
  };
  return details.commitMessage || details.branch || details.pullRequestDescription ? details : undefined;
}

/** First line of a commit message: what providers use as the pull request title. */
export function getCommitTitle(message: string): string {
  return message.trim().split('\n')[0].trim();
}
