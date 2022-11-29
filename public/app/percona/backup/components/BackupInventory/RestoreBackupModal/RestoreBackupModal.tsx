import { cx } from '@emotion/css';
import { LoaderButton, Modal, RadioButtonGroupField, TextInputField, validators } from '@percona/platform-core';
import React, { FC, useCallback, useEffect, useMemo, useState } from 'react';
import { Field, withTypes } from 'react-final-form';

import { DateTime, SelectableValue, toUtc } from '@grafana/data';
import { Alert, Button, DateTimePicker, HorizontalGroup, useStyles2 } from '@grafana/ui';
import { BackupMode } from 'app/percona/backup/Backup.types';
import { AsyncSelectField } from 'app/percona/shared/components/Form/AsyncSelectField';
import { Label } from 'app/percona/shared/components/Form/Label';
import { Databases, DATABASE_LABELS } from 'app/percona/shared/core';

import { BackupErrorSection } from '../../BackupErrorSection/BackupErrorSection';
import { LocationType } from '../../StorageLocations/StorageLocations.types';
import { BackupInventoryService } from '../BackupInventory.service';
import { Timeranges } from '../BackupInventory.types';

import { Messages } from './RestoreBackupModal.messages';
import { RestoreBackupModalService } from './RestoreBackupModal.service';
import { getStyles } from './RestoreBackupModal.styles';
import { RestoreBackupFormProps, RestoreBackupModalProps, ServiceTypeSelect } from './RestoreBackupModal.types';
import {
  getHoursFromDate,
  getMinutesFromDate,
  getSecondsFromDate,
  isSameDayFromDate,
  toFormProps,
} from './RestoreBackupModal.utils';

const { Form } = withTypes<RestoreBackupFormProps>();

const serviceTypeOptions: Array<SelectableValue<ServiceTypeSelect>> = [
  {
    value: ServiceTypeSelect.SAME,
    label: 'Same service',
  },
  {
    value: ServiceTypeSelect.COMPATIBLE,
    label: 'Compatible services',
  },
];

