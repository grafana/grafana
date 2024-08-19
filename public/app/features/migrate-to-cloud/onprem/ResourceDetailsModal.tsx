import { Button, Modal, Stack, Text } from '@grafana/ui';
import { Trans, t } from 'app/core/internationalization';

import { prettyTypeName } from './TypeCell';
import { ResourceTableItem } from './types';

interface ResourceDetailsModalProps {
  resource: ResourceTableItem | undefined;
  onClose: () => void;
}

export function ResourceDetailsModal(props: ResourceDetailsModalProps) {
  const { resource, onClose } = props;

  const refId = resource?.refId;
  const typeName = resource && prettyTypeName(resource.type);

  let msgTitle = t('migrate-to-cloud.resource-details.generic-title', 'Resource migration details:');
  if (resource?.status === 'ERROR') {
    msgTitle = t('migrate-to-cloud.resource-details.error-title', 'Unable to migrate this resource:');
  } else if (resource?.status === 'WARNING') {
    msgTitle = t('migrate-to-cloud.resource-details.warning-title', 'Resource migrated with a warning:');
  }

  return (
    <Modal
      title={t('migrate-to-cloud.resource-details.title', 'Migration resource details')}
      isOpen={Boolean(resource)}
      onDismiss={onClose}
    >
      {resource && (
        <Stack direction="column" gap={2} alignItems="flex-start">
          <Text element="p" weight="bold">
            <Trans i18nKey="migrate-to-cloud.resource-details.resource-summary">
              {{ refId }} ({{ typeName }})
            </Trans>
          </Text>

          {resource.message ? (
            <>
              <Text element="p">{msgTitle}</Text>

              <Text element="p" weight="bold">
                {resource.message}
              </Text>
            </>
          ) : (
            <Text element="p">
              <Trans i18nKey="migrate-to-cloud.resource-details.missing-message">No message provided.</Trans>
            </Text>
          )}

          <Button onClick={onClose}>
            <Trans i18nKey="migrate-to-cloud.resource-details.dismiss-button">OK</Trans>
          </Button>
        </Stack>
      )}
    </Modal>
  );
}
