/* eslint-disable @typescript-eslint/consistent-type-assertions */
import { cx } from '@emotion/css';
import {
  LoaderButton,
  logger,
  Overlay,
  RadioButtonGroupField,
  TextareaInputField,
  TextInputField,
  validators,
} from '@percona/platform-core';
import React, { FC, useCallback, useEffect, useMemo, useState } from 'react';
import { Field, withTypes } from 'react-final-form';
import { useSelector } from 'react-redux';

import { AppEvents, SelectableValue } from '@grafana/data';
import { locationService } from '@grafana/runtime';
import { CollapsableSection, CustomScrollbar, LinkButton, PageToolbar, useStyles2 } from '@grafana/ui';
import appEvents from 'app/core/app_events';
import { useQueryParams } from 'app/core/hooks/useQueryParams';
import { GrafanaRouteComponentProps } from 'app/core/navigation/types';
import { AsyncSelectField } from 'app/percona/shared/components/Form/AsyncSelectField';
import { SelectField } from 'app/percona/shared/components/Form/SelectField';
import { useCancelToken } from 'app/percona/shared/components/hooks/cancelToken.hook';
import { ApiVerboseError, Databases, DATABASE_LABELS } from 'app/percona/shared/core';
import { fetchStorageLocations } from 'app/percona/shared/core/reducers/backupLocations';
import { getBackupLocations } from 'app/percona/shared/core/selectors';
import { apiErrorParser, isApiCancelError } from 'app/percona/shared/helpers/api';
import { useAppDispatch } from 'app/store/store';

import { PageSwitcher } from '../../../shared/components/PageSwitcher/PageSwitcher';
import { PageSwitcherValue } from '../../../shared/components/PageSwitcher/PageSwitcher.types';
import { BACKUP_INVENTORY_URL, BACKUP_SCHEDULED_URL } from '../../Backup.constants';
import { Messages as MessagesBackup } from '../../Backup.messages';
import { BackupService } from '../../Backup.service';
import { BackupMode, BackupType, DataModel } from '../../Backup.types';
import { BackupErrorSection } from '../BackupErrorSection/BackupErrorSection';
import { BACKUP_CANCEL_TOKEN, LIST_ARTIFACTS_CANCEL_TOKEN } from '../BackupInventory/BackupInventory.constants';
import { BackupInventoryService } from '../BackupInventory/BackupInventory.service';
import { Backup } from '../BackupInventory/BackupInventory.types';
import { LIST_SCHEDULED_BACKUPS_CANCEL_TOKEN } from '../ScheduledBackups/ScheduledBackups.constants';
import { ScheduledBackupsService } from '../ScheduledBackups/ScheduledBackups.service';
import { ScheduledBackup } from '../ScheduledBackups/ScheduledBackups.types';
import { LocationType } from '../StorageLocations/StorageLocations.types';

import { DATA_MODEL_OPTIONS, MAX_BACKUP_NAME, SCHEDULED_TYPE } from './AddBackupPage.constants';
import { Messages } from './AddBackupPage.messages';
import { AddBackupPageService } from './AddBackupPage.service';
import { getStyles } from './AddBackupPage.styles';
import { AddBackupFormProps, SelectableService } from './AddBackupPage.types';
import {
  toFormBackup,
  getBackupModeOptions,
  getDataModelFromVendor,
  isDataModelDisabled,
  getLabelForStorageOption,
} from './AddBackupPage.utils';
import { RetryModeSelector } from './RetryModeSelector';
import { ScheduleSection } from './ScheduleSection/ScheduleSection';

