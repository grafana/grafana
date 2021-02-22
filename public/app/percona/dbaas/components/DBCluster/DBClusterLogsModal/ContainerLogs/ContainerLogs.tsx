import React, { FC, useState } from 'react';
import { Collapse } from '@grafana/ui';
import { ContainerLogsProps } from './ContainerLogs.types';

export const ContainerLogs: FC<ContainerLogsProps> = ({ containerLogs }) => {
  const { name, isOpen: isContainerOpen, logs } = containerLogs;
  const [isOpen, setIsOpen] = useState(isContainerOpen);

  return (
    <div data-qa="dbcluster-logs">
      <Collapse collapsible label={name} isOpen={isOpen} onToggle={() => setIsOpen(!isOpen)}>
        <pre>{logs}</pre>
      </Collapse>
    </div>
  );
};
