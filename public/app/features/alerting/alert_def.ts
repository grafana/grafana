///<reference path="../../headers/common.d.ts" />

var alertSeverityIconMap = {
  "ok": "icon-gf-online alert-icon-online",
  "warning": "icon-gf-warn alert-icon-warn",
  "critical": "icon-gf-critical alert-icon-critical",
};

function getSeverityIconClass(alertState) {
  return alertSeverityIconMap[alertState];
}

export default {
  getSeverityIconClass,
};
