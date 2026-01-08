import { noop } from 'lodash';
import { ChangeEvent, FormEvent } from 'react';

import { SelectableValue } from '@grafana/data';
import { IntervalVariable, SceneVariable } from '@grafana/scenes';
import { OptionsPaneItemDescriptor } from 'app/features/dashboard/components/PanelEditor/OptionsPaneItemDescriptor';
import {
  getIntervalsFromQueryString,
  getIntervalsQueryFromNewIntervalModel,
} from 'app/features/dashboard-scene/utils/utils';

import { IntervalVariableForm } from '../components/IntervalVariableForm';

interface IntervalVariableEditorProps {
  variable: IntervalVariable;
  onRunQuery: () => void;
  inline?: boolean;
}

export function IntervalVariableEditor({ variable, onRunQuery, inline }: IntervalVariableEditorProps) {
  const { intervals, autoStepCount, autoEnabled, autoMinInterval, value } = variable.useState();

  //transform intervals array into string
  const intervalsCombined = getIntervalsQueryFromNewIntervalModel(intervals);

  const onIntervalsChange = (event: FormEvent<HTMLInputElement>) => {
    const newIntervals = getIntervalsFromQueryString(event.currentTarget.value);
    // if the current value is not in the new intervals, set the value to the first interval
    const newValue = newIntervals.includes(value) ? value : newIntervals[0];

    variable.setState({
      intervals: newIntervals,
      value: newValue,
    });

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
      inline={inline}
    />
  );
}

export function getIntervalVariableOptions(variable: SceneVariable): OptionsPaneItemDescriptor[] {
  if (!(variable instanceof IntervalVariable)) {
    console.warn('getIntervalVariableOptions: variable is not an IntervalVariable');
    return [];
  }

  return [
    new OptionsPaneItemDescriptor({
      id: `variable-${variable.state.name}-value`,
      render: () => <IntervalVariableEditor variable={variable} onRunQuery={noop} inline={true} />,
    }),
  ];
}
