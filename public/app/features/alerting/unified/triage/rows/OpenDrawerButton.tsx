import { memo } from 'react';

import { Trans } from '@grafana/i18n';
import { Button } from '@grafana/ui';

interface OpenDrawerButtonProps {
  onClick: () => void;
  ['aria-label']: string;
}

export const OpenDrawerButton = memo(function OpenDrawerButton({
  onClick,
  ['aria-label']: ariaLabel,
}: OpenDrawerButtonProps) {
  return (
    <Button variant="secondary" fill="outline" size="sm" aria-label={ariaLabel} onClick={onClick}>
      <Trans i18nKey="alerting.open-drawer-icon-button.details">Details</Trans>
    </Button>
  );
});
