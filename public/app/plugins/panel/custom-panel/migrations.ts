import { type PanelTypeChangedHandler } from '@grafana/data';

import { getBlankDrawingCode } from './templates';
import { type Options } from './types';

export const DYNAMIC_TEXT_PANEL_ID = 'marcusolsson-dynamictext-panel';

export const customPanelChangeHandler: PanelTypeChangedHandler<Options> = (panel, prevPluginId, prevOptions) => {
  if (prevPluginId === DYNAMIC_TEXT_PANEL_ID) {
    return { code: convertDynamicTextOptions(prevOptions).code };
  }
  return panel.options;
};

type RenderMode = 'everyRow' | 'allRows';

interface SimpleDynamicText {
  content: string;
  defaultContent: string;
  styles: string;
  renderMode: RenderMode;
}

// Handlebars features the conversion cannot reproduce: block helpers, closing blocks, partials,
// else branches and unescaped output.
const UNSUPPORTED_SYNTAX = ['{{#', '{{/', '{{>', '{{else', '{{{'];
const EXPRESSION = /\{\{~?\s*([^{}]*?)\s*~?\}\}/g;
// A plain field reference: a bare name, or a bracketed name that may contain spaces.
const FIELD_REFERENCE = /^(?:\[[^\]]+\]|[^\s[\]@!]+)$/;

/**
 * Converts the options of the Dynamic text panel (marcusolsson-dynamictext-panel) into render
 * panel code. Only templates that substitute fields ({{name}} or {{[a name]}}) convert; anything
 * that needs Handlebars itself falls back to the blank template, with the original kept in a
 * comment so nothing is lost.
 */
export function convertDynamicTextOptions(prev: unknown): { code: string; converted: boolean } {
  const simple = asSimpleDynamicText(prev);
  if (!simple) {
    return { code: unconvertedCode(prev), converted: false };
  }
  return { code: convertedCode(simple), converted: true };
}

function asSimpleDynamicText(prev: unknown): SimpleDynamicText | null {
  if (!isRecord(prev) || typeof prev.content !== 'string') {
    return null;
  }
  const content = prev.content;
  if (UNSUPPORTED_SYNTAX.some((token) => content.includes(token))) {
    return null;
  }
  for (const match of content.matchAll(EXPRESSION)) {
    const expression = match[1];
    // Comments are dropped; helper calls ({{date time "YYYY"}}) and @data variables need Handlebars.
    if (!expression.startsWith('!') && !FIELD_REFERENCE.test(expression)) {
      return null;
    }
  }
  if (!isBlank(prev.helpers) || !isBlank(prev.afterRender) || hasItems(prev.contentPartials)) {
    return null;
  }

  let renderMode: RenderMode;
  if (prev.renderMode === undefined) {
    // Older versions of the panel stored a boolean instead of a render mode.
    renderMode = prev.everyRow === false ? 'allRows' : 'everyRow';
  } else if (prev.renderMode === 'everyRow' || prev.renderMode === 'allRows') {
    renderMode = prev.renderMode;
  } else {
    return null;
  }

  return {
    content,
    defaultContent: typeof prev.defaultContent === 'string' ? prev.defaultContent : '',
    styles: typeof prev.styles === 'string' ? prev.styles : '',
    renderMode,
  };
}

function convertedCode({ content, defaultContent, styles, renderMode }: SimpleDynamicText): string {
  return `// Converted from the Dynamic text panel. {{field}} placeholders are filled from the first
// frame (${renderMode === 'everyRow' ? 'once per row' : 'with its first row'}), with HTML escaping.
// HTML in the template is kept; Markdown is shown as plain text.
const TEMPLATE = ${JSON.stringify(content)};
const DEFAULT_CONTENT = ${JSON.stringify(defaultContent)};
const STYLES = ${JSON.stringify(styles)};
const EVERY_ROW = ${renderMode === 'everyRow'};

function escapeHtml(value) {
  const escapes = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  return String(value == null ? '' : value).replace(/[&<>"']/g, (c) => escapes[c]);
}

panel.onRender(({ root, data }) => {
  const frame = data.series[0];
  const rowCount = frame ? frame.length : 0;
  const lookup = (name) => frame && frame.fields.find((f) => f.name === name || f.state.displayName === name);
  const fill = (row) =>
    TEMPLATE.replace(/\\{\\{~?\\s*([^{}]*?)\\s*~?\\}\\}/g, (_, expression) => {
      if (expression.startsWith('!')) {
        return '';
      }
      const field = lookup(expression.replace(/^\\[(.*)\\]$/, '$1'));
      const value = field ? field.values[row] : null;
      return value == null ? '' : escapeHtml(value);
    });

  let html;
  if (rowCount === 0) {
    html = escapeHtml(DEFAULT_CONTENT);
  } else if (EVERY_ROW) {
    html = Array.from({ length: rowCount }, (_, row) => '<div class="row">' + fill(row) + '</div>').join('');
  } else {
    html = fill(0);
  }
  root.innerHTML =
    '<style>.dynamic-text{white-space:pre-wrap;padding:8px}' + STYLES + '</style><div class="dynamic-text">' + html + '</div>';
});
`;
}

function unconvertedCode(prev: unknown): string {
  const record = isRecord(prev) ? prev : {};
  const sections = [
    ['content', record.content],
    ['helpers', record.helpers],
    ['afterRender', record.afterRender],
    ['styles', record.styles],
  ]
    .filter((entry): entry is [string, string] => typeof entry[1] === 'string' && entry[1].trim() !== '')
    .map(([name, value]) => ` * Original ${name}:\n *\n${commentLines(value)}\n *`);

  const header = [
    '/*',
    ' * Converted from the Dynamic text panel. Its template uses features that cannot be converted',
    ' * automatically (Handlebars blocks, partials, helpers, afterRender or a data render mode).',
    ' * Rewrite it as drawing code below.',
    ' *',
    ...sections,
    ' */',
  ].join('\n');

  return `${header}\n${getBlankDrawingCode()}`;
}

function commentLines(value: string): string {
  return value
    .replace(/\*\//g, '*\\/')
    .split('\n')
    .map((line) => ` *   ${line}`)
    .join('\n');
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isBlank(value: unknown): boolean {
  return value === undefined || value === null || (typeof value === 'string' && value.trim() === '');
}

function hasItems(value: unknown): boolean {
  return Array.isArray(value) && value.length > 0;
}
