import { Button, Modal, Stack, Text } from '@grafana/ui';
import { Trans, t } from 'app/core/internationalization';

import { MigrateDataResponseItemDto } from '../api';

import { prettyTypeName } from './TypeCell';
import { ResourceTableItem } from './types';

interface ResourceDetailsModalProps {
  resource: ResourceTableItem | undefined;
  onClose: () => void;
}

function getTMessage(errorCode: MigrateDataResponseItemDto['errorCode']): string {
  switch (errorCode) {
    case 'DATASOURCE_NAME_CONFLICT':
      return t(
        'migrate-to-cloud.resource-details.error-messages.datasource-name-conflict',
        'There is a data source with the same name in the target instance. Rename one of them and try again.'
      );
    case 'DATASOURCE_INVALID_URL':
      return t(
        'migrate-to-cloud.resource-details.error-messages.datasource-invalid-url',
        'There is a data source which has an invalid URL. Provide a valid URL and try again.'
      );
    case 'DATASOURCE_ALREADY_MANAGED':
      return t(
        'migrate-to-cloud.resource-details.error-messages.datasource-already-managed',
        'Data source is already provisioned and managed by Grafana in the cloud instance. If this is a different resource, set another UID and try again.'
      );
    case 'FOLDER_NAME_CONFLICT':
      return t(
        'migrate-to-cloud.resource-details.error-messages.folder-name-conflict',
        'There is a folder with the same name in the target instance. Rename one of them and try again.'
      );
    case 'DASHBOARD_ALREADY_MANAGED':
      return t(
        'migrate-to-cloud.resource-details.error-messages.dashboard-already-managed',
        'Dashboard is already provisioned and managed by Grafana in the cloud instance. We recommend using the provisioned dashboard going forward. If you still wish to copy the dashboard to the cloud instance, then change the dashboard ID in the dashboard JSON, save a new snapshot and upload again.'
      );
    case 'LIBRARY_ELEMENT_NAME_CONFLICT':
      return t(
        'migrate-to-cloud.resource-details.error-messages.library-element-name-conflict',
        'There is a library element with the same name in the target instance. Rename one of them and try again.'
      );
    case 'UNSUPPORTED_DATA_TYPE':
      return t(
        'migrate-to-cloud.resource-details.error-messages.unsupported-data-type',
        'Migration of this data type is not currently supported.'
      );
    case 'RESOURCE_CONFLICT':
      return t(
        'migrate-to-cloud.resource-details.error-messages.resource-conflict',
        'There is a resource conflict with the target instance. Please check the Grafana server logs for more details.'
      );
    case 'ONLY_CORE_DATA_SOURCES':
      return t(
        'migrate-to-cloud.resource-details.error-messages.only-core-data-sources',
        'Only core data sources are supported. Please ensure the plugin is installed on the cloud stack.'
      );
    case 'UNEXPECTED_STATUS_CODE':
      return t(
        'migrate-to-cloud.resource-details.error-messages.unexpected-error',
        'There has been an error while migrating. Please check the Grafana server logs for more details.'
      );
    case 'INTERNAL_SERVICE_ERROR':
      return t(
        'migrate-to-cloud.resource-details.error-messages.internal-service-error',
        'There has been an error while migrating. Please check the Grafana server logs for more details.'
      );
    case 'GENERIC_ERROR':
      return t(
        'migrate-to-cloud.resource-details.error-messages.generic-error',
        'There has been an error while migrating. Please check the cloud migration logs for more information.'
      );
    // Handle new errors here
    default:
      return '';
  }
}

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
              <Text element="p">
                {getTMessage(resource?.errorCode) ||
                  resource?.message ||
                  'There has been an error while migrating. Please check the cloud migration logs for more information.'}
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
