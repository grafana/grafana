import { clampPanelNaturalHeight, PanelPlugin, renderTextPanelMarkdown, textUtil } from '@grafana/data';
import { t } from '@grafana/i18n';
import config from 'app/core/config';

import { TextPanel } from './TextPanel';
import { TextPanelEditor } from './TextPanelEditor';
import { CodeLanguage, defaultCodeOptions, defaultOptions, type Options, TextMode } from './panelcfg.gen';
import { textPanelMigrationHandler } from './textPanelMigrationHandler';

// Renders the text panel content into an offscreen div at the given width and
// returns its scrollHeight. Mirrors the rendering pipeline in TextPanel
// (markdown vs. raw HTML; sanitization driven by the same global setting).
// Code mode is skipped — Monaco editors have their own scrollbar UX and
// shouldn't be auto-sized to "natural" content.
function measureTextPanelHeight(options: Options, width: number): number | undefined {
  if (options.mode === TextMode.Code) {
    return undefined;
  }
  if (typeof document === 'undefined' || !document.body) {
    return undefined;
  }

  let html: string;
  if (options.mode === TextMode.HTML) {
    html = config.disableSanitizeHtml ? options.content : textUtil.sanitizeTextPanelContent(options.content);
  } else {
    html = renderTextPanelMarkdown(options.content, {
      noSanitize: config.disableSanitizeHtml,
    });
  }

  const measureDiv = document.createElement('div');
  measureDiv.className = 'markdown-html';
  // Match the chrome padding so the measured width corresponds to what
  // PanelChrome renders into. Sized off-screen so it never paints visibly.
  measureDiv.style.cssText = `position:absolute;top:-99999px;left:-99999px;width:${width}px;visibility:hidden;`;
  measureDiv.innerHTML = html;
  document.body.appendChild(measureDiv);
  const height = measureDiv.scrollHeight;
  document.body.removeChild(measureDiv);
  return height;
}

export const plugin = new PanelPlugin<Options>(TextPanel)
  .setNaturalHeight((ctx) => {
    const inner = measureTextPanelHeight(ctx.options, ctx.width);
    if (inner == null) {
      return undefined;
    }
    return clampPanelNaturalHeight(inner, ctx);
  })
  .setPanelOptions((builder) => {
    const category = [t('text.category-text', 'Text')];
    builder
      .addRadio({
        path: 'mode',
        name: t('text.name-mode', 'Mode'),
        category,
        settings: {
          options: [
            {
              value: TextMode.Markdown,
              label: t('text.mode-options.label-markdown', 'Markdown'),
            },
            {
              value: TextMode.HTML,
              label: t('text.mode-options.label-html', 'HTML'),
            },
            {
              value: TextMode.Code,
              label: t('text.mode-options.label-code', 'Code'),
            },
          ],
        },
        defaultValue: defaultOptions.mode,
      })
      .addSelect({
        path: 'code.language',
        name: t('text.name-language', 'Language'),
        category,
        settings: {
          options: Object.values(CodeLanguage).map((v) => ({
            value: v,
            label: v,
          })),
        },
        defaultValue: defaultCodeOptions.language,
        showIf: (v) => v.mode === TextMode.Code,
      })
      .addBooleanSwitch({
        path: 'code.showLineNumbers',
        name: t('text.name-show-line-numbers', 'Show line numbers'),
        category,
        defaultValue: defaultCodeOptions.showLineNumbers,
        showIf: (v) => v.mode === TextMode.Code,
      })
      .addBooleanSwitch({
        path: 'code.showMiniMap',
        name: t('text.name-show-mini-map', 'Show mini map'),
        category,
        defaultValue: defaultCodeOptions.showMiniMap,
        showIf: (v) => v.mode === TextMode.Code,
      })
      .addCustomEditor({
        id: 'content',
        path: 'content',
        name: t('text.name-content', 'Content'),
        category,
        editor: TextPanelEditor,
        defaultValue: defaultOptions.content,
      });
  })
  .setMigrationHandler(textPanelMigrationHandler)
  .setSuggestionsSupplier(() => []);
