/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/consistent-type-assertions */
import React, { FC, useState } from 'react';
import { Field, FormRenderProps } from 'react-final-form';

import { FieldSet, Switch, useStyles } from '@grafana/ui';
import { NumberInputField } from 'app/percona/shared/components/Form/NumberInput';
import { validators as customValidators } from 'app/percona/shared/helpers/validators';
import { validators } from 'app/percona/shared/helpers/validatorsForm';

import { useSelector } from '../../../../../../types';
import { MAX_RETENTION, MIN_RETENTION } from '../../../../../backup/components/AddBackupPage/AddBackupPage.constants';
import { ScheduleSectionFields } from '../../../../../backup/components/AddBackupPage/ScheduleSection/ScheduleSectionFields/ScheduleSectionFields';
import { SelectField } from '../../../../../shared/components/Form/SelectField';
import { getBackupLocations } from '../../../../../shared/core/selectors';
import { AddDBClusterFormValues } from '../EditDBClusterPage.types';

import { Messages } from '././DBaaSBackups.messages';
import { getStyles } from './DBaaSBackups.styles';
import { DBaaSBackupFields } from './DBaaSBackups.types';

export const DBaaSBackups: FC<FormRenderProps> = ({ values }) => {
  const styles = useStyles(getStyles);
  const [enableBackups, setEnableBackups] = useState(false);

  const { result: locations = [], loading: locationsLoading } = useSelector(getBackupLocations);
  const locationsOptions = locations.map((location) => ({
    label: location.name,
    value: location.locationID,
  }));

  return (
    <FieldSet
      label={
        <div className={styles.fieldSetLabel}>
          <div>{Messages.labels.enableBackups}</div>
          <div className={styles.fieldSetSwitch}>
            <Field name="enableBackups" type="checkbox">
              {({ input }) => (
                <Switch
                  onClick={() => setEnableBackups((prevState) => !prevState)}
                  data-testid="toggle-scheduled-backup"
                  {...input}
                  checked={undefined}
                />
              )}
            </Field>
          </div>
        </div>
      }
      data-testid="dbaas-backups"
    >
      {enableBackups ? (
        <>
          <FieldSet className={styles.childFildSet} label={Messages.fieldSets.backupInfo}>
            <div className={styles.line}>
              <Field name={DBaaSBackupFields.location} validate={validators.required}>
                {({ input }) => (
                  <div data-testid="location-select-wrapper">
                    <SelectField
                      label={Messages.labels.location}
                      placeholder={Messages.placeholders.location}
                      isSearchable={false}
                      options={locationsOptions}
                      isLoading={locationsLoading}
                      {...input}
                    />
                  </div>
                )}
              </Field>
              <NumberInputField
                name={DBaaSBackupFields.retention}
                label={Messages.labels.retention}
                defaultValue={7}
                validators={[validators.required, customValidators.range(MIN_RETENTION, MAX_RETENTION)]}
              />
            </div>
          </FieldSet>
          <FieldSet className={styles.childFildSet} label={Messages.fieldSets.schedule}>
            <ScheduleSectionFields values={values as AddDBClusterFormValues} />
          </FieldSet>
        </>
      ) : (
        <div />
      )}
    </FieldSet>
  );
};

export default DBaaSBackups;
