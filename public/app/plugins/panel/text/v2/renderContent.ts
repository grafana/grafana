import { type DataFrame, type InterpolateFunction, type ScopedVars } from '@grafana/data';
import { t } from '@grafana/i18n';
import { getFeatureFlagClient } from '@grafana/runtime/internal';

import { RenderMode, TextMode } from '../panelcfg.gen';

import { buildAllRowsContext, buildRows, type CompiledTemplate, compileTemplate } from './handlebars';
import { transformContent } from './utils';

/** Ceiling for the `maxRows` option, so a typed value cannot hang the panel. */
export const MAX_RENDERED_ROWS = 1000;

/** Render cost follows output size, not row count, and markdown-it degrades superlinearly. */
export const MAX_RENDERED_CHARS = 100_000;

/** What to render, built from either the panel options or the editor's draft. */
export interface TextTemplate {
  content: string;
  mode: TextMode;
  series?: DataFrame[];
  renderMode?: RenderMode;
  format?: string;
  maxRows?: number;
}

/** A finished render pass, or the error that stopped it. */
export interface RenderedContent {
  content: string;
  error?: string;
}

/** Turns a broken Handlebars template into an error to display instead of content. */
export function catchTemplateError(render: () => string): RenderedContent {
  try {
    return { content: render() };
  } catch (error) {
    return {
      content: '',
      error: t('textng.render.handlebars-error', 'Handlebars error: {{message}}', {
        message: error instanceof Error ? error.message : String(error),
      }),
    };
  }
}

export function hasRenderableData(series?: DataFrame[]): series is DataFrame[] {
  return series?.some((frame) => frame.fields.length > 0 && frame.length > 0) ?? false;
}

// Not cached: the flag value can change after the providers settle.
function handlebarsEnabled(): boolean {
  return getFeatureFlagClient().getBooleanValue('text.newFeatures', false);
}

// A cleared or zeroed field falls back to the ceiling.
function resolveMaxRows(maxRows?: number): number {
  return maxRows ? Math.max(1, Math.min(Math.floor(maxRows), MAX_RENDERED_ROWS)) : MAX_RENDERED_ROWS;
}

export function interpolateTemplate(template: TextTemplate, replaceVariables: InterpolateFunction): string {
  const { content, mode, series = [], renderMode, format } = template;
  const maxRows = resolveMaxRows(template.maxRows);

  // Code mode shows the source verbatim, and Handlebars' HTML escaping would mangle it.
  const compiled =
    handlebarsEnabled() && mode !== TextMode.Code ? compileTemplate(content, replaceVariables) : undefined;

  if (renderMode === RenderMode.PerRow && hasRenderableData(series)) {
    return interpolateEveryRow(template, series, replaceVariables, maxRows, compiled);
  }

  if (!compiled) {
    return replaceVariables(content, {}, format);
  }

  const rendered = replaceVariables(compiled(buildAllRowsContext(series, maxRows)), {}, format);

  // A Once template emits one string, so the row limit cannot bound its size.
  return rendered.length > MAX_RENDERED_CHARS ? cutToMaxChars(rendered) : rendered;
}

// Cut on a line break so the tail lands between elements rather than inside a tag.
function cutToMaxChars(rendered: string): string {
  const boundary = rendered.lastIndexOf('\n', MAX_RENDERED_CHARS);
  return rendered.slice(0, boundary > 0 ? boundary : MAX_RENDERED_CHARS);
}

// Markdown needs a blank line between blocks, because `breaks` is off.
function joinBlocks(blocks: string[], mode: TextMode): string {
  return blocks.join(mode === TextMode.Markdown ? '\n\n' : '\n');
}

function interpolateEveryRow(
  template: TextTemplate,
  series: DataFrame[],
  replaceVariables: InterpolateFunction,
  maxRows: number,
  compiled?: CompiledTemplate
): string {
  const { content, mode, format } = template;
  const blocks: string[] = [];
  let renderedChars = 0;

  for (const [frameIndex, frame] of series.entries()) {
    const field = frame.fields[0];
    if (!field) {
      continue;
    }

    const rowCount = Math.min(frame.length, maxRows - blocks.length);
    const rows = compiled ? buildRows(frame, series, rowCount) : [];

    for (let rowIndex = 0; rowIndex < rowCount; rowIndex++) {
      // `field` is unused by the ${__data} macro but required by the type, and
      // ${__value}/${__field} fall back to the raw match without it.
      const scopedVars: ScopedVars = {
        __dataContext: { value: { data: series, frame, field, rowIndex, frameIndex } },
      };

      const block = replaceVariables(compiled ? compiled(rows[rowIndex]) : content, scopedVars, format);

      blocks.push(block);
      renderedChars += block.length;

      if (renderedChars >= MAX_RENDERED_CHARS) {
        break;
      }
    }

    if (renderedChars >= MAX_RENDERED_CHARS || blocks.length >= maxRows) {
      break;
    }
  }

  return joinBlocks(blocks, mode);
}

export function renderContent(
  template: TextTemplate,
  replaceVariables: InterpolateFunction,
  disableSanitizeHtml: boolean
): string {
  return transformContent(template.mode, interpolateTemplate(template, replaceVariables), disableSanitizeHtml);
}
