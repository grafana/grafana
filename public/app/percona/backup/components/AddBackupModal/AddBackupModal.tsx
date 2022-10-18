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
import React, { FC, useMemo } from 'react';
import { Field, withTypes } from 'react-final-form';
import { useSelector } from 'react-redux';

import { SelectableValue } from '@grafana/data';
import { Button, HorizontalGroup, useStyles } from '@grafana/ui';
import { AsyncSelectField } from 'app/percona/shared/components/Form/AsyncSelectField';
import { MultiSelectField } from 'app/percona/shared/components/Form/MultiSelectField';
import { SelectField } from 'app/percona/shared/components/Form/SelectField';
import { Databases, DATABASE_LABELS } from 'app/percona/shared/core';
import { getBackupLocations } from 'app/percona/shared/core/selectors';
import { validators as customValidators } from 'app/percona/shared/helpers/validators';

import { BackupMode, DataModel } from '../../Backup.types';
import { BackupErrorSection } from '../BackupErrorSection/BackupErrorSection';

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
import { Messages } from './AddBackupModal.messages';
import { AddBackupModalService } from './AddBackupModal.service';
import { getStyles } from './AddBackupModal.styles';
import { AddBackupFormProps, AddBackupModalProps, SelectableService } from './AddBackupModal.types';
import {
  toFormBackup,
  isCronFieldDisabled,
  PERIOD_OPTIONS,
  getBackupModeOptions,
  getDataModelFromVendor,
  isDataModelDisabled,
  getLabelForStorageOption,
} from './AddBackupModal.utils';
import { RetryModeSelector } from './RetryModeSelector';

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
  const { result: locations = [], loading: locationsLoading } = useSelector(getBackupLocations);
  const { Form } = withTypes<AddBackupFormProps>();
  const locationsOptions = locations.map(
    ({ locationID, name, type }): SelectableValue<string> => ({
      label: name,
      value: locationID,
      description: getLabelForStorageOption(type),
    })
  );

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
          changeVendor: ([vendor]: [Databases], state, tools) => {
            tools.changeValue(state, 'vendor', () => vendor);
            tools.changeValue(state, 'dataModel', () => getDataModelFromVendor(vendor));
            //TODO remove this when we support incremental backups for MySQL
            if (vendor === Databases.mysql) {
              tools.changeValue(state, 'mode', () => BackupMode.SNAPSHOT);
            }
          },
          changeDataModel: ([labels]: [NodeListOf<HTMLLabelElement> | null], state, tools) => {
            if (labels?.length) {
              const label = labels[0].textContent;

              if (label === BackupMode.PITR) {
                tools.changeValue(state, 'dataModel', () => DataModel.LOGICAL);
              }
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
                  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
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
                      <SelectField
                        label={Messages.location}
                        isSearchable={false}
                        disabled={!!backup}
                        options={locationsOptions}
                        isLoading={locationsLoading}
                        {...input}
                        data-testid="location-select-input"
                      />
                    </div>
                  )}
                </Field>
              </div>
            </div>
            <RadioButtonGroupField
              disabled={isDataModelDisabled(values)}
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
                inputProps={{
                  onInput: (e: React.ChangeEvent<HTMLInputElement>) => form.mutators.changeDataModel(e.target.labels),
                }}
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
                type="submit"
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
