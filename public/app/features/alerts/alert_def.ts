///<reference path="../../headers/common.d.ts" />

//import _ from 'lodash';

var alertStateToCssMap = {
  "OK": "icon-gf-online alert-icon-online",
  "WARN": "icon-gf-warn alert-icon-warn",
  "CRITICAL": "icon-gf-critical alert-icon-critical",
  "ACKNOWLEDGED": "icon-gf-alert-disabled"
};

function getCssForState(alertState) {
  return alertStateToCssMap[alertState];
}

export default {
  getCssForState
};
