import { textUtil } from '@grafana/data';
import { config } from '@grafana/runtime';

const CSP_REPORT_ONLY_ENABLED = config.bootData.settings.cspReportOnlyEnabled;

if (
  config.bootData.settings.trustedTypesDefaultPolicyEnabled &&
  window.trustedTypes &&
  window.trustedTypes.createPolicy
) {
  // check if browser supports Trusted Types
  window.trustedTypes.createPolicy('default', {
    createHTML: (string, source, sink) => {
      if (!CSP_REPORT_ONLY_ENABLED) {
        return string.replace(/<script/gi, '&lt;script');
      }
      console.error('[HTML not sanitized with Trusted Types]', string, source, sink);
      return string;
    },
    createScript: (string) => string,
    createScriptURL: (string, source, sink) => {
      if (!CSP_REPORT_ONLY_ENABLED) {
        return textUtil.sanitizeUrl(string);
      }
      console.error('[ScriptURL not sanitized with Trusted Types]', string, source, sink);
      return string;
    },
  });
}
