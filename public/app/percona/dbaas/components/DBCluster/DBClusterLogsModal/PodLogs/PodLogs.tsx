import React, { FC, useState } from 'react';
import { Collapse, useStyles } from '@grafana/ui';
import { PodLogsProps } from './PodLogs.types';
import { Messages } from './PodLogs.messages';
import { ContainerLogs } from '../ContainerLogs/ContainerLogs';
import { getStyles } from './PodLogs.styles';

export const PodLogs: FC<PodLogsProps> = ({ podLogs }) => {
  const styles = useStyles(getStyles);
  const { name, isOpen: isPodOpen, containers, events } = podLogs;
  const [isOpen, setIsOpen] = useState(isPodOpen);

  return (
    <div data-qa="dbcluster-pod-logs">
      <Collapse collapsible label={name} isOpen={isOpen} onToggle={() => setIsOpen(!isOpen)}>
        <span className={styles.label}>{Messages.events}</span>
        <pre data-qa="dbcluster-pod-events" className={styles.labelSpacing}>
          {events}
        </pre>
        <span className={styles.label}>{Messages.containers}</span>
        <div data-qa="dbcluster-containers" className={styles.labelSpacing}>
          {containers.map(container => (
            <ContainerLogs key={`${container.name}${container.isOpen}`} containerLogs={container} />
          ))}
        </div>
      </Collapse>
    </div>
  );
};
