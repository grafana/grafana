import React, { FC, useMemo } from 'react';
import { Button, HorizontalGroup, useStyles } from '@grafana/ui';
import {
  CheckboxField,
  LoaderButton,
  Modal,
  NumberInputField,
  RadioButtonGroupField,
  TextareaInputField,
  TextInputField,
  validators,
} from '@percona/platform-core';
import { Field, withTypes } from 'react-final-form';
import { SelectableValue } from '@grafana/data';
import { AddBackupFormProps, AddBackupModalProps, SelectableService } from './AddBackupModal.types';
import { RetryModeSelector } from './RetryModeSelector';
import { validators as customValidators } from 'app/percona/shared/helpers/validators';
import { Messages } from './AddBackupModal.messages';
import {
  toFormBackup,
  isCronFieldDisabled,
  PERIOD_OPTIONS,
  getBackupModeOptions,
  getDataModelFromVendor,
} from './AddBackupModal.utils';
import { AddBackupModalService } from './AddBackupModal.service';
import { Databases, DATABASE_LABELS } from 'app/percona/shared/core';
import { AsyncSelectField } from 'app/percona/shared/components/Form/AsyncSelectField';
import {
  DATA_MODEL_OPTIONS,
  DAY_OPTIONS,
  HOUR_OPTIONS,
  MAX_RETENTION,
  MAX_VISIBLE_OPTIONS,
  MINUTE_OPTIONS,
  MIN_RETENTION,
  MONTH_OPTIONS,
  WEEKDAY_OPTIONS,
  MAX_BACKUP_NAME,
} from './AddBackupModal.constants';
import { getStyles } from './AddBackupModal.styles';
import { SelectField } from 'app/percona/shared/components/Form/SelectField';
import { MultiSelectField } from 'app/percona/shared/components/Form/MultiSelectField';
import { BackupMode } from '../../Backup.types';
import { BackupErrorSection } from '../BackupErrorSection/BackupErrorSection';

