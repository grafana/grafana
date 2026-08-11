import { type DataFrame, type InterpolateFunction, type ScopedVars } from '@grafana/data';
import { t } from '@grafana/i18n';

import { RenderMode, TextMode } from '../panelcfg.gen';

import { transformContent } from './utils';

/** Every row re-interpolates the whole template, which the edit preview redoes on every keystroke. */
export const MAX_RENDERED_ROWS = 1000;

/** What to render, built from either the panel options or the editor's draft. */
export interface TextTemplate {
  content: string;
  mode: TextMode;
  series?: DataFrame[];
  renderMode?: RenderMode;
  format?: string;
}

export function hasRenderableData(series?: DataFrame[]): series is DataFrame[] {
  return series?.some((frame) => frame.fields.length > 0 && frame.length > 0) ?? false;
}

export function interpolateTemplate(template: TextTemplate, replaceVariables: InterpolateFunction): string {
  const { content, series, renderMode, format } = template;

  if (renderMode === RenderMode.PerRow && hasRenderableData(series)) {
    return interpolateEveryRow(template, series, replaceVariables);
  }

  return replaceVariables(content, {}, format);
}

function interpolateEveryRow(
  template: TextTemplate,
  series: DataFrame[],
  replaceVariables: InterpolateFunction
): string {
  const { content, mode, format } = template;
  const totalRows = series.reduce((total, frame) => total + (frame.fields.length > 0 ? frame.length : 0), 0);
  const blocks: string[] = [];

  for (const [frameIndex, frame] of series.entries()) {
    const field = frame.fields[0];
    if (!field) {
      continue;
    }

    const rowCount = Math.min(frame.length, MAX_RENDERED_ROWS - blocks.length);
    for (let rowIndex = 0; rowIndex < rowCount; rowIndex++) {
      // `field` is unused by the ${__data} macro but required by the type, and
      // ${__value}/${__field} fall back to the raw match without it.
      const scopedVars: ScopedVars = {
        __dataContext: { value: { data: series, frame, field, rowIndex, frameIndex } },
      };

      blocks.push(replaceVariables(content, scopedVars, format));
    }

    if (blocks.length >= MAX_RENDERED_ROWS) {
      break;
    }
  }

  if (totalRows > MAX_RENDERED_ROWS) {
    blocks.push(t('textng.render.truncated', 'Showing the first {{maxRows}} rows.', { maxRows: MAX_RENDERED_ROWS }));
  }

  // Markdown needs a blank line between blocks, because `breaks` is off.
  return blocks.join(mode === TextMode.Markdown ? '\n\n' : '\n');
}

export function renderContent(
  template: TextTemplate,
  replaceVariables: InterpolateFunction,
  disableSanitizeHtml: boolean
): string {
  return transformContent(template.mode, interpolateTemplate(template, replaceVariables), disableSanitizeHtml);
}
