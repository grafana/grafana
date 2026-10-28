import { useCallback, useMemo, useState } from 'react';

import { t } from '@grafana/i18n';

import { fetchAlertManagerConfig } from '../../../api/alertmanager';
import { useIntegrationTypeSchemas } from '../../../api/integrationSchemasApi';
import { type ImportFormValues } from '../ImportToGMA';

import {
  PreviewRedactionError,
  buildSecretFieldMap,
  redactPreviewSecrets,
  reformatPreviewContent,
} from './redactPreviewSecrets';
import { formatPreviewError, usePreviewContent } from './usePreviewContent';

type NotificationsSource = Pick<
  ImportFormValues,
  'notificationsSource' | 'notificationsYamlFile' | 'notificationsDatasourceName'
>;

// `revealed` is the same document as `redacted`, re-serialized the same way but with nothing
// hidden, so toggling between them never reflows the text. null when there is nothing to reveal.
interface NotificationsPreviewContent {
  redacted: string;
  revealed: string | null;
}

const EMPTY_CONTENT: NotificationsPreviewContent = { redacted: '', revealed: null };

export function useNotificationsPreview(source: NotificationsSource, { enabled }: { enabled: boolean }) {
  const preview = usePreviewContent(EMPTY_CONTENT);
  const [isRevealed, setIsRevealed] = useState(false);

  const {
    data: schemas,
    isLoading: schemasLoading,
    error: schemasError,
  } = useIntegrationTypeSchemas({ skip: !enabled });
  const secretFieldMap = useMemo(() => buildSecretFieldMap(schemas ?? []), [schemas]);

  const { notificationsSource, notificationsYamlFile, notificationsDatasourceName } = source;

  const show = preview.show;
  const open = useCallback(() => {
    // Shown whenever the config can't be safely redacted, whether the schema fetch failed or the
    // content itself failed to parse.
    const redactionError: NotificationsPreviewContent = {
      redacted: t(
        'alerting.import-to-gma.preview.redaction-error',
        'This configuration could not be safely previewed and was not displayed.'
      ),
      revealed: null,
    };

    setIsRevealed(false);
    show(
      async () => {
        // Fail closed if schema fetch failed — don't read/fetch any raw content at all
        if (schemasError) {
          return redactionError;
        }

        let rawContent: string;
        let format: 'yaml' | 'json';
        if (notificationsSource === 'yaml' && notificationsYamlFile) {
          rawContent = await notificationsYamlFile.text();
          format = 'yaml';
        } else if (notificationsSource === 'datasource' && notificationsDatasourceName) {
          const config = await fetchAlertManagerConfig(notificationsDatasourceName);
          rawContent = JSON.stringify(config.alertmanager_config, null, 2);
          format = 'json';
        } else {
          return EMPTY_CONTENT;
        }
        return {
          redacted: redactPreviewSecrets(rawContent, format, secretFieldMap),
          revealed: reformatPreviewContent(rawContent, format),
        };
      },
      (err) =>
        err instanceof PreviewRedactionError ? redactionError : { redacted: formatPreviewError(err), revealed: null }
    );
  }, [show, notificationsSource, notificationsYamlFile, notificationsDatasourceName, schemasError, secretFieldMap]);

  const hide = preview.hide;
  const dismiss = useCallback(() => {
    setIsRevealed(false);
    hide();
  }, [hide]);

  const toggleReveal = useCallback(() => setIsRevealed((revealed) => !revealed), []);

  const { redacted, revealed } = preview.content;
  const canReveal = revealed !== null && revealed !== redacted;

  return {
    isOpen: preview.isOpen,
    isLoading: preview.isLoading,
    schemasLoading,
    content: isRevealed && revealed !== null ? revealed : redacted,
    isRevealed,
    canReveal,
    open,
    dismiss,
    toggleReveal,
  };
}
