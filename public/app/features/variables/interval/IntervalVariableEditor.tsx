import { css } from '@emotion/css';
import React, { ChangeEvent, FormEvent } from 'react';

import { GrafanaTheme2, IntervalVariableModel, SelectableValue } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { useStyles2 } from '@grafana/ui';

import { VariableCheckboxField } from '../editor/VariableCheckboxField';
import { VariableLegend } from '../editor/VariableLegend';
import { VariableSelectField } from '../editor/VariableSelectField';
import { VariableTextField } from '../editor/VariableTextField';
import { VariableEditorProps } from '../editor/types';

const STEP_OPTIONS = [1, 2, 3, 4, 5, 10, 20, 30, 40, 50, 100, 200, 300, 400, 500].map((count) => ({
  label: `${count}`,
  value: count,
}));

export interface Props extends VariableEditorProps<IntervalVariableModel> {}

export const IntervalVariableEditor = React.memo(({ onPropChange, variable }: Props) => {
  const onAutoChange = (event: ChangeEvent<HTMLInputElement>) => {
    onPropChange({
      propName: 'auto',
      propValue: event.target.checked,
      updateOptions: true,
    });
  };

  const onQueryChanged = (event: FormEvent<HTMLInputElement>) => {
    onPropChange({
      propName: 'query',
      propValue: event.currentTarget.value,
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

  const stepValue = STEP_OPTIONS.find((o) => o.value === variable.auto_count) ?? STEP_OPTIONS[0];

  const styles = useStyles2(getStyles);

  return (
    <>
      <VariableLegend>Interval options</VariableLegend>
      <VariableTextField
        value={variable.query}
        name="Values"
        placeholder="1m,10m,1h,6h,1d,7d"
        onChange={onQueryChanged}
        onBlur={onQueryBlur}
        testId={selectors.pages.Dashboard.Settings.Variables.Edit.IntervalVariable.intervalsValueInput}
        width={32}
        required
      />

      <VariableCheckboxField
        value={variable.auto}
        name="Auto option"
        description="Dynamically calculates interval by dividing time range by the count specified"
        onChange={onAutoChange}
      />
      {variable.auto && (
        <div className={styles.autoFields}>
          <VariableSelectField
            name="Step count"
            description="How many times the current time range should be divided to calculate the value"
            value={stepValue}
            options={STEP_OPTIONS}
            onChange={onAutoCountChanged}
            width={9}
          />
          <VariableTextField
            value={variable.auto_min}
            name="Min interval"
            description="The calculated value will not go below this threshold"
            placeholder="10s"
            onChange={onAutoMinChanged}
            width={11}
          />
        </div>
      )}
    </>
  );
});

IntervalVariableEditor.displayName = 'IntervalVariableEditor';

function getStyles(theme: GrafanaTheme2) {
  return {
    autoFields: css({
      marginTop: theme.spacing(2),
      display: 'flex',
      flexDirection: 'column',
    }),
  };
}
