import React, { FC, useState } from 'react';

import { Collapse, useStyles } from '@grafana/ui';

import { ContainerLogs } from '../ContainerLogs/ContainerLogs';

import { Messages } from './PodLogs.messages';
import { getStyles } from './PodLogs.styles';
import { PodLogsProps } from './PodLogs.types';

export const PodLogs: FC<React.PropsWithChildren<PodLogsProps>> = ({ podLogs }) => {
  const styles = useStyles(getStyles);
  const { name, isOpen: isPodOpen, containers, events } = podLogs;
  const [isOpen, setIsOpen] = useState(isPodOpen);

  return (
    <div data-testid="dbcluster-pod-logs">
      <Collapse collapsible label={name} isOpen={isOpen} onToggle={() => setIsOpen(!isOpen)}>
        <span className={styles.label}>{Messages.events}</span>
        <pre data-testid="dbcluster-pod-events" className={styles.labelSpacing}>
          {events}
        </pre>
        <span className={styles.label}>{Messages.containers}</span>
        <div data-testid="dbcluster-containers" className={styles.labelSpacing}>
          {containers.map((container) => (
            <ContainerLogs key={`${container.name}${container.isOpen}`} containerLogs={container} />
          ))}
        </div>
      </Collapse>
    </div>
  );
};
