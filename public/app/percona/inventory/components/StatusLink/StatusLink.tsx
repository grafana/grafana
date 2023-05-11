import React, { FC } from 'react';

import { Link, useStyles2 } from '@grafana/ui';

import { MonitoringStatus } from '../../Inventory.types';

import { getStyles } from './StatusLink.styles';
import { StatusLinkProps } from './StatusLink.types';

export const StatusLink: FC<StatusLinkProps> = ({ agentsStatus, strippedServiceId }) => {
  const link = `/inventory/services/${strippedServiceId}/agents`;
  const styles = useStyles2((theme) => getStyles(theme, agentsStatus === MonitoringStatus.OK));

  return (
    <Link href={link} className={styles.link}>
      {agentsStatus}
    </Link>
  );
};
