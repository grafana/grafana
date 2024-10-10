import { Button, Modal, Stack, Text } from '@grafana/ui';
import { Trans, t } from 'app/core/internationalization';

import { prettyTypeName } from './TypeCell';
import { ResourceTableItem } from './types';

interface ResourceDetailsModalProps {
  resource: ResourceTableItem | undefined;
  onClose: () => void;
}

const resourceErrorMessage: { [key: string]: string } = {
  DATASOURCE_NAME_CONFLICT: t('migrate-to-cloud.resource-details.error-messages.datasource-name-conflict', ''),
  DASHBOARD_ALREADY_MANAGED: t('migrate-to-cloud.resource-details.error-messages.dashboard-already-managed', ''),
  LIBRARY_ELEMENT_NAME_CONFLICT: t(
    'migrate-to-cloud.resource-details.error-messages.library-element-name-conflict',
    ''
  ),
  UNSUPPORTED_DATA_TYPE: t('migrate-to-cloud.resource-details.error-messages.unsupported-data-type', ''),
  RESOURCE_CONFLICT: t('migrate-to-cloud.resource-details.error-messages.resource-conflict', ''),
  UNEXPECTED_STATUS_CODE: t('migrate-to-cloud.resource-details.error-messages.unexpected-error', ''),
  ONLY_CORE_DATA_SOURCES: t('migrate-to-cloud.resource-details.error-messages.only-core-data-sources', ''),
  INTERNAL_SERVICE_ERROR: t('migrate-to-cloud.resource-details.error-messages.unexpected-error', ''),
  GENERIC_ERROR: t('migrate-to-cloud.resource-details.error-messages.generic-error', ''),
  // Other error codes should be added here
};

export function ResourceDetailsModal(props: ResourceDetailsModalProps) {
  const { resource, onClose } = props;

  const refId = resource?.refId;
  const typeName = resource && prettyTypeName(resource.type);
  const hasError = resource?.errorCode || resource?.message;

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

          {hasError ? (
            <>
              <Text element="p">{msgTitle}</Text>

              <Text element="p" weight="bold">
                <Trans i18nKey={resourceErrorMessage[resource.errorCode || '']}>
                  {/* {resource.message ||
                  'There has been an error while migrating. Please check the cloud migration logs for more information.'} */}
                </Trans>
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
