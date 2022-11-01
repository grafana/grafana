import { CheckboxField, NumberInputField, SelectField, validators } from '@percona/platform-core';
import React from 'react';
import { Field } from 'react-final-form';

import { useStyles2 } from '@grafana/ui';
import { MultiSelectField } from 'app/percona/shared/components/Form/MultiSelectField';
import { validators as customValidators } from 'app/percona/shared/helpers/validators';

import {
  DAY_OPTIONS,
  HOUR_OPTIONS,
  MAX_RETENTION,
  MAX_VISIBLE_OPTIONS,
  MINUTE_OPTIONS,
  MIN_RETENTION,
  MONTH_OPTIONS,
  WEEKDAY_OPTIONS,
} from '../AddBackupPage.constants';
import { Messages } from '../AddBackupPage.messages';
import { isCronFieldDisabled, PERIOD_OPTIONS } from '../AddBackupPage.utils';

import { getStyles } from './ScheduleSection.styles';
import { ScheduleSectionProps } from './ScheduleSection.type';

export const ScheduleSection = ({ values }: ScheduleSectionProps) => {
  const styles = useStyles2(getStyles);
  return (
    <div data-testid="advanced-backup-fields" className={styles.section}>
      <h4 className={styles.headingStyle}>{Messages.scheduleName}</h4>
      <h6>{Messages.scheduleSection}</h6>
      <div className={styles.scheduleSectionWrapper}>
        <Field name="period" validate={validators.required}>
          {({ input }) => (
            <div>
              <SelectField {...input} options={PERIOD_OPTIONS} label={Messages.every} />
            </div>
          )}
        </Field>
        <span
          className={isCronFieldDisabled(values.period!.value!, 'month') ? styles.displayNone : styles.multiSelectField}
        >
          <Field name="month">
            {({ input }) => (
              <div data-testid="multi-select-field-div-wrapper">
                <MultiSelectField
                  {...input}
                  closeMenuOnSelect={false}
                  options={MONTH_OPTIONS}
                  label={Messages.month}
                  isClearable
                  placeholder={Messages.every}
                  className={styles.selectField}
                  maxVisibleValues={MAX_VISIBLE_OPTIONS}
                  disabled={isCronFieldDisabled(values.period!.value!, 'month')}
                />
              </div>
            )}
          </Field>
        </span>
        <span
          className={isCronFieldDisabled(values.period!.value!, 'day') ? styles.displayNone : styles.multiSelectField}
        >
          <Field name="day">
            {({ input }) => (
              <div>
                <MultiSelectField
                  {...input}
                  closeMenuOnSelect={false}
                  options={DAY_OPTIONS}
                  label={Messages.day}
                  isClearable
                  placeholder={Messages.every}
                  maxVisibleValues={MAX_VISIBLE_OPTIONS}
                  disabled={isCronFieldDisabled(values.period!.value!, 'day')}
                  className={styles.selectField}
                />
              </div>
            )}
          </Field>
        </span>
        <span
          className={
            isCronFieldDisabled(values.period!.value!, 'weekDay') ? styles.displayNone : styles.multiSelectField
          }
        >
          <Field name="weekDay">
            {({ input }) => (
              <div>
                <MultiSelectField
                  {...input}
                  closeMenuOnSelect={false}
                  options={WEEKDAY_OPTIONS}
                  label={Messages.weekDay}
                  isClearable
                  placeholder={Messages.every}
                  maxVisibleValues={MAX_VISIBLE_OPTIONS}
                  disabled={isCronFieldDisabled(values.period!.value!, 'weekDay')}
                  className={styles.selectField}
                />
              </div>
            )}
          </Field>
        </span>
        <span
          className={
            isCronFieldDisabled(values.period!.value!, 'startHour') ? styles.displayNone : styles.multiSelectField
          }
        >
          <Field name="startHour">
            {({ input }) => (
              <div>
                <MultiSelectField
                  {...input}
                  closeMenuOnSelect={false}
                  options={HOUR_OPTIONS}
                  label={Messages.startTimeHour}
                  isClearable
                  placeholder={Messages.every}
                  maxVisibleValues={MAX_VISIBLE_OPTIONS}
                  disabled={isCronFieldDisabled(values.period!.value!, 'startHour')}
                  className={styles.selectField}
                />
              </div>
            )}
          </Field>
        </span>
        <span
          className={
            isCronFieldDisabled(values.period!.value!, 'startMinute') ? styles.displayNone : styles.multiSelectField
          }
        >
          <Field name="startMinute">
            {({ input }) => (
              <div>
                <MultiSelectField
                  {...input}
                  closeMenuOnSelect={false}
                  options={MINUTE_OPTIONS}
                  label={Messages.startTimeMinute}
                  isClearable
                  placeholder={Messages.every}
                  maxVisibleValues={MAX_VISIBLE_OPTIONS}
                  disabled={isCronFieldDisabled(values.period!.value!, 'startMinute')}
                  className={styles.selectField}
                />
              </div>
            )}
          </Field>
        </span>
      </div>
      <div className={styles.retentionField}>
        <NumberInputField
          name="retention"
          label={Messages.retention}
          validators={[validators.required, customValidators.range(MIN_RETENTION, MAX_RETENTION)]}
          className={styles.selectField}
        />
      </div>
      <CheckboxField name="active" label={Messages.enabled} />
    </div>
  );
};
