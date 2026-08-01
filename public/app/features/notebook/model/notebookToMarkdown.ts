import { type Spec as NotebookSpec } from '@grafana/schema/apis/notebook/v2beta1';

import { resolveCells } from './notebookSpec';

/**
 * Serializes a notebook to plain markdown for sharing (Slack, docs, PRs).
 * Panels can't be embedded in markdown, so they become a compact blockquote
 * with the panel title, provenance and queries.
 */
export function notebookToMarkdown(spec: NotebookSpec, options?: { notebookUrl?: string }): string {
  const parts: string[] = [`# ${spec.title}`.trimEnd()];

  if (spec.description) {
    parts.push(spec.description);
  }

  const meta = [`_Time range: ${spec.timeSettings.from} → ${spec.timeSettings.to}_`];
  if (spec.tags.length > 0) {
    meta.push(`_Tags: ${spec.tags.join(', ')}_`);
  }
  if (options?.notebookUrl) {
    meta.push(`_Notebook: ${options.notebookUrl}_`);
  }
  parts.push(meta.join('\n'));

  for (const cell of resolveCells(spec)) {
    const { element } = cell;

    if (element.kind === 'Panel') {
      const lines = [`> 📊 **${element.spec.title || 'Panel'}** (${element.spec.vizConfig.group})`];
      if (element.spec.subtitle) {
        lines.push(`> ${element.spec.subtitle}`);
      }
      for (const query of element.spec.data.spec.queries) {
        const summary = summarizeQuery(query.spec.query.spec);
        lines.push(`> - \`${query.spec.refId}\` (${query.spec.query.group}): \`${summary}\``);
      }
      parts.push(lines.join('\n'));
      continue;
    }

    if (element.kind === 'LibraryPanel') {
      parts.push(`> 📊 **${element.spec.title || 'Library panel'}** (library panel)`);
      continue;
    }

    const content = element.spec.content;
    if (content.kind === 'Markdown') {
      if (content.spec.text.trim()) {
        parts.push(content.spec.text.trim());
      }
      continue;
    }

    parts.push(`\`\`\`${content.spec.language}\n${content.spec.code}\n\`\`\``);
  }

  return parts.join('\n\n') + '\n';
}

function summarizeQuery(query: Record<string, unknown>): string {
  // Prefer the human-readable query expression when the datasource has one.
  for (const key of ['expr', 'query', 'rawSql', 'target']) {
    const value = query[key];
    if (typeof value === 'string' && value.trim()) {
      return truncate(value.trim(), 120);
    }
  }
  return truncate(JSON.stringify(query), 120);
}

function truncate(value: string, max: number): string {
  return value.length > max ? `${value.slice(0, max)}…` : value;
}
