import { RadioButton } from '@percona/platform-core/dist/components/RadioButtonGroup/RadioButton';
import React from 'react';
import { Field } from 'react-final-form';

import { useStyles2 } from '@grafana/ui';
import { useQueryParams } from 'app/core/hooks/useQueryParams';
import { BackupType } from 'app/percona/backup/Backup.types';

import { Messages } from '../AddBackupPage.messages';

import { getStyles } from './PageSwitcher.styles';
import { PageSwitcherProps } from './PageSwitcher.types';

export const PageSwitcher = ({ editing, setModalTitle }: PageSwitcherProps) => {
  const styles = useStyles2(getStyles);
  const [, setQueryParams] = useQueryParams();
  return (
    <div className={styles.pageSwitcherWrapper}>
      <Field name="type" component="input" type="radio" value={BackupType.DEMAND}>
        {({ input }) => (
          <RadioButton
            {...input}
            onChange={() => {
              setQueryParams({ scheduled: null });
              setModalTitle(Messages.getModalTitle(false, editing));
              input.onChange({ target: { value: input.value } });
            }}
          >
            {Messages.onDemand}
          </RadioButton>
        )}
      </Field>
      <Field name="type" component="input" type="radio" value={BackupType.SCHEDULED}>
        {({ input }) => (
          <RadioButton
            {...input}
            onChange={() => {
              setQueryParams({ scheduled: true });
              setModalTitle(Messages.getModalTitle(true, editing));
              input.onChange({ target: { value: input.value } });
            }}
          >
            {Messages.schedule}
          </RadioButton>
        )}
      </Field>
    </div>
  );
};
