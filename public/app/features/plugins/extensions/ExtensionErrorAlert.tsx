import { t } from '@grafana/i18n';
import { Alert } from '@grafana/ui';

export const ExtensionErrorAlert = ({ pluginId, extensionTitle }: { pluginId: string; extensionTitle: string }) => {
  return (
    <Alert
      title={t(
        'plugins.extensions.extension-error-alert-title',
        'Extension failed to load: "{{pluginId}}/{{extensionTitle}}"',
        {
          pluginId,
          extensionTitle,
        }
      )}
      severity="error"
    >
      {t('plugins.extensions.extension-error-alert-description', 'Check the console for more details on the error.')}
    </Alert>
  );
};