const AddBackupPage: FC<GrafanaRouteComponentProps<{ type: string; id: string }>> = ({ match }) => {
  const [queryParams, setQueryParams] = useQueryParams();
  const scheduleMode: boolean = (queryParams['scheduled'] as boolean) || match.params.type === SCHEDULED_TYPE;
  const [backup, setBackup] = useState<Backup | ScheduledBackup | null>(null);
  const [pending, setPending] = useState(false);
  const styles = useStyles2(getStyles);
  const dispatch = useAppDispatch();
  const [modalTitle, setModalTitle] = useState(Messages.getModalTitle(scheduleMode, !!backup));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const initialValues = useMemo(() => toFormBackup(backup, scheduleMode), [backup]);
  const { result: locations = [], loading: locationsLoading } = useSelector(getBackupLocations);
  const { Form } = withTypes<AddBackupFormProps>();

  const locationsOptions = locations.map(
    ({ locationID, name, type }): SelectableValue<string> => ({
      label: name,
      value: locationID,
      type,
      description: getLabelForStorageOption(type),
    })
  );
  const editing = !!backup;

  const [backupErrors, setBackupErrors] = useState<ApiVerboseError[]>([]);
  const [generateToken] = useCancelToken();

  const getBackupData = useCallback(async () => {
    setPending(true);

    try {
      let backups: Backup[] | ScheduledBackup[];
      let backup: Backup | ScheduledBackup | null = null;
      if (scheduleMode) {
        backups = await ScheduledBackupsService.list(generateToken(LIST_SCHEDULED_BACKUPS_CANCEL_TOKEN));
      } else {
        backups = await BackupInventoryService.list(generateToken(LIST_ARTIFACTS_CANCEL_TOKEN));
      }
      for (const value of backups) {
        if (value.id === `/${match.params.type}/${match.params.id}`) {
          backup = value;
          break;
        }
      }
      setBackup(backup ?? null);
    } catch (e) {
      if (isApiCancelError(e)) {
        return;
      }
      logger.error(e);
    }
    setPending(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onDemandChange = useCallback(() => {
    setQueryParams({ scheduled: null });
    setModalTitle(Messages.getModalTitle(false, editing));
  }, [editing, setQueryParams]);

  const onScheduledChange = useCallback(() => {
    setQueryParams({ scheduled: true });
    setModalTitle(Messages.getModalTitle(true, editing));
  }, [editing, setQueryParams]);

  const handleBackup = async (values: AddBackupFormProps) => {
    try {
      await BackupService.backup(values, generateToken(BACKUP_CANCEL_TOKEN));
      if (scheduleMode) {
        appEvents.emit(AppEvents.alertSuccess, [
          values.id
            ? MessagesBackup.scheduledBackups.getEditSuccess(values.backupName)
            : MessagesBackup.scheduledBackups.addSuccess,
        ]);
        setBackupErrors([]);
        locationService.push(BACKUP_SCHEDULED_URL);
      } else {
        appEvents.emit(AppEvents.alertSuccess, [MessagesBackup.backupInventory.addSuccess]);
        setBackupErrors([]);
        locationService.push(BACKUP_INVENTORY_URL);
      }
    } catch (e) {
      if (isApiCancelError(e)) {
        return;
      }

      setBackupErrors(apiErrorParser(e));
      logger.error(e);
    }
  };

  const handleSubmit = (values: AddBackupFormProps) => {
    handleBackup({
      ...values,
      retention: parseInt(`${values.retention}`, 10),
      retryTimes: parseInt(`${values.retryTimes}`, 10),
    });
  };

  useEffect(() => setModalTitle(Messages.getModalTitle(scheduleMode, editing)), [editing, scheduleMode]);

  useEffect(() => {
    getBackupData();
    dispatch(fetchStorageLocations());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const pageSwitcherValues: Array<PageSwitcherValue<BackupType>> = useMemo(
    () => [
      { name: 'type', value: BackupType.DEMAND, onChange: onDemandChange, label: Messages.onDemand },
      { name: 'type', value: BackupType.SCHEDULED, onChange: onScheduledChange, label: Messages.schedule },
    ],
    [onDemandChange, onScheduledChange]
  );

  return (
    <Overlay isPending={pending}>
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
          <form onSubmit={handleSubmit} className={styles.form}>
            <PageToolbar title={modalTitle} pageIcon="history">
              <LinkButton
                href={scheduleMode ? BACKUP_SCHEDULED_URL : BACKUP_INVENTORY_URL}
                data-testid="cancel-button"
                variant="secondary"
                fill="outline"
              >
                {Messages.cancelAction}
              </LinkButton>
              <LoaderButton
                data-testid="backup-add-button"
                size="md"
                type="submit"
                variant="primary"
                disabled={
                  !valid ||
                  pristine ||
                  (values.vendor === Databases.mysql && values.location?.type === LocationType.CLIENT)
                }
                loading={submitting}
              >
                {Messages.getSubmitButtonText(values.type === BackupType.SCHEDULED, editing)}
              </LoaderButton>
            </PageToolbar>
            <div className={styles.contentOuter}>
              <CustomScrollbar hideHorizontalTrack={true}>
                <div className={styles.contentInner}>
                  <div className={styles.pageWrapper}>
                    {!editing && <PageSwitcher values={pageSwitcherValues} className={styles.pageSwitcher} />}
                    <h4 className={styles.headingStyle}>{Messages.backupInfo}</h4>
                    <div className={styles.formContainer}>
                      <span className={styles.wideField}>
                        <TextInputField
                          name="backupName"
                          label={Messages.backupName}
                          validators={[validators.required, validators.maxLength(MAX_BACKUP_NAME)]}
                        />
                      </span>
                      <span className={styles.SelectFieldWrap}>
                        <Field name="service" validate={validators.required}>
                          {({ input }) => (
                            <AsyncSelectField
                              label={Messages.serviceName}
                              isSearchable={false}
                              disabled={editing}
                              loadOptions={AddBackupPageService.loadServiceOptions}
                              defaultOptions
                              {...input}
                              onChange={(service: SelectableValue<SelectableService>) => {
                                input.onChange(service);
                                form.mutators.changeVendor(service.value!.vendor);
                              }}
                              className={styles.selectField}
                              data-testid="service-select-input"
                            />
                          )}
                        </Field>
                      </span>
                      <span className={styles.radioButtonField}>
                        <RadioButtonGroupField
                          disabled={isDataModelDisabled(values)}
                          options={DATA_MODEL_OPTIONS}
                          name="dataModel"
                          label={Messages.dataModel}
                          fullWidth
                        />
                      </span>
                      <span className={styles.wideField}>
                        <TextInputField
                          name="vendor"
                          label={Messages.vendor}
                          disabled
                          format={(vendor) => DATABASE_LABELS[vendor as Databases] || ''}
                        />
                      </span>
                      <span className={cx(styles.wideField, styles.SelectFieldWrap)}>
                        <Field name="location" validate={validators.required}>
                          {({ input }) => (
                            <div>
                              <SelectField
                                label={Messages.location}
                                isSearchable={false}
                                disabled={editing}
                                options={locationsOptions}
                                isLoading={locationsLoading}
                                {...input}
                                className={styles.selectField}
                                data-testid="location-select-input"
                              />
                            </div>
                          )}
                        </Field>
                      </span>
                      {scheduleMode && (
                        <span className={styles.wideField}>
                          <TextareaInputField
                            fieldClassName={styles.textAreaField}
                            name="description"
                            label={Messages.description}
                          />
                        </span>
                      )}
                      <span className={cx(styles.radioButtonField, styles.backupTypeField)}>
                        {values.type === BackupType.SCHEDULED && (
                          <RadioButtonGroupField
                            options={getBackupModeOptions(values.vendor)}
                            name="mode"
                            //TODO remove this when we support incremental backups for MySQL
                            disabled={editing || values.vendor === Databases.mysql}
                            label={Messages.type}
                            fullWidth
                            inputProps={{
                              onInput: (e: React.ChangeEvent<HTMLInputElement>) =>
                                form.mutators.changeDataModel(e.target.labels),
                            }}
                          />
                        )}
                      </span>
                    </div>
                    <div className={styles.advanceSection}>
                      {values.type === BackupType.SCHEDULED && <ScheduleSection values={values} />}
                      <div className={styles.collapsableSection}>
                        <CollapsableSection
                          label={Messages.advanceSettings}
                          isOpen={false}
                          buttonDataTestId="add-backup-advanced-settings"
                        >
                          <RetryModeSelector retryMode={values.retryMode} />
                        </CollapsableSection>
                        {!!backupErrors.length && <BackupErrorSection backupErrors={backupErrors} />}
                      </div>
                    </div>
                  </div>
                </div>
              </CustomScrollbar>
            </div>
          </form>
        )}
      />
    </Overlay>
  );
};

export default AddBackupPage;
