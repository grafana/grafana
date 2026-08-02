import { type Spec as NotebookSpec } from '@grafana/schema/apis/notebook/v2beta1';

import { notebookViewUrl } from '../api/notebookAPI';
import { DEFAULT_NOTEBOOK_TITLE, isDefaultNotebookTitle, resolveCells } from '../model/notebookSpec';

export interface DeclareIncidentNotebookContext {
  uid: string;
  title: string;
  description?: string;
  tags?: string[];
  /** Panel titles when known — used for a short description bullet list. */
  panelTitles?: string[];
  /** First meaningful markdown line — used when the notebook title is still the create default. */
  firstMarkdownLine?: string;
}

/**
 * Prefill params for the IRM declare-incident form.
 *
 * Documented URL params are title / url / caption / description (plus severity, etc.).
 * `status` is the lifecycle state (active/resolved), not a status-update message — so the
 * “declared from this notebook” line goes in `description`, and the notebook is also
 * attached via `url` + `caption` (IRM’s attached-context UI).
 */
export function buildDeclareIncidentParams(ctx: DeclareIncidentNotebookContext): Record<string, string> {
  const notebookUrl = new URL(notebookViewUrl(ctx.uid), window.location.origin).toString();
  const title = incidentTitle(ctx);
  const description = incidentDescription(ctx, notebookUrl, title);

  const captionTitle = ctx.title.trim();
  return {
    title,
    url: notebookUrl,
    caption:
      captionTitle && !isDefaultNotebookTitle(captionTitle) ? `Notebook: ${captionTitle}` : 'Investigation notebook',
    description,
  };
}

export function declareIncidentContextFromSpec(uid: string, spec: NotebookSpec): DeclareIncidentNotebookContext {
  const panelTitles: string[] = [];
  let firstMarkdownLine: string | undefined;

  for (const cell of resolveCells(spec)) {
    if (cell.element.kind === 'Panel' || cell.element.kind === 'LibraryPanel') {
      const panelTitle = cell.element.spec.title?.trim();
      if (panelTitle) {
        panelTitles.push(panelTitle);
      }
      continue;
    }

    if (!firstMarkdownLine && cell.element.kind === 'Cell' && cell.element.spec.content.kind === 'Markdown') {
      firstMarkdownLine = firstMeaningfulLine(cell.element.spec.content.spec.text);
    }
  }

  return {
    uid,
    title: spec.title,
    description: spec.description,
    tags: spec.tags,
    panelTitles,
    firstMarkdownLine,
  };
}

function incidentTitle(ctx: DeclareIncidentNotebookContext): string {
  // Named title wins (including dated `Investigation — …` create defaults).
  // Only fall through when empty or still the legacy untitled placeholder.
  const trimmedTitle = ctx.title?.trim() ?? '';
  if (!isDefaultNotebookTitle(trimmedTitle)) {
    if (/^investigation\b/i.test(trimmedTitle)) {
      return trimmedTitle;
    }
    return `Investigation: ${trimmedTitle}`;
  }

  for (const candidate of [ctx.firstMarkdownLine, ctx.description]) {
    const summary = asSingleLineSummary(candidate);
    if (summary) {
      return summary;
    }
  }

  return `Investigation: ${DEFAULT_NOTEBOOK_TITLE}`;
}

function incidentDescription(ctx: DeclareIncidentNotebookContext, notebookUrl: string, title: string): string {
  // Lead with the declaration line so it reads like the initial status / context
  // responders see first. IRM has no documented URL param for a status-update body.
  const lines = [
    `This incident was declared from this notebook: ${notebookUrl}`,
    '',
    `Notebook: ${ctx.title.trim() || DEFAULT_NOTEBOOK_TITLE}`,
  ];

  const trimmedDescription = ctx.description?.trim();
  if (trimmedDescription && trimmedDescription !== title) {
    lines.push('', trimmedDescription);
  }

  if (ctx.tags?.length) {
    lines.push('', `Tags: ${ctx.tags.join(', ')}`);
  }

  const panels = ctx.panelTitles?.filter(Boolean).slice(0, 8) ?? [];
  if (panels.length) {
    lines.push('', 'Panels:');
    for (const panel of panels) {
      lines.push(`- ${panel}`);
    }
    if ((ctx.panelTitles?.length ?? 0) > panels.length) {
      lines.push(`- …and ${(ctx.panelTitles?.length ?? 0) - panels.length} more`);
    }
  }

  return lines.join('\n');
}

/** First non-empty markdown line, stripped of heading markers — for incident title fallback. */
function firstMeaningfulLine(text: string): string | undefined {
  for (const raw of text.split('\n')) {
    const line = raw.replace(/^#{1,6}\s+/, '').trim();
    if (line) {
      return line;
    }
  }
  return undefined;
}

function asSingleLineSummary(value?: string): string | undefined {
  const trimmed = value?.trim();
  if (!trimmed || trimmed.includes('\n') || trimmed.length > 120) {
    return undefined;
  }
  return trimmed;
}
