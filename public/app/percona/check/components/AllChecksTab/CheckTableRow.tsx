import React, { FC, useState } from 'react';
import { CheckService } from 'app/percona/check/Check.service';
import { Messages } from './AllChecksTab.messages';
import { CheckTableRowProps } from './types';
import { LoaderButton } from '@percona/platform-core';
import * as styles from './CheckTableRow.styles';

export const CheckTableRow: FC<CheckTableRowProps> = ({ check, onSuccess }) => {
  const [changeCheckPending, setChangeCheckPending] = useState(false);
  const { name, summary, description, disabled } = check;

  const changeCheck = async () => {
    setChangeCheckPending(true);
    const action = disabled ? 'enable' : 'disable';

    try {
      await CheckService.changeCheck({ params: [{ name, [action]: true }] });

      onSuccess({ ...check, disabled: !disabled });
    } catch (e) {
      console.error(e);
    } finally {
      setChangeCheckPending(false);
    }
  };

  return (
    <tr key={name}>
      <td>{summary}</td>
      <td>{description}</td>
      <td>{disabled ? Messages.disabled : Messages.enabled}</td>
      <td>
        <LoaderButton
          type="button"
          size="sm"
          variant={disabled ? 'primary' : 'destructive'}
          loading={changeCheckPending}
          onClick={changeCheck}
          className={styles.changeChecksButton}
        >
          {disabled ? Messages.enable : Messages.disable}
        </LoaderButton>
      </td>
    </tr>
  );
};
