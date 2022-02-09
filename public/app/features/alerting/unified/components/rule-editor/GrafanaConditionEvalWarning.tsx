import { durationToMilliseconds, parseDuration } from '@grafana/data';
import { Alert } from '@grafana/ui';
import { isEmpty } from 'lodash';
import React, { FC } from 'react';
import { useFormContext } from 'react-hook-form';
import { RuleFormValues } from '../../types/rule-form';

// a warning that will be shown if a problematic yet technically valid combination of "evaluate every" and "evaluate for" is enetered
export const GrafanaConditionEvalWarning: FC = () => {
  const { watch } = useFormContext<RuleFormValues>();
  const evaluateFor = watch('evaluateFor');
  const evaluateEvery = watch('evaluateEvery');
  if (evaluateFor === '0') {
    return null;
  }
  const durationFor = parseDuration(evaluateFor);
  const durationEvery = parseDuration(evaluateEvery);
  if (isEmpty(durationFor) || isEmpty(durationEvery)) {
    return null;
  }
  const millisFor = durationToMilliseconds(durationFor);
  const millisEvery = durationToMilliseconds(durationEvery);
  if (millisFor && millisEvery && millisFor <= millisEvery) {
    return (
      <Alert severity="warning" title="">
        Setting a &quot;for&quot; duration that is less than or equal to the evaluation interval will result in the
        evaluation interval being used to calculate when an alert that has stopped receiving data will be closed.
      </Alert>
    );
  }
  return null;
};
