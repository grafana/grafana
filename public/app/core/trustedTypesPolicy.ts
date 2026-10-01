import { textUtil } from '@grafana/data';

export const enforcingTrustedTypesPolicy = {
  createHTML: (html: string) => html.replace(/<script/gi, '&lt;script'),
  createScript: (script: string) => script,
  createScriptURL: (url: string) => textUtil.sanitizeUrl(url),
};
