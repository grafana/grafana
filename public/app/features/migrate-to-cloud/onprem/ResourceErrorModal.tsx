import { Button, Modal, Stack, Text } from '@grafana/ui';
import { Trans, t } from 'app/core/internationalization';

import { prettyTypeName } from './TypeCell';
import { ResourceTableItem } from './types';

interface ResourceErrorModalProps {
  resource: ResourceTableItem | undefined;
  onClose: () => void;
}

export function ResourceErrorModal(props: ResourceErrorModalProps) {
  const { resource, onClose } = props;

  const refId = resource?.refId;
  const typeName = resource && prettyTypeName(resource.type);

  return (
    <Modal
      title={t('migrate-to-cloud.resource-error.title', 'Unable to migrate this resource')}
      isOpen={Boolean(resource)}
      onDismiss={onClose}
    >
      {resource && (
        <Stack direction="column" gap={2} alignItems="flex-start">
          <Text element="p" weight="bold">
            <Trans i18nKey="migrate-to-cloud.resource-error.resource-summary">
              {{ refId }} ({{ typeName }})
            </Trans>
          </Text>

          {resource.error ? (
            <>
              <Text element="p">
                <Trans i18nKey="migrate-to-cloud.resource-error.specific-error">The specific error was:</Trans>
              </Text>

              <Text element="p" weight="bold">
                {resource.error}
              </Text>
            </>
          ) : (
            <Text element="p">
              <Trans i18nKey="migrate-to-cloud.resource-error.unknown-error">An unknown error occurred.</Trans>
            </Text>
          )}

          <Button onClick={onClose}>
            <Trans i18nKey="migrate-to-cloud.resource-error.dismiss-button">OK</Trans>
          </Button>
        </Stack>
      )}
    </Modal>
  );
}
