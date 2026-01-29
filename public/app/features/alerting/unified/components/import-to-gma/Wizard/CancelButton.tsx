import { t } from '@grafana/i18n';
import { LinkButton } from '@grafana/ui';

import { RelativeUrl, createRelativeUrl } from '../../../utils/url';

interface CancelButtonProps {
  /** Custom redirect URL when canceling */
  redirectUrl?: RelativeUrl;
}

/**
 * CancelButton - button to exit the wizard without completing
 */
export const CancelButton = ({ redirectUrl = '/alerting/list' }: CancelButtonProps) => {
  return (
    <LinkButton
      variant="secondary"
      fill="text"
      href={createRelativeUrl(redirectUrl)}
      data-testid="wizard-cancel-button"
    >
      {t('alerting.import-to-gma.wizard.cancel', 'Cancel')}
    </LinkButton>
  );
};
