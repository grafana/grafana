import { useState } from 'react';

import { Box, Button, Text } from '@grafana/ui';
import { Trans } from 'app/core/internationalization';

import { useCreateSessionMutation } from '../../../api';

import { ConnectModal } from './ConnectModal';

export const CallToAction = () => {
  const [modalOpen, setModalOpen] = useState(false);
  const [createMigration, createMigrationResponse] = useCreateSessionMutation();

  return (
    <>
      <Box display="flex" gap={2} direction="column" alignItems="center" backgroundColor="secondary">
        <Text variant="h3" textAlignment="center">
          <Trans i18nKey="migrate-to-cloud.cta.header">Let us manage your Grafana stack</Trans>
        </Text>

        <Button
          data-testid="migrate-to-cloud-connect-session-modal-button"
          disabled={createMigrationResponse.isLoading}
          onClick={() => setModalOpen(true)}
        >
          <Trans i18nKey="migrate-to-cloud.cta.button">Migrate this instance to Cloud</Trans>
        </Button>
      </Box>

      <ConnectModal
        isOpen={modalOpen}
        isLoading={createMigrationResponse.isLoading}
        error={createMigrationResponse.error}
        onConfirm={createMigration}
        hideModal={() => setModalOpen(false)}
      />
    </>
  );
};
