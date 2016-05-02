///<reference path="../../headers/common.d.ts" />

//import _ from 'lodash';

var alertStateToCssMap = {
  "OK": "icon-gf-online",
  "WARN": "icon-gf-warn",
  "CRITICAL": "icon-gf-critical",
  "ACKNOWLEDGED": "icon-gf-alert-disabled"

};

function getCssForState(alertState) {
  return alertStateToCssMap[alertState];
}

export default {
  getCssForState
};
