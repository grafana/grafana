///<reference path="../../headers/common.d.ts" />

//import _ from 'lodash';

var alertStateToCssMap = {
  "OK": "icon-gf-online alert-state-online",
  "WARN": "icon-gf-warn alert-state-warn",
  "CRITICAL": "icon-gf-critical alert-state-critical",
  "ACKNOWLEDGED": "icon-gf-alert-disabled"
};

function getCssForState(alertState) {
  return alertStateToCssMap[alertState];
}

export default {
  getCssForState
};
