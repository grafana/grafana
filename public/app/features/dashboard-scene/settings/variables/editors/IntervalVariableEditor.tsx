import { isEqual, noop } from 'lodash';
import { type ChangeEvent, type FormEvent, useEffect, useRef, useState } from 'react';

import { type SelectableValue } from '@grafana/data';
import { t } from '@grafana/i18n';
import { IntervalVariable, type SceneVariable } from '@grafana/scenes';
import { OptionsPaneItemDescriptor } from 'app/features/dashboard/components/PanelEditor/OptionsPaneItemDescriptor';
import { getIntervalsQueryFromNewIntervalModel } from 'app/features/dashboard-scene/utils/getIntervalsQueryFromNewIntervalModel';
import { getIntervalsFromQueryString } from 'app/features/dashboard-scene/utils/utils';

import { undoableVariableEdit } from '../../../actions/variable/undoableVariableEdit';
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

  // The intervals input is uncontrolled, remount the form when the intervals change outside of it (e.g. undo/redo)
  const [formKey, setFormKey] = useState(0);
  const intervalsSetByEditor = useRef(intervalsCombined);

  useEffect(() => {
    if (intervalsCombined !== intervalsSetByEditor.current) {
      intervalsSetByEditor.current = intervalsCombined;
      setFormKey((key) => key + 1);
    }
  }, [intervalsCombined]);

  const onIntervalsChange = (event: FormEvent<HTMLInputElement>) => {
    const newIntervals = getIntervalsFromQueryString(event.currentTarget.value);
    // if the current value is not in the new intervals, set the value to the first interval
    const newValue = newIntervals.includes(value) ? value : newIntervals[0];
    const oldState = { intervals: variable.state.intervals, value: variable.state.value };
    intervalsSetByEditor.current = getIntervalsQueryFromNewIntervalModel(newIntervals);

    undoableVariableEdit(inline && !isEqual(oldState, { intervals: newIntervals, value: newValue }), {
      meta: { actionId: 'variable.changeIntervals' },
      source: variable,
      description: t('dashboard.edit-actions.variable-interval-values', 'Change variable intervals'),
      perform: () => {
        variable.setState({
          intervals: newIntervals,
          value: newValue,
        });

        onRunQuery();
      },
      undo: () => {
        variable.setState(oldState);
        onRunQuery();
      },
    });
  };

  const onAutoCountChanged = (option: SelectableValue<number>) => {
    const oldAutoStepCount = variable.state.autoStepCount;

    undoableVariableEdit(inline, {
      meta: { actionId: 'variable.changeStepCount' },
      source: variable,
      description: t('dashboard.edit-actions.variable-interval-step-count', 'Change variable step count'),
      perform: () => variable.setState({ autoStepCount: option.value }),
      undo: () => variable.setState({ autoStepCount: oldAutoStepCount }),
    });
  };

  const onAutoEnabledChange = (event: ChangeEvent<HTMLInputElement>) => {
    const newAutoEnabled = event.target.checked;
    const oldAutoEnabled = variable.state.autoEnabled;

    undoableVariableEdit(inline, {
      meta: { actionId: 'variable.changeAutoOption' },
      source: variable,
      description: t('dashboard.edit-actions.variable-interval-auto', 'Change variable auto option'),
      perform: () => variable.setState({ autoEnabled: newAutoEnabled }),
      undo: () => variable.setState({ autoEnabled: oldAutoEnabled }),
    });
  };

  // Typing updates the state right away, the whole edit is recorded once the input loses focus
  const autoMinIntervalBeforeEdit = useRef<string | undefined>(undefined);

  const onAutoMinIntervalChanged = (event: FormEvent<HTMLInputElement>) => {
    autoMinIntervalBeforeEdit.current ??= variable.state.autoMinInterval;
    variable.setState({ autoMinInterval: event.currentTarget.value });
  };

  const onAutoMinIntervalBlur = () => {
    const oldAutoMinInterval = autoMinIntervalBeforeEdit.current;
    const newAutoMinInterval = variable.state.autoMinInterval;
    autoMinIntervalBeforeEdit.current = undefined;

    if (!inline || oldAutoMinInterval === undefined || oldAutoMinInterval === newAutoMinInterval) {
      return;
    }

    undoableVariableEdit(true, {
      meta: { actionId: 'variable.changeMinInterval' },
      source: variable,
      description: t('dashboard.edit-actions.variable-interval-min-interval', 'Change variable min interval'),
      perform: () => variable.setState({ autoMinInterval: newAutoMinInterval }),
      undo: () => variable.setState({ autoMinInterval: oldAutoMinInterval }),
    });
  };

  return (
    <IntervalVariableForm
      key={formKey}
      intervals={intervalsCombined}
      autoStepCount={autoStepCount}
      autoEnabled={autoEnabled}
      onAutoCountChanged={onAutoCountChanged}
      onIntervalsChange={onIntervalsChange}
      onAutoEnabledChange={onAutoEnabledChange}
      onAutoMinIntervalChanged={onAutoMinIntervalChanged}
      onAutoMinIntervalBlur={onAutoMinIntervalBlur}
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
