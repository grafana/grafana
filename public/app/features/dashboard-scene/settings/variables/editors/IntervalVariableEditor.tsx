import React, { ChangeEvent, FormEvent } from 'react';

import { SelectableValue } from '@grafana/data';
import { IntervalVariable } from '@grafana/scenes';
import {
  getIntervalsFromQueryString,
  getIntervalsQueryFromNewIntervalModel,
} from 'app/features/dashboard-scene/utils/utils';

import { IntervalVariableForm } from '../components/IntervalVariableForm';

interface IntervalVariableEditorProps {
  variable: IntervalVariable;
  onRunQuery: () => void;
}

export function IntervalVariableEditor({ variable, onRunQuery }: IntervalVariableEditorProps) {
  const { intervals, autoStepCount, autoEnabled, autoMinInterval } = variable.useState();

  //transform intervals array into string
  const intervalsCombined = getIntervalsQueryFromNewIntervalModel(intervals);

  const onIntervalsChange = (event: FormEvent<HTMLInputElement>) => {
    const intervalsArray = getIntervalsFromQueryString(event.currentTarget.value);
    variable.setState({ intervals: intervalsArray });
    onRunQuery();
  };

  const onAutoCountChanged = (option: SelectableValue<number>) => {
    variable.setState({ autoStepCount: option.value });
  };

  const onAutoEnabledChange = (event: ChangeEvent<HTMLInputElement>) => {
    variable.setState({ autoEnabled: event.target.checked });
  };

  const onAutoMinIntervalChanged = (event: FormEvent<HTMLInputElement>) => {
    variable.setState({ autoMinInterval: event.currentTarget.value });
  };

  return (
    <IntervalVariableForm
      intervals={intervalsCombined}
      autoStepCount={autoStepCount}
      autoEnabled={autoEnabled}
      onAutoCountChanged={onAutoCountChanged}
      onIntervalsChange={onIntervalsChange}
      onAutoEnabledChange={onAutoEnabledChange}
      onAutoMinIntervalChanged={onAutoMinIntervalChanged}
      autoMinInterval={autoMinInterval}
    />
  );
}
