import { t } from '@grafana/i18n';
import { Button, Stack } from '@grafana/ui';

export interface WizardButtonBarProps {
  previousText: string;
  nextText: string;
  isPreviousDisabled: boolean;
  isNextDisabled: boolean;
  isSubmitting: boolean;
  onPrevious: () => void;
}

export function WizardButtonBar({
  previousText,
  nextText,
  isPreviousDisabled,
  isNextDisabled,
  isSubmitting,
  onPrevious,
}: WizardButtonBarProps) {
  return (
    <Stack gap={2} justifyContent="flex-end">
      <Button variant="secondary" onClick={onPrevious} disabled={isPreviousDisabled}>
        {previousText}
      </Button>
      <Button type="submit" disabled={isNextDisabled}>
        {isSubmitting ? t('provisioning.wizard-content.button-submitting', 'Submitting...') : nextText}
      </Button>
    </Stack>
  );
}
