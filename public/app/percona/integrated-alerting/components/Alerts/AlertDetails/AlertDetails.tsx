import React, { FC } from 'react';

import { useStyles2 } from '@grafana/ui';
import { AlertLabels } from 'app/features/alerting/unified/components/AlertLabels';

import { Messages } from './AlertDetails.messages';
import { getStyles } from './AlertDetails.styles';
import { AlertDetailsProps } from './AlertDetails.types';

export const AlertDetails: FC<React.PropsWithChildren<AlertDetailsProps>> = ({ labels }) => {
  const styles = useStyles2(getStyles);

  return (
    <div data-testid="alert-details-wrapper" className={styles.wrapper}>
      <span>{Messages.labels}</span>
      <AlertLabels labels={labels} />
    </div>
  );
};
