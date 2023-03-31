import DOMPurify from 'dompurify';

import { config } from '@grafana/runtime';

if (config.bootData.settings.featureToggles.trustedTypes && window.trustedTypes && window.trustedTypes.createPolicy) {
  // check if browser supports Trusted Types
  window.trustedTypes.createPolicy('default', {
    createHTML: (string) => DOMPurify.sanitize(string, { RETURN_TRUSTED_TYPE: true }).toString(),
    createScript: (string) => string,
    createScriptURL: (string) => (string.startsWith('data:') ? '' : string),
  });
}
