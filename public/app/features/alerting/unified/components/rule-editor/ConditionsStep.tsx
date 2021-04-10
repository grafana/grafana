import React, { FC, useState } from 'react';
import { Field, Input, Select, useStyles, InputControl, InlineLabel, Switch } from '@grafana/ui';
import { css } from '@emotion/css';
import { GrafanaTheme } from '@grafana/data';
import { RuleEditorSection } from './RuleEditorSection';
import { useFormContext } from 'react-hook-form';
import { RuleFormType, RuleFormValues } from '../../types/rule-form';
import { ConditionField } from './ConditionField';
import { GrafanaAlertStatePicker } from './GrafanaAlertStatePicker';

enum TIME_OPTIONS {
  milliseconds = 'ms',
  seconds = 's',
  minutes = 'm',
  hours = 'h',
  days = 'd',
}

const timeOptions = Object.entries(TIME_OPTIONS).map(([key, value]) => ({
  label: key[0].toUpperCase() + key.slice(1),
  value: value,
}));

export const ConditionsStep: FC = () => {
  const styles = useStyles(getStyles);
  const [showErrorHandling, setShowErrorHandling] = useState(false);
  const { register, control, watch } = useFormContext<RuleFormValues>();

  const type = watch('type');

  return (
    <RuleEditorSection stepNo={3} title="Define alert conditions">
      {type === RuleFormType.threshold && (
        <>
          <ConditionField />
          <Field label="Evaluate">
            <div className={styles.flexRow}>
              <InlineLabel width={16} tooltip="How often the alert will be evaluated to see if it fires">
                Evaluate every
              </InlineLabel>
              <Input width={8} ref={register()} name="evaluateEvery" />
              <InlineLabel
                width={7}
                tooltip='Once condition is breached, alert will go into pending state. If it is pending for longer than the "for" value, it will become a firing alert.'
              >
                for
              </InlineLabel>
              <Input width={8} ref={register()} name="evaluateFor" />
            </div>
          </Field>
          <Field label="Configure no data and error handling" horizontal={true} className={styles.switchField}>
            <Switch value={showErrorHandling} onChange={() => setShowErrorHandling(!showErrorHandling)} />
          </Field>
          {showErrorHandling && (
            <>
              <Field label="Alert state if no data or all values are null">
                <InputControl
                  as={GrafanaAlertStatePicker}
                  name="noDataState"
                  width={42}
                  onChange={(values) => values[0]?.value}
                />
              </Field>
              <Field label="Alert state if execution error or timeout">
                <InputControl
                  as={GrafanaAlertStatePicker}
                  name="execErrState"
                  width={42}
                  onChange={(values) => values[0]?.value}
                />
              </Field>
            </>
          )}
        </>
      )}
      {type === RuleFormType.system && (
        <>
          <Field label="For" description="Expression has to be true for this long for the alert to be fired.">
            <div className={styles.flexRow}>
              <Input ref={register()} name="forTime" width={8} />
              <InputControl
                name="forTimeUnit"
                as={Select}
                options={timeOptions}
                control={control}
                width={15}
                className={styles.timeUnit}
                onChange={(values) => values[0]?.value}
              />
            </div>
          </Field>
        </>
      )}
    </RuleEditorSection>
  );
};

const getStyles = (theme: GrafanaTheme) => ({
  flexRow: css`
    display: flex;
    flex-direction: row;
    align-items: flex-end;
    justify-content: flex-start;
  `,
  numberInput: css`
    width: 200px;
    & + & {
      margin-left: ${theme.spacing.sm};
    }
  `,
  timeUnit: css`
    margin-left: ${theme.spacing.xs};
  `,
  switchField: css`
    display: inline-flex;
    flex-direction: row-reverse;
    margin-top: ${theme.spacing.md};
    & > div:first-child {
      margin-left: ${theme.spacing.sm};
    }
  `,
});
