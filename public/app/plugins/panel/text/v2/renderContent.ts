import { type DataFrame, type InterpolateFunction, type ScopedVars } from '@grafana/data';
import { t } from '@grafana/i18n';
import { getFeatureFlagClient } from '@grafana/runtime/internal';

import { RenderMode, TextMode } from '../panelcfg.gen';

import {
  type AllRowsContext,
  buildAllRowsContext,
  buildRows,
  type CompiledTemplate,
  compileTemplate,
} from './handlebars';
import { transformContent } from './utils';

/** Caps the rows either render mode will touch, since the edit preview re-interpolates on every keystroke. */
export const MAX_RENDERED_ROWS = 1000;

/** What to render, built from either the panel options or the editor's draft. */
export interface TextTemplate {
  content: string;
  mode: TextMode;
  series?: DataFrame[];
  renderMode?: RenderMode;
  format?: string;
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

export function interpolateTemplate(template: TextTemplate, replaceVariables: InterpolateFunction): string {
  const { content, mode, series = [], renderMode, format } = template;

  // Code mode shows the source verbatim, and Handlebars' HTML escaping would mangle it.
  const compiled =
    handlebarsEnabled() && mode !== TextMode.Code ? compileTemplate(content, replaceVariables) : undefined;

  if (renderMode === RenderMode.PerRow && hasRenderableData(series)) {
    return interpolateEveryRow(template, series, replaceVariables, compiled);
  }

  if (!compiled) {
    return replaceVariables(content, {}, format);
  }

  let readRows = false;
  const rows = trackRowAccess(buildAllRowsContext(series, MAX_RENDERED_ROWS), () => {
    readRows = true;
  });

  const blocks = [replaceVariables(compiled(rows), {}, format)];

  if (readRows && countRows(series) > MAX_RENDERED_ROWS) {
    blocks.push(truncationNotice());
  }

  return joinBlocks(blocks, mode);
}

// Content that never reads the capped collections cannot be under-counting, so
// only a template that touched them earns the truncation notice.
function trackRowAccess(context: AllRowsContext, onRead: () => void): AllRowsContext {
  return {
    get data() {
      onRead();
      return context.data;
    },
    get frames() {
      onRead();
      return context.frames;
    },
  };
}

function countRows(series: DataFrame[]): number {
  return series.reduce((total, frame) => total + (frame.fields.length > 0 ? frame.length : 0), 0);
}

function truncationNotice(): string {
  return t('textng.render.truncated', 'Showing the first {{maxRows}} rows.', { maxRows: MAX_RENDERED_ROWS });
}

// Markdown needs a blank line between blocks, because `breaks` is off.
function joinBlocks(blocks: string[], mode: TextMode): string {
  return blocks.join(mode === TextMode.Markdown ? '\n\n' : '\n');
}

function interpolateEveryRow(
  template: TextTemplate,
  series: DataFrame[],
  replaceVariables: InterpolateFunction,
  compiled?: CompiledTemplate
): string {
  const { content, mode, format } = template;
  const totalRows = countRows(series);
  const blocks: string[] = [];

  for (const [frameIndex, frame] of series.entries()) {
    const field = frame.fields[0];
    if (!field) {
      continue;
    }

    const rowCount = Math.min(frame.length, MAX_RENDERED_ROWS - blocks.length);
    const rows = compiled ? buildRows(frame, series, rowCount) : [];

    for (let rowIndex = 0; rowIndex < rowCount; rowIndex++) {
      // `field` is unused by the ${__data} macro but required by the type, and
      // ${__value}/${__field} fall back to the raw match without it.
      const scopedVars: ScopedVars = {
        __dataContext: { value: { data: series, frame, field, rowIndex, frameIndex } },
      };

      const templated = compiled ? compiled(rows[rowIndex]) : content;

      blocks.push(replaceVariables(templated, scopedVars, format));
    }

    if (blocks.length >= MAX_RENDERED_ROWS) {
      break;
    }
  }

  if (totalRows > MAX_RENDERED_ROWS) {
    blocks.push(truncationNotice());
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
