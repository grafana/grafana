import { useNavigate } from 'react-router-dom-v5-compat';

import { t } from '@grafana/i18n';
import { Button } from '@grafana/ui';

interface CancelButtonProps {
  /** Custom redirect URL when canceling */
  redirectUrl?: string;
}

/**
 * CancelButton - button to exit the wizard without completing
 */
export const CancelButton = ({ redirectUrl = '/alerting' }: CancelButtonProps) => {
  const navigate = useNavigate();

  const handleCancel = () => {
    navigate(redirectUrl);
  };

  return (
    <Button variant="secondary" fill="text" onClick={handleCancel} data-testid="wizard-cancel-button">
      {t('alerting.migrate-to-gma.wizard.cancel', 'Cancel')}
    </Button>
  );
};
