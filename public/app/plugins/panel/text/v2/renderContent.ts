import {
  type DataFrame,
  type Field,
  FieldType,
  getDisplayProcessor,
  type InterpolateFunction,
  reduceField,
  ReducerID,
  type ScopedVars,
} from '@grafana/data';
import { t } from '@grafana/i18n';

import { RenderMode, TextMode } from '../panelcfg.gen';

import { buildAllRowsContext, buildRows, type CompiledTemplate, compileTemplate } from './handlebars';
import { isTextNewFeaturesEnabled, transformContent } from './utils';

/** Hard ceiling on the rows a single render pass may cover, so a large query cannot hang the panel. */
export const MAX_RENDERED_ROWS = 1000;

/** Render cost follows output size, not row count, and markdown-it degrades superlinearly. */
export const MAX_RENDERED_CHARS = 100_000;

/** How far back from the cap a line break is still worth cutting on. */
const CUT_BACKTRACK_CHARS = 1000;

/** Counted across all frames. */
export interface RowWindow {
  start: number;
  count: number;
}

/** What to render, built from either the panel options or the editor's draft. */
export interface TextTemplate {
  content: string;
  mode: TextMode;
  series?: DataFrame[];
  renderMode?: RenderMode;
  format?: string;
  /** Per-row renders only. */
  rowWindow?: RowWindow;
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

export function interpolateTemplate(template: TextTemplate, replaceVariables: InterpolateFunction): string {
  const { content, mode, series = [], renderMode, format } = template;

  // Code mode shows the source verbatim, and Handlebars' HTML escaping would mangle it.
  const compiled =
    isTextNewFeaturesEnabled() && mode !== TextMode.Code ? compileTemplate(content, replaceVariables) : undefined;

  if (renderMode === RenderMode.PerRow && hasRenderableData(series)) {
    return interpolateEveryRow(template, series, replaceVariables, compiled);
  }

  const scopedVars = buildOnceContext(series);

  if (!compiled) {
    return replaceVariables(content, scopedVars, format);
  }

  const rendered = replaceVariables(compiled(buildAllRowsContext(series, MAX_RENDERED_ROWS)), scopedVars, format);

  // A Once template emits one string, so the row ceiling cannot bound its size.
  return cutToMaxChars(rendered);
}

// Cut on a line break so the tail lands between elements rather than inside a tag, but
// only a nearby one - a single-line block's nearest break can be the top of the output.
function cutToMaxChars(rendered: string): string {
  if (rendered.length <= MAX_RENDERED_CHARS) {
    return rendered;
  }

  const boundary = rendered.lastIndexOf('\n', MAX_RENDERED_CHARS);
  return rendered.slice(0, boundary >= MAX_RENDERED_CHARS - CUT_BACKTRACK_CHARS ? boundary : MAX_RENDERED_CHARS);
}

// Never the time field, where ${__field.labels.x} is always empty.
function getMacroField(frame: DataFrame): Field | undefined {
  return frame.fields.find((field) => field.type !== FieldType.time) ?? frame.fields[0];
}

function buildOnceContext(series: DataFrame[]): ScopedVars {
  const frameIndex = findMacroFrameIndex(series);
  const frame = series[frameIndex];
  const field = frame && getMacroField(frame);

  if (!field) {
    return {};
  }

  // Cached null-as-zero calculations can point at an earlier cell with the same value.
  let rowIndex: number | undefined;
  for (let index = field.values.length - 1; index >= 0; index--) {
    const value = field.values[index];
    if (value != null && !Number.isNaN(value)) {
      rowIndex = index;
      break;
    }
  }

  const value =
    rowIndex === undefined
      ? reduceField({ field, reducers: [ReducerID.lastNotNull] })[ReducerID.lastNotNull]
      : field.values[rowIndex];
  // `display` is only attached once field overrides have run.
  const calculatedValue = (field.display ?? getDisplayProcessor())(value);

  return { __dataContext: { value: { data: series, frame, field, frameIndex, calculatedValue, rowIndex } } };
}

// The frame Handlebars' `data` binds to, so the two syntaxes agree.
function findMacroFrameIndex(series: DataFrame[]): number {
  const withRows = series.findIndex((frame) => frame.fields.length > 0 && frame.length > 0);

  return withRows >= 0 ? withRows : series.findIndex((frame) => frame.fields.length > 0);
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
  const { content, mode, format, rowWindow } = template;
  const windowStart = rowWindow?.start ?? 0;
  const maxBlocks = Math.min(rowWindow?.count ?? MAX_RENDERED_ROWS, MAX_RENDERED_ROWS);
  const blocks: string[] = [];
  let renderedChars = 0;
  // The window spans frames.
  let skipped = 0;

  for (const [frameIndex, frame] of series.entries()) {
    const field = getMacroField(frame);
    if (!field) {
      continue;
    }

    const firstRow = Math.min(windowStart - skipped, frame.length);
    skipped += firstRow;

    const rowCount = Math.min(frame.length - firstRow, maxBlocks - blocks.length);
    const rows = compiled ? buildRows(frame, series, rowCount, firstRow) : [];

    for (let offset = 0; offset < rowCount; offset++) {
      const rowIndex = firstRow + offset;
      const scopedVars: ScopedVars = {
        __dataContext: { value: { data: series, frame, field, rowIndex, frameIndex } },
      };

      const block = replaceVariables(compiled ? compiled(rows[offset]) : content, scopedVars, format);

      blocks.push(block);
      renderedChars += block.length;

      if (renderedChars >= MAX_RENDERED_CHARS) {
        break;
      }
    }

    if (renderedChars >= MAX_RENDERED_CHARS || blocks.length >= maxBlocks) {
      break;
    }
  }

  // The loop breaks after appending, so the last block and the separators can still push past the limit.
  return cutToMaxChars(joinBlocks(blocks, mode));
}

export function renderContent(
  template: TextTemplate,
  replaceVariables: InterpolateFunction,
  disableSanitizeHtml: boolean
): string {
  return transformContent(template.mode, interpolateTemplate(template, replaceVariables), disableSanitizeHtml);
}
