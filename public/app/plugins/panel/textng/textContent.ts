import { renderTextPanelMarkdown, textUtil } from '@grafana/data';

import { CodeLanguage, TextMode } from '../../schemas/textng/panelcfg.gen';

export function getInterpolateFormat(codeLanguage?: CodeLanguage): 'json' | 'html' {
  return codeLanguage === CodeLanguage.Json ? 'json' : 'html';
}

/** Shared by the panel and the edit-time preview so they can't diverge. */
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
