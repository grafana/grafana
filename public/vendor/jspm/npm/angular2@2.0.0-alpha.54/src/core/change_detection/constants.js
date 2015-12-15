/* */ 
'use strict';
var lang_1 = require('../../facade/lang');
(function(ChangeDetectorState) {
  ChangeDetectorState[ChangeDetectorState["NeverChecked"] = 0] = "NeverChecked";
  ChangeDetectorState[ChangeDetectorState["CheckedBefore"] = 1] = "CheckedBefore";
  ChangeDetectorState[ChangeDetectorState["Errored"] = 2] = "Errored";
})(exports.ChangeDetectorState || (exports.ChangeDetectorState = {}));
var ChangeDetectorState = exports.ChangeDetectorState;
(function(ChangeDetectionStrategy) {
  ChangeDetectionStrategy[ChangeDetectionStrategy["CheckOnce"] = 0] = "CheckOnce";
  ChangeDetectionStrategy[ChangeDetectionStrategy["Checked"] = 1] = "Checked";
  ChangeDetectionStrategy[ChangeDetectionStrategy["CheckAlways"] = 2] = "CheckAlways";
  ChangeDetectionStrategy[ChangeDetectionStrategy["Detached"] = 3] = "Detached";
  ChangeDetectionStrategy[ChangeDetectionStrategy["OnPush"] = 4] = "OnPush";
  ChangeDetectionStrategy[ChangeDetectionStrategy["Default"] = 5] = "Default";
  ChangeDetectionStrategy[ChangeDetectionStrategy["OnPushObserve"] = 6] = "OnPushObserve";
})(exports.ChangeDetectionStrategy || (exports.ChangeDetectionStrategy = {}));
var ChangeDetectionStrategy = exports.ChangeDetectionStrategy;
exports.CHANGE_DETECTION_STRATEGY_VALUES = [ChangeDetectionStrategy.CheckOnce, ChangeDetectionStrategy.Checked, ChangeDetectionStrategy.CheckAlways, ChangeDetectionStrategy.Detached, ChangeDetectionStrategy.OnPush, ChangeDetectionStrategy.Default, ChangeDetectionStrategy.OnPushObserve];
exports.CHANGE_DETECTOR_STATE_VALUES = [ChangeDetectorState.NeverChecked, ChangeDetectorState.CheckedBefore, ChangeDetectorState.Errored];
function isDefaultChangeDetectionStrategy(changeDetectionStrategy) {
  return lang_1.isBlank(changeDetectionStrategy) || changeDetectionStrategy === ChangeDetectionStrategy.Default;
}
exports.isDefaultChangeDetectionStrategy = isDefaultChangeDetectionStrategy;
