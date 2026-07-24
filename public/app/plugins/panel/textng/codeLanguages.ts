import { type CodeMirrorEditorLanguage } from '@grafana/ui/unstable';

import { CodeLanguage } from '../../schemas/textng/panelcfg.gen';

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
