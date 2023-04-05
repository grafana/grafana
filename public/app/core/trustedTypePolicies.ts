import DOMPurify from 'dompurify';

import { textUtil } from '@grafana/data';
import { config } from '@grafana/runtime';

if (config.bootData.settings.featureToggles.trustedTypes && window.trustedTypes && window.trustedTypes.createPolicy) {
  // check if browser supports Trusted Types
  window.trustedTypes.createPolicy('default', {
    createHTML: (string) => DOMPurify.sanitize(string),
    createScript: (string) => string,
    createScriptURL: (string) => textUtil.sanitizeUrl(string),
  });
}
