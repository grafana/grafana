import { sanitizeUrl } from '@braintree/sanitize-url';

const CSP_REPORT_ONLY_ENABLED = window.grafanaBootData!.settings.cspReportOnlyEnabled;

export const defaultTrustedTypesPolicy = {
  createHTML: (string: string, source: string, sink: string) => {
    if (!CSP_REPORT_ONLY_ENABLED) {
      return string.replace(/<script/gi, '&lt;script');
    }
    console.error('[HTML not sanitized with Trusted Types]', string, source, sink);
    return string;
  },
  createScript: (string: string) => string,
  createScriptURL: (string: string, source: string, sink: string) => {
    if (!CSP_REPORT_ONLY_ENABLED) {
      return sanitizeUrl(string);
    }
    console.error('[ScriptURL not sanitized with Trusted Types]', string, source, sink);
    return string;
  },
};

if (
  window.grafanaBootData!.settings.trustedTypesDefaultPolicyEnabled &&
  window.trustedTypes &&
  window.trustedTypes.createPolicy
) {
  // check if browser supports Trusted Types
  window.trustedTypes.createPolicy('default', defaultTrustedTypesPolicy);
}
