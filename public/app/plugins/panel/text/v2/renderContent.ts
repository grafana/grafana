import {
  type DataFrame,
  type DisplayValue,
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
  /** The character ceiling cut the output short, so what renders is incomplete. */
  truncated?: boolean;
}

/** Interpolated output, and whether the character ceiling cut it short. */
export interface InterpolatedContent {
  content: string;
  truncated: boolean;
}

/** Turns a broken Handlebars template into an error to display instead of content. */
export function catchTemplateError(render: () => InterpolatedContent): RenderedContent {
  try {
    return render();
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

/** Counted across all frames, skipping those a template is given no rows for. */
export function countRows(series: DataFrame[]): number {
  return series.reduce((total, frame) => total + (frame.fields.length > 0 ? frame.length : 0), 0);
}

export function interpolateTemplate(
  template: TextTemplate,
  replaceVariables: InterpolateFunction
): InterpolatedContent {
  const { content, mode, series = [], renderMode, format } = template;

  // Code mode shows the source verbatim, and Handlebars' HTML escaping would mangle it.
  const compiled =
    isTextNewFeaturesEnabled() && mode !== TextMode.Code
      ? compileTemplate(escapeCommentedTemplates(content), replaceVariables)
      : undefined;

  if (renderMode === RenderMode.PerRow && hasRenderableData(series)) {
    return interpolateEveryRow(template, series, replaceVariables, compiled);
  }

  const scopedVars = buildOnceContext(series);

  if (!compiled) {
    return { content: replaceVariables(content, scopedVars, format), truncated: false };
  }

  let readRows = false;
  const context = buildAllRowsContext(series, MAX_RENDERED_ROWS, () => {
    readRows = true;
  });
  const rendered = replaceVariables(compiled(context), scopedVars, format);

  // A Once template emits one string, so the row ceiling cannot bound its size.
  const cut = cutToMaxChars(rendered);

  // Rows past the ceiling never reach `data`, and Once has no pagination to cover them. Left
  // unreported the panel reads as complete, and `{{data.length}}` states the ceiling as the count.
  // Only counts against a template that read a row: the default content ignores its data, and a
  // panel showing a title over a thousand-row query has lost nothing.
  const rowsDropped = readRows && countRows(series) > MAX_RENDERED_ROWS;

  return { ...cut, truncated: cut.truncated || rowsDropped };
}

// Matched the way the sanitizer reads a comment: `<!-->` and `<!--->` close abruptly, and an
// unterminated one runs to the end of the document.
const HTML_COMMENT = /<!--(?:-?>|[\s\S]*?(?:-->|$))/g;

/** Already escaped by the author, so escaping again would interpolate what they opted out of. */
const UNESCAPED_MUSTACHE = /(?<!\\)\{\{/g;

// Expressions inside an HTML comment render output the sanitizer always discards, so running
// them only spends the character budget - and a cut landing inside the comment takes the rest
// of the template with it. A comment is commented-out template, so its expressions are escaped
// to render as themselves rather than run.
//
// Escaped rather than dropped, so the comment survives as text: in markdown it may be the
// content, inside a code span or fence, and with `disable_sanitize_html` it reaches the DOM the
// way a comment holding no expression always has.
//
// A comment the template itself builds, as in `{{#if hide}}<!--{{/if}}`, is not rescued by this.
// Its delimiters sit inside the comment span either way, so the `{{#if}}` outside pairs with a
// different `{{/if}}` than the author wrote, whatever is done to the contents.
function escapeCommentedTemplates(content: string): string {
  return content.replace(HTML_COMMENT, (comment) => comment.replace(UNESCAPED_MUSTACHE, '\\{{'));
}

// Cut on a line break so the tail lands between elements rather than inside a tag, but
// only a nearby one - a single-line block's nearest break can be the top of the output.
function cutToMaxChars(rendered: string): InterpolatedContent {
  if (rendered.length <= MAX_RENDERED_CHARS) {
    return { content: rendered, truncated: false };
  }

  const boundary = rendered.lastIndexOf('\n', MAX_RENDERED_CHARS);

  return {
    content: rendered.slice(0, boundary >= MAX_RENDERED_CHARS - CUT_BACKTRACK_CHARS ? boundary : MAX_RENDERED_CHARS),
    truncated: true,
  };
}

// Never the time field, where ${__field.labels.x} is always empty.
function getMacroField(frame: DataFrame): Field | undefined {
  return frame.fields.find((field) => field.type !== FieldType.time) ?? frame.fields[0];
}

// Rendering once leaves no row for ${__value} to read, so it resolves against the
// reduced value instead. ${__data} does need one, and keeps its literal fallback.
function buildOnceContext(series: DataFrame[]): ScopedVars {
  const frameIndex = findMacroFrameIndex(series);
  const frame = series[frameIndex];
  const field = frame && getMacroField(frame);

  if (!field) {
    return {};
  }

  const calculatedValue = reduceToDisplayValue(field);

  return { __dataContext: { value: { data: series, frame, field, frameIndex, calculatedValue } } };
}

// The frame Handlebars' `data` binds to, so the two syntaxes agree.
function findMacroFrameIndex(series: DataFrame[]): number {
  const withRows = series.findIndex((frame) => frame.fields.length > 0 && frame.length > 0);

  return withRows >= 0 ? withRows : series.findIndex((frame) => frame.fields.length > 0);
}

// lastNotNull, the reduction the stat panel shows by default.
function reduceToDisplayValue(field: Field): DisplayValue {
  const value = reduceField({ field, reducers: [ReducerID.lastNotNull] })[ReducerID.lastNotNull];

  // `display` is only attached once field overrides have run.
  return (field.display ?? getDisplayProcessor())(value);
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
): InterpolatedContent {
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
  const cut = cutToMaxChars(joinBlocks(blocks, mode));

  // Every row this pass was meant to cover: the page when paginated, and otherwise all of them,
  // since nothing else will render the rest. A shortfall is a row the reader never sees.
  const totalRows = countRows(series);
  const requestedRows = rowWindow ? Math.min(rowWindow.count, Math.max(0, totalRows - windowStart)) : totalRows;

  return { ...cut, truncated: cut.truncated || blocks.length < requestedRows };
}

export function renderContent(
  template: TextTemplate,
  replaceVariables: InterpolateFunction,
  disableSanitizeHtml: boolean
): InterpolatedContent {
  const { content, truncated } = interpolateTemplate(template, replaceVariables);

  return { content: transformContent(template.mode, content, disableSanitizeHtml), truncated };
}
