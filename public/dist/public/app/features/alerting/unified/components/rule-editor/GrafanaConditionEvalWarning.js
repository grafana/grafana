import { durationToMilliseconds, parseDuration } from '@grafana/data';
import { Alert } from '@grafana/ui';
import { isEmpty } from 'lodash';
import React from 'react';
import { useFormContext } from 'react-hook-form';
// a warning that will be shown if a problematic yet technically valid combination of "evaluate every" and "evaluate for" is enetered
export var GrafanaConditionEvalWarning = function () {
    var watch = useFormContext().watch;
    var evaluateFor = watch('evaluateFor');
    var evaluateEvery = watch('evaluateEvery');
    if (evaluateFor === '0') {
        return null;
    }
    var durationFor = parseDuration(evaluateFor);
    var durationEvery = parseDuration(evaluateEvery);
    if (isEmpty(durationFor) || isEmpty(durationEvery)) {
        return null;
    }
    var millisFor = durationToMilliseconds(durationFor);
    var millisEvery = durationToMilliseconds(durationEvery);
    if (millisFor && millisEvery && millisFor <= millisEvery) {
        return (React.createElement(Alert, { severity: "warning", title: "" }, "Setting a \"for\" duration that is less than or equal to the evaluation interval will result in the evaluation interval being used to calculate when an alert that has stopped receiving data will be closed."));
    }
    return null;
};
//# sourceMappingURL=GrafanaConditionEvalWarning.js.map