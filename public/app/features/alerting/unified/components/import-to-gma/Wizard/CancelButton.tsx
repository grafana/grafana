import { useFormContext } from 'react-hook-form';

import { t } from '@grafana/i18n';
import { Button } from '@grafana/ui';

import { RelativeUrl } from '../../../utils/url';

import { useCancelWizardModal } from './useCancelWizardModal';

interface CancelButtonProps {
  /** Custom redirect URL when canceling */
  redirectUrl?: RelativeUrl;
  /** Callback fired when the user confirms cancellation */
  onCancel?: () => void;
}

/**
 * CancelButton - button to exit the wizard without completing
 */
export function CancelButton({ redirectUrl = '/alerting/list', onCancel }: CancelButtonProps) {
  const { formState } = useFormContext();
  const [CancelModal, handleCancel] = useCancelWizardModal({
    redirectUrl,
    isDirty: formState.isDirty,
    onCancel,
  });

  return (
    <>
      <Button variant="secondary" fill="text" onClick={handleCancel} data-testid="wizard-cancel-button">
        {t('alerting.import-to-gma.wizard.cancel', 'Cancel')}
      </Button>
      {CancelModal}
    </>
  );
}
