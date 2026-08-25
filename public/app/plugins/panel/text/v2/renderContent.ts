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

const hasRows = (frame: DataFrame) => frame.fields.length > 0 && frame.length > 0;

export function hasRenderableData(series?: DataFrame[]): series is DataFrame[] {
  return series?.some(hasRows) ?? false;
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

  const scopedVars = buildOnceContext(series);

  if (!compiled) {
    return replaceVariables(content, scopedVars, format);
  }

  let readRows = false;
  const rows = trackRowAccess(buildAllRowsContext(series, MAX_RENDERED_ROWS), () => {
    readRows = true;
  });

  const blocks = [replaceVariables(compiled(rows), scopedVars, format)];

  if (readRows && countRows(series) > MAX_RENDERED_ROWS) {
    blocks.push(truncationNotice());
  }

  return joinBlocks(blocks, mode);
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
  const withRows = series.findIndex(hasRows);

  return withRows >= 0 ? withRows : series.findIndex((frame) => frame.fields.length > 0);
}

// lastNotNull, the reduction the stat panel shows by default.
function reduceToDisplayValue(field: Field): DisplayValue {
  const value = reduceField({ field, reducers: [ReducerID.lastNotNull] })[ReducerID.lastNotNull];

  // `display` is only attached once field overrides have run.
  return (field.display ?? getDisplayProcessor())(value);
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
    const field = getMacroField(frame);
    if (!field) {
      continue;
    }

    const rowCount = Math.min(frame.length, MAX_RENDERED_ROWS - blocks.length);
    const rows = compiled ? buildRows(frame, series, rowCount) : [];

    for (let rowIndex = 0; rowIndex < rowCount; rowIndex++) {
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
