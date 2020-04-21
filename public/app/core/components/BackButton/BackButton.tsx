import React, { ButtonHTMLAttributes } from 'react';
import { IconButton } from '@grafana/ui';
import { e2e } from '@grafana/e2e';

export interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  surface: 'body' | 'panel';
}

export const BackButton: React.FC<Props> = ({ surface, onClick }) => {
  return (
    <IconButton
      name="arrow-left"
      tooltip="Go back (Esc)"
      tooltipPlacement="bottom"
      size="xxl"
      surface={surface}
      aria-label={e2e.components.BackButton.selectors.backArrow}
      onClick={onClick}
    />
  );
};

BackButton.displayName = 'BackButton';
