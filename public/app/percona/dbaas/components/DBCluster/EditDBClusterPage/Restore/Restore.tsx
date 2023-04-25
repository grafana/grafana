import { AsyncSelectField, validators } from '@percona/platform-core';
import React, { FC, useState, useEffect } from 'react';
import { Field } from 'react-final-form';

import { FieldSet, useStyles, Switch } from '@grafana/ui';
import { fetchBackupArtifacts } from 'app/percona/shared/core/reducers/backups/backupArtifacts';
import { useDispatch, useSelector } from 'app/types';

import { SelectField } from '../../../../../shared/components/Form/SelectField';
import { getBackupLocations, getBackupArtifacts } from '../../../../../shared/core/selectors';

import { Messages } from './Restore.messages';
import { RestoreService } from './Restore.service';
import { getStyles } from './Restore.styles';
import { RestoreFields, RestoreFromProps } from './Restore.types';

export const Restore: FC<RestoreFromProps> = ({ form }) => {
  const styles = useStyles(getStyles);

  const dispatch = useDispatch();

  const [enableRestore, setEnableRestore] = useState(false);
  const { result: locations = [], loading: locationsLoading } = useSelector(getBackupLocations);
  const locationsOptions = locations.map((location) => ({
    label: location.name,
    value: location.locationID,
  }));

  const { result: backupArtifacts = [], loading: backupArtifactsLoading } = useSelector(getBackupArtifacts);

  const { restoreFrom, kubernetesCluster } = form.getState().values;
  const restoreFromValue = restoreFrom?.value;

  useEffect(() => {
    if (restoreFromValue && enableRestore) {
      dispatch(fetchBackupArtifacts({ locationId: restoreFromValue }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restoreFromValue, enableRestore]);

  return (
    <FieldSet
      label={
        <div className={styles.fieldSetLabel}>
          <div>{Messages.labels.enableRestore}</div>
          <div className={styles.fieldSetSwitch}>
            <Field name="enableRestore" type="checkbox">
              {({ input }) => (
                <Switch
                  onClick={() => setEnableRestore((prevState) => !prevState)}
                  data-testid="toggle-scheduled-restore"
                  {...input}
                  checked={undefined}
                />
              )}
            </Field>
          </div>
        </div>
      }
      data-testid="restore"
    >
      {enableRestore ? (
        <div>
          <div className={styles.line}>
            <Field name={RestoreFields.restoreFrom} validate={validators.required}>
              {({ input }) => (
                <div data-testid="locations-select-wrapper">
                  <SelectField
                    label={Messages.labels.restoreFrom}
                    isSearchable={false}
                    options={locationsOptions}
                    isLoading={locationsLoading}
                    {...input}
                  />
                </div>
              )}
            </Field>
            {restoreFromValue !== undefined && restoreFromValue ? (
              <Field name={RestoreFields.backupArtifact} validate={validators.required}>
                {({ input }) => (
                  <div data-testid="backup-select-wrapper">
                    <SelectField
                      label={Messages.labels.backupArtifact}
                      isSearchable={false}
                      options={backupArtifacts}
                      isLoading={backupArtifactsLoading}
                      {...input}
                    />
                  </div>
                )}
              </Field>
            ) : (
              <div />
            )}
          </div>
          {kubernetesCluster?.value && (
            <div className={styles.line}>
              <AsyncSelectField
                name={RestoreFields.secretsName}
                loadOptions={() => RestoreService.loadSecretsNames(kubernetesCluster?.value)}
                defaultOptions
                placeholder={Messages.placeholders.secretsName}
                label={Messages.labels.secretsName}
                validate={validators.required}
                tooltipIcon="info-circle"
                tooltipText={Messages.tooltips.secretsName}
                fieldClassName={styles.asyncSelect}
              />
              <div />
            </div>
          )}
        </div>
      ) : (
        <div />
      )}
    </FieldSet>
  );
};

export default Restore;
