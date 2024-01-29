import React, { ChangeEvent, FormEvent } from 'react';

import { IntervalVariableModel, SelectableValue } from '@grafana/data';
import { IntervalVariableForm } from 'app/features/dashboard-scene/settings/variables/components/IntervalVariableForm';

import { VariableEditorProps } from '../editor/types';

export interface Props extends VariableEditorProps<IntervalVariableModel> {}

export const IntervalVariableEditor = React.memo(({ onPropChange, variable }: Props) => {
  const onAutoChange = (event: ChangeEvent<HTMLInputElement>) => {
    onPropChange({
      propName: 'auto',
      propValue: event.target.checked,
      updateOptions: true,
    });
  };

  const onQueryBlur = (event: FormEvent<HTMLInputElement>) => {
    onPropChange({
      propName: 'query',
      propValue: event.currentTarget.value,
      updateOptions: true,
    });
  };

  const onAutoCountChanged = (option: SelectableValue<number>) => {
    onPropChange({
      propName: 'auto_count',
      propValue: option.value,
      updateOptions: true,
    });
  };

  const onAutoMinChanged = (event: FormEvent<HTMLInputElement>) => {
    onPropChange({
      propName: 'auto_min',
      propValue: event.currentTarget.value,
      updateOptions: true,
    });
  };

  return (
    <IntervalVariableForm
      intervals={variable.query}
      autoStepCount={variable.auto_count}
      autoEnabled={variable.auto}
      onAutoCountChanged={onAutoCountChanged}
      onIntervalsChange={onQueryBlur}
      onAutoEnabledChange={onAutoChange}
      onAutoMinIntervalChanged={onAutoMinChanged}
      autoMinInterval={variable.auto_min}
    />
  );
});

IntervalVariableEditor.displayName = 'IntervalVariableEditor';
