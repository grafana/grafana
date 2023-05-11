import React, { FC } from 'react';

import { Badge, BadgeColor, Link, useStyles2 } from '@grafana/ui';

import { ServiceAgentStatus } from '../../Inventory.types';

import { getStyles } from './StatusBadge.styles';
import { StatusBadgeProps } from './StatusBadge.types';

export const StatusBadge: FC<StatusBadgeProps> = ({ agents, strippedServiceId }) => {
  const styles = useStyles2(getStyles);

  if (!agents.length) {
    return null;
  }

  const link = `/inventory/services/${strippedServiceId}/agents`;
  const totalAgents = agents.length;
  const [good, bad] = agents.reduce(
    (acc, agent) => {
      if (
        agent.status === ServiceAgentStatus.RUNNING ||
        agent.status === ServiceAgentStatus.STARTING ||
        !!agent.isConnected
      ) {
        acc[0]++;
      } else {
        acc[1]++;
      }
      return acc;
    },
    [0, 0]
  );
  const percentageNotRunning = bad / totalAgents;
  const badgeColor: BadgeColor = percentageNotRunning === 1 ? 'red' : percentageNotRunning === 0 ? 'green' : 'orange';
  const textToShow = `${percentageNotRunning === 1 ? bad : good}/${totalAgents}`;
  const textToAppend = `${percentageNotRunning === 1 ? ' not running' : ' running'}`;

  return (
    <Badge
      color={badgeColor}
      data-testid={`status-badge-${badgeColor}`}
      text={
        <Link href={link} className={styles.anchor}>
          {textToShow}
          {textToAppend}
        </Link>
      }
    />
  );
};
