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
            <div className={styles.firstSelectRow}>
              <SelectField {...input} options={PERIOD_OPTIONS} label={Messages.scheduledTime} />
            </div>
          )}
        </Field>
        <span
          className={isCronFieldDisabled(values.period!.value!, 'month') ? styles.displayNone : styles.multiSelectField}
        >
          <Field name="month">
            {({ input }) => (
              <div className={styles.multiselectRow} data-testid="multi-select-field-div-wrapper">
                <span className={styles.selectLabel}>{Messages.in}</span>
                <div>
                  <MultiSelectField
                    {...input}
                    closeMenuOnSelect={false}
                    options={MONTH_OPTIONS}
                    isClearable
                    label={Messages.month}
                    placeholder={Messages.everyMonth}
                    className={styles.selectField}
                    maxVisibleValues={MAX_VISIBLE_OPTIONS}
                    disabled={isCronFieldDisabled(values.period!.value!, 'month')}
                  />
                </div>
              </div>
            )}
          </Field>
        </span>
        <span
          className={isCronFieldDisabled(values.period!.value!, 'day') ? styles.displayNone : styles.multiSelectField}
        >
          <Field name="day">
            {({ input }) => (
              <div className={styles.multiselectRow}>
                <span className={styles.selectLabel}>{Messages.on}</span>
                <div>
                  <MultiSelectField
                    {...input}
                    closeMenuOnSelect={false}
                    options={DAY_OPTIONS}
                    isClearable
                    label={Messages.day}
                    placeholder={Messages.everyDay}
                    maxVisibleValues={MAX_VISIBLE_OPTIONS}
                    disabled={isCronFieldDisabled(values.period!.value!, 'day')}
                    className={styles.selectField}
                  />
                </div>
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
              <div className={styles.multiselectRow}>
                <span className={styles.selectLabel}>{Messages.on}</span>
                <div>
                  <MultiSelectField
                    {...input}
                    closeMenuOnSelect={false}
                    options={WEEKDAY_OPTIONS}
                    isClearable
                    label={Messages.weekDay}
                    placeholder={Messages.everyWeekDay}
                    maxVisibleValues={MAX_VISIBLE_OPTIONS}
                    disabled={isCronFieldDisabled(values.period!.value!, 'weekDay')}
                    className={styles.selectField}
                  />
                </div>
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
              <div className={styles.multiselectRow}>
                <span className={styles.selectLabel}>{Messages.at}</span>
                <div>
                  <MultiSelectField
                    {...input}
                    closeMenuOnSelect={false}
                    options={HOUR_OPTIONS}
                    isClearable
                    placeholder={Messages.everyHour}
                    label={Messages.hour}
                    maxVisibleValues={MAX_VISIBLE_OPTIONS}
                    disabled={isCronFieldDisabled(values.period!.value!, 'startHour')}
                    className={styles.selectField}
                  />
                </div>
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
              <div className={styles.multiselectRow}>
                <span className={styles.selectLabel}>{Messages.at}</span>
                <div>
                  <MultiSelectField
                    {...input}
                    closeMenuOnSelect={false}
                    options={MINUTE_OPTIONS}
                    isClearable
                    label={Messages.minute}
                    placeholder={Messages.everyMinute}
                    maxVisibleValues={MAX_VISIBLE_OPTIONS}
                    disabled={isCronFieldDisabled(values.period!.value!, 'startMinute')}
                    className={styles.selectField}
                  />
                </div>
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
