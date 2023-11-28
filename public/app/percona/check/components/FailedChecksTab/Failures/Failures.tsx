/* eslint-disable @typescript-eslint/consistent-type-assertions */
import React, { FC } from 'react';

import { useStyles2 } from '@grafana/ui';
import { FailedChecksCounts } from 'app/percona/check/types';
import { Severity } from 'app/percona/integrated-alerting/components/Severity';

import { getStyles } from './Failures.styles';
import { FailuresProps } from './Failures.types';
import { failureToSeverity } from './Failures.utils';

export const Failures: FC<React.PropsWithChildren<FailuresProps>> = ({ counts }) => {
  const styles = useStyles2(getStyles);
  return (
    <ul className={styles.list}>
      {Object.keys(counts).map(
        (count) =>
          counts[count as keyof FailedChecksCounts] > 0 && (
            <li key={count} className={styles.listItem}>
              <Severity severity={failureToSeverity(count as keyof FailedChecksCounts)} />{' '}
              {counts[count as keyof FailedChecksCounts]}
            </li>
          )
      )}
    </ul>
  );
};
