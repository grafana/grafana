import React, { FC, useCallback, useState } from 'react';

import { IconButton, useStyles2 } from '@grafana/ui';
import { LoaderButton } from 'app/percona/shared/components/Elements/LoaderButton';

import { Messages } from '../AllChecksTab.messages';

import { getStyles } from './CheckActions.styles';
import { CheckActionsProps } from './CheckActions.types';

export const CheckActions: FC<CheckActionsProps> = ({
  check,
  onChangeCheck,
  onIntervalChangeClick,
  onIndividualRunCheckClick,
}) => {
  const styles = useStyles2(getStyles);
  const [runCheckPending, setRunCheckPending] = useState(false);
  const [intervalChangeLoading, setIntervalChangeLoading] = useState(false);

  const handleChangeCheck = useCallback(async () => {
    setIntervalChangeLoading(true);
    await onChangeCheck(check);
  }, [check, onChangeCheck]);

  const handleIntervalChangeClick = useCallback(() => onIntervalChangeClick(check), [check, onIntervalChangeClick]);
  const handleRunIndividualCheckClick = useCallback(async () => {
    setRunCheckPending(true);
    await onIndividualRunCheckClick(check);
    setRunCheckPending(false);
  }, [check, onIndividualRunCheckClick]);

  return (
    <div className={styles.actionsWrapper}>
      <LoaderButton
        variant="primary"
        disabled={!!check.disabled}
        size="sm"
        loading={runCheckPending}
        onClick={handleRunIndividualCheckClick}
        data-testid="check-table-loader-button-run"
      >
        {Messages.run}
      </LoaderButton>
      <LoaderButton
        variant={!!check.disabled ? 'primary' : 'destructive'}
        size="sm"
        loading={intervalChangeLoading}
        onClick={handleChangeCheck}
        data-testid="check-table-loader-button"
      >
        {!!check.disabled ? Messages.enable : Messages.disable}
      </LoaderButton>
      <IconButton title={Messages.changeIntervalButtonTitle} name="pen" onClick={handleIntervalChangeClick} />
    </div>
  );
};
