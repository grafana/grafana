import { type Options, RenderMode, TextMode } from './panelcfg.gen';

const DATA_MACRO_PATTERN = /(?:\$\{?|\[\[)__(?:value|field|data|series)\b/;
// Preserve queries for ambiguous templates: a false positive is harmless, while a false negative can lose real data use.
const HANDLEBARS_PATTERN = /\{\{/;

export function getTextDataUsage(options: Partial<Options>) {
  const content = options.content ?? '';
  return {
    dataMacros: DATA_MACRO_PATTERN.test(content),
    handlebars: options.mode !== TextMode.Code && HANDLEBARS_PATTERN.test(content),
    perRow: options.renderMode === RenderMode.PerRow,
  };
}
