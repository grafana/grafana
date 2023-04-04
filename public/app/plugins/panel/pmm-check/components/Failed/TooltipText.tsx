import React, { FC } from 'react';

import { useStyles2 } from '@grafana/ui';
import { FailedChecksCounts } from 'app/percona/check/types';

import { getStyles } from './Failed.styles';
import { Messages } from './TooltipText.messages';

interface TooltipTextProps {
  counts: FailedChecksCounts;
}

export const TooltipText: FC<TooltipTextProps> = ({
  counts: { emergency, critical, alert, error, warning, debug, info, notice },
}) => {
  const styles = useStyles2(getStyles);
  const sum = emergency + critical + alert + error + warning + debug + info + notice;

  if (!sum) {
    return null;
  }

  return (
    <div className={styles.TooltipWrapper}>
      <div className={styles.TooltipHeader}>
        {Messages.failedChecks}&nbsp;{sum}
      </div>
      <div className={styles.TooltipBody} data-testid="checks-tooltip-body">
        <div>
          {Messages.emergency} &ndash;&nbsp;{emergency}
        </div>
        <div>
          {Messages.alert} &ndash;&nbsp;{alert}
        </div>
        <div>
          {Messages.critical} &ndash;&nbsp;{critical}
        </div>
        <div>
          {Messages.error} &ndash;&nbsp;{error}
        </div>
        <div>
          {Messages.warning} &ndash;&nbsp;{warning}
        </div>
        <div>
          {Messages.notice} &ndash;&nbsp;{notice}
        </div>
        <div>
          {Messages.info} &ndash;&nbsp;{info}
        </div>
        <div>
          {Messages.debug} &ndash;&nbsp;{debug}
        </div>
      </div>
    </div>
  );
};