export const AddBackupModal: FC<AddBackupModalProps> = ({
  backup,
  isVisible,
  scheduleMode = false,
  backupErrors = [],
  onClose,
  onBackup,
}) => {
  const styles = useStyles(getStyles);
  const initialValues = useMemo(() => toFormBackup(backup), [backup]);
  const { Form } = withTypes<AddBackupFormProps>();

  const handleSubmit = (values: AddBackupFormProps) =>
    onBackup({
      ...values,
      retention: parseInt(`${values.retention}`, 10),
      retryTimes: parseInt(`${values.retryTimes}`, 10),
    });

  return (
    <Modal title={Messages.getModalTitle(scheduleMode, !!backup)} isVisible={isVisible} onClose={onClose}>
      <Form
        initialValues={initialValues}
        onSubmit={handleSubmit}
        mutators={{
          changeVendor: ([vendor]: [Databases, BackupMode], state, tools) => {
            tools.changeValue(state, 'vendor', () => vendor);
            tools.changeValue(state, 'dataModel', () => getDataModelFromVendor(vendor));
            //TODO remove this when we support incremental backups for MySQL
            if (vendor === Databases.mysql) {
              tools.changeValue(state, 'mode', () => BackupMode.SNAPSHOT);
            }
          },
        }}
        render={({ handleSubmit, valid, pristine, submitting, values, form }) => (
          <form onSubmit={handleSubmit}>
            <div className={styles.formContainer}>
              <div className={styles.formHalf}>
                <Field name="service" validate={validators.required}>
                  {({ input }) => (
                    <div>
                      <AsyncSelectField
                        label={Messages.serviceName}
                        isSearchable={false}
                        disabled={!!backup}
                        loadOptions={AddBackupModalService.loadServiceOptions}
                        defaultOptions
                        {...input}
                        onChange={(service: SelectableValue<SelectableService>) => {
                          input.onChange(service);
                          form.mutators.changeVendor(service.value!.vendor);
                        }}
                        data-testid="service-select-input"
                      />
                    </div>
                  )}
                </Field>
                <TextInputField
                  name="vendor"
                  label={Messages.vendor}
                  disabled
                  format={(vendor) => DATABASE_LABELS[vendor as Databases] || ''}
                />
              </div>
              <div className={styles.formHalf}>
                <TextInputField
                  name="backupName"
                  label={Messages.backupName}
                  validators={[validators.required, validators.maxLength(MAX_BACKUP_NAME)]}
                />
                <Field name="location" validate={validators.required}>
                  {({ input }) => (
                    <div>
                      <AsyncSelectField
                        label={Messages.location}
                        isSearchable={false}
                        disabled={!!backup}
                        loadOptions={AddBackupModalService.loadLocationOptions}
                        defaultOptions
                        {...input}
                        data-testid="location-select-input"
                      />
                    </div>
                  )}
                </Field>
              </div>
            </div>
            <RadioButtonGroupField
              disabled
              options={DATA_MODEL_OPTIONS}
              name="dataModel"
              label={Messages.dataModel}
              fullWidth
            />
            {scheduleMode && (
              <RadioButtonGroupField
                options={getBackupModeOptions(values.vendor)}
                name="mode"
                //TODO remove this when we support incremental backups for MySQL
                disabled={!!backup || values.vendor === Databases.mysql}
                label={Messages.type}
                fullWidth
              />
            )}
            {!scheduleMode && <RetryModeSelector retryMode={values.retryMode} />}
            <TextareaInputField name="description" label={Messages.description} />
            {scheduleMode && (
              <div className={styles.advancedGroup} data-testid="advanced-backup-fields">
                <h6 className={styles.advancedTitle}>{Messages.scheduleSection}</h6>
                <div>
                  <div className={styles.advancedRow}>
                    <Field name="period" validate={validators.required}>
                      {({ input }) => (
                        <div>
                          <SelectField {...input} options={PERIOD_OPTIONS} label={Messages.every} />
                        </div>
                      )}
                    </Field>
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
                            maxVisibleValues={MAX_VISIBLE_OPTIONS}
                            disabled={isCronFieldDisabled(values.period!.value!, 'month')}
                          />
                        </div>
                      )}
                    </Field>
                  </div>
                  <div className={styles.advancedRow}>
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
                          />
                        </div>
                      )}
                    </Field>
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
                          />
                        </div>
                      )}
                    </Field>
                  </div>
                  <div className={styles.advancedRow}>
                    <Field name="startHour">
                      {({ input }) => (
                        <div>
                          <MultiSelectField
                            {...input}
                            closeMenuOnSelect={false}
                            options={HOUR_OPTIONS}
                            label={Messages.startTime}
                            isClearable
                            placeholder={Messages.every}
                            maxVisibleValues={MAX_VISIBLE_OPTIONS}
                            disabled={isCronFieldDisabled(values.period!.value!, 'startHour')}
                          />
                        </div>
                      )}
                    </Field>
                    <Field name="startMinute">
                      {({ input }) => (
                        <div>
                          <MultiSelectField
                            {...input}
                            closeMenuOnSelect={false}
                            options={MINUTE_OPTIONS}
                            label="&nbsp;"
                            isClearable
                            placeholder={Messages.every}
                            maxVisibleValues={MAX_VISIBLE_OPTIONS}
                            disabled={isCronFieldDisabled(values.period!.value!, 'startMinute')}
                          />
                        </div>
                      )}
                    </Field>
                  </div>
                  <div className={styles.advancedRow}>
                    <NumberInputField
                      name="retention"
                      label={Messages.retention}
                      validators={[validators.required, customValidators.range(MIN_RETENTION, MAX_RETENTION)]}
                    />
                  </div>
                  <div className={styles.advancedRow}>
                    <RetryModeSelector retryMode={values.retryMode} />
                  </div>
                  <div className={styles.advancedRow}>
                    <CheckboxField fieldClassName={styles.checkbox} name="active" label={Messages.enabled} />
                  </div>
                </div>
              </div>
            )}
            {!!backupErrors.length && <BackupErrorSection backupErrors={backupErrors} />}
            <HorizontalGroup justify="center" spacing="md">
              <LoaderButton
                data-testid="backup-add-button"
                size="md"
                variant="primary"
                disabled={!valid || pristine}
                loading={submitting}
              >
                {Messages.getSubmitButtonText(scheduleMode, !!backup)}
              </LoaderButton>
              <Button data-testid="storage-location-cancel-button" variant="secondary" onClick={onClose}>
                {Messages.cancelAction}
              </Button>
            </HorizontalGroup>
          </form>
        )}
      />
    </Modal>
  );
};
