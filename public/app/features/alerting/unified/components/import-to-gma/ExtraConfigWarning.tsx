import { t } from '@grafana/i18n';
import { Alert } from '@grafana/ui';

interface ExtraConfigWarningProps {
  existingIdentifier: string;
}

/**
 * Warning alert shown when an existing imported configuration will be replaced.
 */
export function ExtraConfigWarning({ existingIdentifier }: ExtraConfigWarningProps) {
  return (
    <Alert
      severity="warning"
      title={t('alerting.import-to-gma.step1.extra-config-overwrite-title', 'Existing configuration will be replaced')}
    >
      {t(
        'alerting.import-to-gma.step1.extra-config-overwrite-desc',
        'An imported configuration named "{{identifier}}" already exists. Importing will replace it with the new configuration.',
        { identifier: existingIdentifier }
      )}
    </Alert>
  );
}
