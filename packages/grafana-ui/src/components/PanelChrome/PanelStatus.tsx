import * as React from 'react';

import { selectors } from '@grafana/e2e-selectors';

import { Button } from '../Button/Button';

export interface Props {
  message?: string;
  onClick?: (e: React.SyntheticEvent) => void;
  ariaLabel?: string;
}

export function PanelStatus({ message, onClick, ariaLabel = 'status' }: Props) {
  return (
    <Button
      onClick={onClick}
      variant={'destructive'}
      icon="exclamation-triangle"
      size="sm"
      tooltip={message || ''}
      aria-label={ariaLabel}
      data-testid={selectors.components.Panels.Panel.status('error')}
    />
  );
}
