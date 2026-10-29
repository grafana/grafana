import { useState } from 'react';

import { useCreateSessionMutation } from '@grafana/api-clients/internal/rtkq/legacy/migrate-to-cloud';
import { Trans } from '@grafana/i18n';
import { Box, Button, Text, useTheme2 } from '@grafana/ui';

import { ConnectModal } from './ConnectModal';

export const CallToAction = () => {
  const [modalOpen, setModalOpen] = useState(false);
  const [createMigration, createMigrationResponse] = useCreateSessionMutation();
  const isVisualRefreshEnabled = useTheme2().flags.visualDesignRefresh;

  return (
    <>
      <Box
        display="flex"
        gap={2}
        direction="column"
        alignItems="center"
        backgroundColor={isVisualRefreshEnabled ? 'primary' : 'secondary'}
        padding={6}
        borderRadius="lg"
      >
        <Text variant="h3" textAlignment="center">
          <Trans i18nKey="migrate-to-cloud.cta.header">Let us manage your Grafana stack</Trans>
        </Text>

        <Button
          data-testid="migrate-to-cloud-connect-session-modal-button"
          disabled={createMigrationResponse.isLoading}
          variant="accent"
          size="lg"
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