export const RestoreBackupModal: FC<RestoreBackupModalProps> = ({
  backup,
  isVisible,
  noService = false,
  restoreErrors = [],
  onClose,
  onRestore,
  location,
}) => {
  const styles = useStyles2(getStyles);
  const initialValues = useMemo(() => (backup ? toFormProps(backup) : undefined), [backup]);

  const [selectedTimerange, setSelectedTimerange] = useState<Timeranges>();
  const [selectedTimerangeFromDatepicker, setSelectedTimerangeFromDatepicker] = useState<DateTime>();
  const [selectedDay, setSelectedDay] = useState<Date | undefined>();
  const showTimeRanges = backup?.mode === BackupMode.PITR;
  const hideRestoreForm = backup?.mode === BackupMode.PITR && location?.type === LocationType.CLIENT;

  const isSameStartDate = useMemo(() => {
    if (selectedDay && selectedTimerange) {
      return isSameDayFromDate(selectedDay, selectedTimerange.startTimestamp);
    }
    return false;
  }, [selectedDay, selectedTimerange]);

  const isSameEndDate = useMemo(() => {
    if (selectedDay && selectedTimerange) {
      return isSameDayFromDate(selectedDay, selectedTimerange.endTimestamp);
    }
    return false;
  }, [selectedDay, selectedTimerange]);

  const hoursFromStartDate = useMemo(() => {
    if (selectedDay && selectedTimerange) {
      return getHoursFromDate(selectedTimerange.startTimestamp);
    }
    return false;
  }, [selectedDay, selectedTimerange]);

  const hoursFromEndDate = useMemo(() => {
    if (selectedDay && selectedTimerange) {
      return getHoursFromDate(selectedTimerange.endTimestamp);
    }
    return false;
  }, [selectedDay, selectedTimerange]);

  const minutesFromStartDate = useMemo(() => {
    if (selectedDay && selectedTimerange) {
      return getMinutesFromDate(selectedTimerange.startTimestamp);
    }
    return false;
  }, [selectedDay, selectedTimerange]);

  const minutesFromEndDate = useMemo(() => {
    if (selectedDay && selectedTimerange) {
      return getMinutesFromDate(selectedTimerange.endTimestamp);
    }
    return false;
  }, [selectedDay, selectedTimerange]);

  const secondsFromStartDate = useMemo(() => {
    if (selectedDay && selectedTimerange) {
      return getSecondsFromDate(selectedTimerange.startTimestamp);
    }
    return false;
  }, [selectedDay, selectedTimerange]);

  const secondsFromEndDate = useMemo(() => {
    if (selectedDay && selectedTimerange) {
      return getSecondsFromDate(selectedTimerange.endTimestamp);
    }
    return false;
  }, [selectedDay, selectedTimerange]);

  const handleSubmit = ({ serviceType, service }: RestoreBackupFormProps) => {
    if (backup) {
      const serviceId = serviceType === ServiceTypeSelect.SAME ? backup.serviceId : service.value;
      if (backup.mode === BackupMode.PITR && selectedTimerangeFromDatepicker) {
        return onRestore(serviceId || '', backup.id, selectedTimerangeFromDatepicker.toISOString());
      } else {
        return onRestore(serviceId || '', backup.id);
      }
    }

    return;
  };

  const calculateDisableHours = useCallback(() => {
    const disabledHours = [];
    for (let i = 0; i < 24; i++) {
      if (isSameStartDate) {
        if (i < hoursFromStartDate) {
          disabledHours.push(i);
        }
      }
      if (isSameEndDate) {
        if (i > hoursFromEndDate) {
          disabledHours.push(i);
        }
      }
    }
    return disabledHours;
  }, [hoursFromEndDate, hoursFromStartDate, isSameEndDate, isSameStartDate]);

  const calculateDisableMinutes = useCallback(
    (hour) => {
      const disabledMinutes = [];
      for (let i = 0; i < 60; i++) {
        if (isSameStartDate && hour === hoursFromStartDate) {
          if (i < minutesFromStartDate) {
            disabledMinutes.push(i);
          }
        }
        if (isSameEndDate && hour === hoursFromEndDate) {
          if (i > minutesFromEndDate) {
            disabledMinutes.push(i);
          }
        }
      }
      return disabledMinutes;
    },
    [hoursFromEndDate, hoursFromStartDate, isSameEndDate, isSameStartDate, minutesFromEndDate, minutesFromStartDate]
  );

  const calculateDisableSeconds = useCallback(
    (hour, minute) => {
      const disabledSeconds = [];

      for (let i = 0; i < 60; i++) {
        if (isSameStartDate && hour === hoursFromStartDate && minute === minutesFromStartDate) {
          if (i < secondsFromStartDate) {
            disabledSeconds.push(i);
          }
        }
        if (isSameEndDate && hour === hoursFromEndDate && minute === minutesFromEndDate) {
          if (i > secondsFromEndDate) {
            disabledSeconds.push(i);
          }
        }
      }
      return disabledSeconds;
    },
    [
      hoursFromEndDate,
      hoursFromStartDate,
      isSameEndDate,
      isSameStartDate,
      minutesFromEndDate,
      minutesFromStartDate,
      secondsFromEndDate,
      secondsFromStartDate,
    ]
  );

  useEffect(() => {
    if (selectedTimerange && selectedDay) {
      const { startTimestamp, endTimestamp } = selectedTimerange;
      if (isSameStartDate) {
        setSelectedTimerangeFromDatepicker(toUtc(startTimestamp));
      }
      if (isSameEndDate) {
        setSelectedTimerangeFromDatepicker(toUtc(endTimestamp));
      }
    }
  }, [isSameEndDate, isSameStartDate, selectedDay, selectedTimerange]);

  useEffect(() => {
    if (selectedTimerange) {
      const { endTimestamp } = selectedTimerange;
      setSelectedDay(new Date(endTimestamp));
      setSelectedTimerangeFromDatepicker(toUtc(endTimestamp));
    }
  }, [selectedTimerange]);

  return (
    <span className={cx(styles.modalContainer, { rangeSelected: !!selectedTimerange })}>
      <Modal isVisible={isVisible} title={Messages.title} onClose={onClose}>
        {hideRestoreForm ? (
          <>
            <Alert title="" severity="info">
              {Messages.localRestoreDisabled}
            </Alert>
            <HorizontalGroup justify="center" spacing="md">
              <Button onClick={onClose}>{Messages.close}</Button>
            </HorizontalGroup>
          </>
        ) : (
          <Form
            initialValues={initialValues}
            onSubmit={handleSubmit}
            render={({ handleSubmit, valid, submitting, values }) => (
              <form onSubmit={handleSubmit}>
                <div className={styles.modalWrapper}>
                  {showTimeRanges && (
                    <>
                      <Field name="timerange" validate={validators.required}>
                        {({ input }) => (
                          <div>
                            <AsyncSelectField
                              className={styles.timeRangeSelect}
                              label={Messages.timeRange}
                              loadOptions={() => BackupInventoryService.listPitrTimeranges(backup!.id)}
                              {...input}
                              defaultOptions
                              data-testid="time-range-select-input"
                              onChange={(e) => {
                                setSelectedTimerange(e.value);
                                input.onChange(e);
                              }}
                            />
                          </div>
                        )}
                      </Field>
                    </>
                  )}
                  {selectedTimerange && (
                    <div>
                      <Label label="Timestamp" />
                      <DateTimePicker
                        date={selectedTimerangeFromDatepicker}
                        onChange={setSelectedTimerangeFromDatepicker}
                        calendarProps={{
                          minDate: new Date(selectedTimerange.startTimestamp),
                          maxDate: new Date(selectedTimerange.endTimestamp),
                          onClickDay: setSelectedDay,
                        }}
                        timepickerProps={{
                          disabledHours: calculateDisableHours,
                          disabledMinutes: calculateDisableMinutes,
                          disabledSeconds: calculateDisableSeconds,
                          hideDisabledOptions: true,
                        }}
                        inputWrapperClassName={styles.inputWrapper}
                        growInlineField
                        shrinkInlineField
                      />
                    </div>
                  )}
                  {showTimeRanges && !selectedTimerange && <div />}
                  <RadioButtonGroupField
                    className={styles.radioGroup}
                    options={serviceTypeOptions}
                    name="serviceType"
                    label={Messages.serviceSelection}
                    fullWidth
                    disabled={values.vendor !== DATABASE_LABELS[Databases.mysql]}
                  />
                  <TextInputField disabled name="vendor" label={Messages.vendor} />

                  <Field name="service" validate={validators.required}>
                    {({ input }) => (
                      <div>
                        <AsyncSelectField
                          label={Messages.serviceName}
                          disabled={values.serviceType === ServiceTypeSelect.SAME}
                          loadOptions={() => RestoreBackupModalService.loadLocationOptions(backup!.id)}
                          defaultOptions
                          {...input}
                          data-testid="service-select-input"
                        />
                      </div>
                    )}
                  </Field>

                  <TextInputField disabled name="dataModel" label={Messages.dataModel} />
                </div>
                <Alert title="" severity="warning">
                  {Messages.scheduledWarning}
                </Alert>
                {!!restoreErrors.length && <BackupErrorSection backupErrors={restoreErrors} />}
                <HorizontalGroup justify="center" spacing="md">
                  <LoaderButton
                    data-testid="restore-button"
                    size="md"
                    variant="primary"
                    disabled={!valid || (values.serviceType === ServiceTypeSelect.SAME && noService)}
                    loading={submitting}
                    type="submit"
                  >
                    {Messages.restore}
                  </LoaderButton>
                  <Button data-testid="restore-cancel-button" variant="secondary" onClick={onClose}>
                    {Messages.close}
                  </Button>
                </HorizontalGroup>
                <div className={styles.errorLine} data-testid="backup-modal-error">
                  {values.serviceType === ServiceTypeSelect.SAME && noService && Messages.noService}
                </div>
              </form>
            )}
          />
        )}
      </Modal>
    </span>
  );
};
