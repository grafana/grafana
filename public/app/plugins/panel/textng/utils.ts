import { renderTextPanelMarkdown, textUtil } from '@grafana/data';
import { type CodeMirrorEditorLanguage } from '@grafana/ui/unstable';

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

/** Maps the panel's CodeLanguage option to CodeMirrorEditor's lazy-loaded language names. */
export function getCodeMirrorLanguage(codeLanguage?: CodeLanguage): CodeMirrorEditorLanguage | undefined {
  switch (codeLanguage) {
    case CodeLanguage.Go:
      return 'go';
    case CodeLanguage.Html:
      return 'html';
    case CodeLanguage.Json:
      return 'json';
    case CodeLanguage.Markdown:
      return 'markdown';
    case CodeLanguage.Sql:
      return 'sql';
    case CodeLanguage.Typescript:
      return 'typescript';
    case CodeLanguage.Xml:
      return 'xml';
    case CodeLanguage.Yaml:
      return 'yaml';
    case CodeLanguage.Plaintext:
    default:
      return undefined;
  }
}
