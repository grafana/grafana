import React, { FC, useMemo } from 'react';

import { useStyles2 } from '@grafana/ui';
import { TextInputField } from 'app/percona/shared/components/Form/TextInput';
import { TextareaInputField } from 'app/percona/shared/components/Form/TextareaInput';
import Validators from 'app/percona/shared/helpers/validators';

import { Messages } from '../FormParts.messages';
import { getStyles } from '../FormParts.styles';

import { LabelsProps } from './Labels.types';

export const LabelsFormPart: FC<LabelsProps> = ({ showNodeFields = true }) => {
  const styles = useStyles2(getStyles);
  const customLabelsValidators = useMemo(() => [Validators.validateKeyValue], []);

  return (
    <div className={styles.groupWrapper}>
      <h4 className={styles.sectionHeader}>{Messages.form.titles.labels}</h4>
      <p>
        {Messages.form.descriptions.labels}
        {/* todo: add back in when documentation is available  */}
        {/* {Messages.form.descriptions.labelsRoles}
        <a className={styles.link}>{Messages.form.descriptions.labelsRolesLink}</a> */}
        {Messages.form.descriptions.dot}
        {Messages.form.descriptions.labelsExisting}
      </p>
      <div className={styles.group}>
        <TextInputField
          name="environment"
          label={Messages.form.labels.labels.environment}
          placeholder={Messages.form.placeholders.labels.environment}
        />
        <TextInputField
          name="cluster"
          label={Messages.form.labels.labels.cluster}
          placeholder={Messages.form.placeholders.labels.cluster}
        />
      </div>
      <div className={styles.group}>
        <TextInputField
          name="replication_set"
          label={Messages.form.labels.labels.replicationSet}
          placeholder={Messages.form.placeholders.labels.replicationSet}
        />
        {showNodeFields ? (
          <TextInputField
            name="region"
            placeholder={Messages.form.placeholders.labels.region}
            label={Messages.form.labels.labels.region}
            tooltipText={Messages.form.tooltips.labels.region}
          />
        ) : (
          <div />
        )}
      </div>
      {showNodeFields && (
        <div className={styles.group}>
          <TextInputField
            name="az"
            placeholder={Messages.form.placeholders.labels.az}
            label={Messages.form.labels.labels.az}
            tooltipText={Messages.form.tooltips.labels.az}
          />
          <div />
        </div>
      )}
      <div className={styles.group}>
        <TextareaInputField
          name="custom_labels"
          label={
            <div>
              <label htmlFor="input-custom_labels-id">{Messages.form.labels.labels.customLabels}</label>
              <p className={styles.description}>{Messages.form.descriptions.customLabels}</p>
            </div>
          }
          placeholder={Messages.form.placeholders.labels.customLabels}
          validators={customLabelsValidators}
        />
        <div />
      </div>
    </div>
  );
};
