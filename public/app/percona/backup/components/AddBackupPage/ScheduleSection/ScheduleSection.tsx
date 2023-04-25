import React from 'react';

import { useStyles2 } from '@grafana/ui';
import { CheckboxField } from 'app/percona/shared/components/Elements/Checkbox';
import { NumberInputField } from 'app/percona/shared/components/Form/NumberInput';
import { validators as customValidators } from 'app/percona/shared/helpers/validators';
import { validators } from 'app/percona/shared/helpers/validatorsForm';

import { MAX_RETENTION, MIN_RETENTION } from '../AddBackupPage.constants';
import { Messages } from '../AddBackupPage.messages';

import { getStyles } from './ScheduleSection.styles';
import { ScheduleSectionProps } from './ScheduleSection.type';
import { ScheduleSectionFields } from './ScheduleSectionFields/ScheduleSectionFields';

export const ScheduleSection = ({ values }: ScheduleSectionProps) => {
  const styles = useStyles2(getStyles);
  return (
    <div data-testid="advanced-backup-fields" className={styles.section}>
      <h4 className={styles.headingStyle}>{Messages.scheduleName}</h4>
      <h6>{Messages.scheduleSection}</h6>
      <ScheduleSectionFields values={values} />
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
