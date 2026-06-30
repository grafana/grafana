import * as React from 'react';

import { selectors } from '@grafana/e2e-selectors';

import { ClipboardButton } from '../ClipboardButton/ClipboardButton';

export interface Props {
  message?: string;
  onClick?: (e: React.SyntheticEvent) => void;
  ariaLabel?: string;
}

export function PanelStatus({ message, onClick, ariaLabel = 'status' }: Props) {
  return (
    <ClipboardButton
      variant={'destructive'}
      icon="exclamation-triangle"
      size="sm"
      getText={() => message || ''}
      onClick={onClick}
      tooltip={message || ''}
      aria-label={ariaLabel}
      data-testid={selectors.components.Panels.Panel.status('error')}
    />
  );
}
