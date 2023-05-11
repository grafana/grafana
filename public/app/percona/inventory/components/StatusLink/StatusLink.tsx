import React, { FC } from 'react';

import { Link, useStyles2 } from '@grafana/ui';

import { ServiceAgentStatus } from '../../Inventory.types';

import { getStyles } from './StatusLink.styles';
import { StatusLinkProps } from './StatusLink.types';

export const StatusLink: FC<StatusLinkProps> = ({ agents, type, strippedId }) => {
  const allAgentsOk = agents.every(
    (agent) =>
      agent.status === ServiceAgentStatus.RUNNING || agent.status === ServiceAgentStatus.STARTING || !!agent.isConnected
  );
  const link = `/inventory/${type}/${strippedId}/agents`;
  const styles = useStyles2((theme) => getStyles(theme, allAgentsOk));

  return (
    <Link href={link} className={styles.link}>
      {allAgentsOk ? 'OK' : 'Failed'}
    </Link>
  );
};
