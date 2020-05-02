import React, { ButtonHTMLAttributes } from 'react';
import { IconButton } from '@grafana/ui';
import { selectors } from '@grafana/e2e-selectors';

export interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  surface: 'dashboard' | 'panel' | 'header';
}

export const BackButton: React.FC<Props> = ({ surface, onClick }) => {
  return (
    <IconButton
      name="arrow-left"
      tooltip="Go back (Esc)"
      tooltipPlacement="bottom"
      size="xxl"
      surface={surface}
      aria-label={selectors.components.BackButton.backArrow}
      onClick={onClick}
    />
  );
};

BackButton.displayName = 'BackButton';
