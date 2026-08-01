import { type Spec as NotebookSpec } from '@grafana/schema/apis/notebook/v2beta1';

import { notebookViewUrl } from '../api/notebookAPI';
import { resolveCells } from '../model/notebookSpec';

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
 * Prefill params for the IRM declare-incident form. URL `status` is the incident
 * lifecycle state (active/resolved), not a status update — attach the notebook via
 * url/caption/description instead. Assistant can do a richer summary later; these
 * are just sensible defaults from the notebook metadata.
 */
export function buildDeclareIncidentParams(ctx: DeclareIncidentNotebookContext): Record<string, string> {
  const notebookUrl = new URL(notebookViewUrl(ctx.uid), window.location.origin).toString();
  const title = incidentTitle(ctx);
  const description = incidentDescription(ctx, notebookUrl, title);

  return {
    title,
    url: notebookUrl,
    caption: ctx.title.trim() ? `Notebook: ${ctx.title.trim()}` : 'Investigation notebook',
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
  // Named title wins; only fall through when it's still the create default.
  // Description isn't editable in the POC UI, so markdown notes beat it.
  const trimmedTitle = ctx.title.trim();
  if (trimmedTitle && !isDefaultNotebookTitle(trimmedTitle)) {
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

  return 'Investigation: Untitled notebook';
}

function isDefaultNotebookTitle(title: string): boolean {
  // Matches the create-flow default (and a couple of common placeholders).
  return /^(untitled notebook|new notebook)$/i.test(title.trim());
}

function incidentDescription(ctx: DeclareIncidentNotebookContext, notebookUrl: string, title: string): string {
  const lines = [`Investigation notebook: ${notebookUrl}`];

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
