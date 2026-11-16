import { memo } from 'react';

import { t } from '@grafana/i18n';
import { Button } from '@grafana/ui';

interface OpenDrawerButtonProps {
  onClick: () => void;
  text: string;
  ['aria-label']: string;
  ['data-testid']?: string;
}

export const OpenDrawerButton = memo(function OpenDrawerButton({
  onClick,
  text = t('alerting.open-drawer-icon-button.details', 'Details'),
  ['aria-label']: ariaLabel,
  ['data-testid']: dataTestId,
}: OpenDrawerButtonProps) {
  return (
    <Button
      variant="secondary"
      fill="outline"
      size="sm"
      aria-label={ariaLabel}
      data-testid={dataTestId}
      onClick={onClick}
    >
      {text}
    </Button>
  );
});
