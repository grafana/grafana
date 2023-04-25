import React from 'react';
import { Field } from 'react-final-form';

import { useStyles2 } from '@grafana/ui';
import { MultiSelectField } from 'app/percona/shared/components/Form/MultiSelectField';
import { SelectField } from 'app/percona/shared/components/Form/SelectFieldCore';
import { validators } from 'app/percona/shared/helpers/validatorsForm';

import {
  DAY_OPTIONS,
  HOUR_OPTIONS,
  MAX_VISIBLE_OPTIONS,
  MINUTE_OPTIONS,
  MONTH_OPTIONS,
  WEEKDAY_OPTIONS,
} from '../../AddBackupPage.constants';
import { isCronFieldDisabled, PERIOD_OPTIONS } from '../../AddBackupPage.utils';

import { Messages } from './ScheduleSectionFields.messages';
import { getStyles } from './ScheduleSectionFields.styles';
import {
  ScheduleSectionFields as ScheduleSectionFieldsEnum,
  ScheduleSectionFieldsProps,
} from './ScheduleSectionFields.types';

export const ScheduleSectionFields = ({ values }: ScheduleSectionFieldsProps) => {
  const styles = useStyles2(getStyles);
  return (
    <div className={styles.scheduleSectionWrapper} data-testid="shedule-section-fields-wrapper">
      <Field name="period" validate={validators.required}>
        {({ input }) => (
          <div className={styles.firstSelectRow}>
            <SelectField {...input} options={PERIOD_OPTIONS} label={Messages.scheduledTime} />
          </div>
        )}
      </Field>
      <span
        className={
          isCronFieldDisabled(values.period!.value!, ScheduleSectionFieldsEnum.month)
            ? styles.displayNone
            : styles.multiSelectField
        }
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
                  disabled={isCronFieldDisabled(values.period!.value!, ScheduleSectionFieldsEnum.month)}
                />
              </div>
            </div>
          )}
        </Field>
      </span>
      <span
        className={
          isCronFieldDisabled(values.period!.value!, ScheduleSectionFieldsEnum.day)
            ? styles.displayNone
            : styles.multiSelectField
        }
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
                  disabled={isCronFieldDisabled(values.period!.value!, ScheduleSectionFieldsEnum.day)}
                  className={styles.selectField}
                />
              </div>
            </div>
          )}
        </Field>
      </span>
      <span
        className={
          isCronFieldDisabled(values.period!.value!, ScheduleSectionFieldsEnum.weekDay)
            ? styles.displayNone
            : styles.multiSelectField
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
                  disabled={isCronFieldDisabled(values.period!.value!, ScheduleSectionFieldsEnum.weekDay)}
                  className={styles.selectField}
                />
              </div>
            </div>
          )}
        </Field>
      </span>
      <span
        className={
          isCronFieldDisabled(values.period!.value!, ScheduleSectionFieldsEnum.startHour)
            ? styles.displayNone
            : styles.multiSelectField
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
                  disabled={isCronFieldDisabled(values.period!.value!, ScheduleSectionFieldsEnum.startHour)}
                  className={styles.selectField}
                />
              </div>
            </div>
          )}
        </Field>
      </span>
      <span
        className={
          isCronFieldDisabled(values.period!.value!, ScheduleSectionFieldsEnum.startMinute)
            ? styles.displayNone
            : styles.multiSelectField
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
                  disabled={isCronFieldDisabled(values.period!.value!, ScheduleSectionFieldsEnum.startMinute)}
                  className={styles.selectField}
                />
              </div>
            </div>
          )}
        </Field>
      </span>
    </div>
  );
};
