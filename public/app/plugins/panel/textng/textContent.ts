import { renderTextPanelMarkdown, textUtil } from '@grafana/data';

import { TextMode } from '../../schemas/textng/panelcfg.gen';

/**
 * Converts already-interpolated panel content to the HTML the panel renders
 * (or leaves it untouched for code mode). Shared by the dashboard render path
 * (TextNGPanel) and the edit-time preview (TextNGEditor) so what the author
 * previews is exactly what the panel shows.
 */
export function transformContent(mode: TextMode, content: string, disableSanitizeHtml: boolean): string {
  if (!content) {
    return ' ';
  }

  switch (mode) {
    case TextMode.Code:
      break;
    case TextMode.HTML:
      if (!disableSanitizeHtml) {
        content = textUtil.sanitizeTextPanelContent(content);
      }
      break;
    case TextMode.Markdown:
    default:
      content = renderTextPanelMarkdown(content, {
        noSanitize: disableSanitizeHtml,
      });
  }

  return content;
}
