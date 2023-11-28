import React, { FC } from 'react';

import { Badge, useStyles2 } from '@grafana/ui';
import { ServiceStatus } from 'app/percona/shared/services/services/Services.types';

import {
  getBadgeColorForServiceStatus,
  getBadgeIconForServiceStatus,
  getBadgeTextForServiceStatus,
} from '../../Tabs/Services.utils';

import { Messages } from './StatusInfo.messages';
import { getStyles } from './StatusInfo.styles';

export const StatusInfo: FC<React.PropsWithChildren<unknown>> = () => {
  const styles = useStyles2(getStyles);

  return (
    <>
      {[ServiceStatus.UP, ServiceStatus.DOWN, ServiceStatus.UNKNOWN, ServiceStatus.NA].map((status) => (
        <div className={styles.statusLine} key={status}>
          <Badge
            text={getBadgeTextForServiceStatus(status)}
            color={getBadgeColorForServiceStatus(status)}
            icon={getBadgeIconForServiceStatus(status)}
          />
          {Messages[status]}
        </div>
      ))}
    </>
  );
};
