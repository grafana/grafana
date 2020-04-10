import { IconName, IconButton } from '@grafana/ui';
import React from 'react';

interface QueryOperationActionProps {
  icon: IconName;
  title?: string;
  onClick: (e: React.MouseEvent) => void;
  disabled?: boolean;
}

export const QueryOperationAction: React.FC<QueryOperationActionProps> = ({ icon, disabled, title, ...otherProps }) => {
  const onClick = (e: React.MouseEvent) => {
    if (!disabled) {
      otherProps.onClick(e);
    }
  };
  return (
    <div title={title}>
      <IconButton name={icon} disabled={!!disabled} onClick={onClick} aria-label={`${title} query operation action`} />
    </div>
  );
};

QueryOperationAction.displayName = 'QueryOperationAction';
