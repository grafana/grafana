import React, { FC, useMemo } from 'react';

import { useStyles } from '@grafana/ui';
import { LinkTooltip } from 'app/percona/shared/components/Elements/LinkTooltip/LinkTooltip';
import { TextInputField } from 'app/percona/shared/components/Form/TextInput';
import { TextareaInputField } from 'app/percona/shared/components/Form/TextareaInput';
import Validators from 'app/percona/shared/helpers/validators';

import { Messages } from '../FormParts.messages';
import { getStyles } from '../FormParts.styles';

export const LabelsFormPart: FC = () => {
  const styles = useStyles(getStyles);
  const customLabelsValidators = useMemo(() => [Validators.validateKeyValue], []);

  return (
    <div className={styles.groupWrapper}>
      <h4 className={styles.sectionHeader}>{Messages.form.titles.labels}</h4>
      <TextInputField
        name="environment"
        label={Messages.form.labels.labels.environment}
        placeholder={Messages.form.placeholders.labels.environment}
      />
      <div className={styles.labelWrapper} data-testid="username-label">
        <span>{Messages.form.labels.labels.region}</span>
        <LinkTooltip tooltipContent={Messages.form.tooltips.labels.region} icon="info-circle" />
      </div>
      <TextInputField name="region" placeholder={Messages.form.placeholders.labels.region} />
      <div className={styles.labelWrapper} data-testid="username-label">
        <span>{Messages.form.labels.labels.az}</span>
        <LinkTooltip tooltipContent={Messages.form.tooltips.labels.az} icon="info-circle" />
      </div>
      <TextInputField name="az" placeholder={Messages.form.placeholders.labels.az} />
      <TextInputField
        name="replication_set"
        label={Messages.form.labels.labels.replicationSet}
        placeholder={Messages.form.placeholders.labels.replicationSet}
      />
      <TextInputField
        name="cluster"
        label={Messages.form.labels.labels.cluster}
        placeholder={Messages.form.placeholders.labels.cluster}
      />
      <TextareaInputField
        name="custom_labels"
        label={Messages.form.labels.labels.customLabels}
        placeholder={Messages.form.placeholders.labels.customLabels}
        validators={customLabelsValidators}
      />
    </div>
  );
};
