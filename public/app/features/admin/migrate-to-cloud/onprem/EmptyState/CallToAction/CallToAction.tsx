import React from 'react';

import { Box, Button, ModalsController, Text } from '@grafana/ui';
import { Trans } from 'app/core/internationalization';

import { useConnectStackMutation, useGetStatusQuery } from '../../../api';

import { ConnectModal } from './ConnectModal';

export const CallToAction = () => {
  const [connectStack, connectResponse] = useConnectStackMutation();
  const { isFetching } = useGetStatusQuery();

  return (
    <ModalsController>
      {({ showModal, hideModal }) => (
        <Box display="flex" padding={5} gap={2} direction="column" alignItems="center" backgroundColor="secondary">
          <Text variant="h3" textAlignment="center">
            <Trans i18nKey="migrate-to-cloud.cta.header">Let us manage your Grafana stack</Trans>
          </Text>
          <Button
            disabled={isFetching || connectResponse.isLoading}
            onClick={() =>
              showModal(ConnectModal, {
                hideModal,
                onConfirm: connectStack,
              })
            }
          >
            <Trans i18nKey="migrate-to-cloud.cta.button">Migrate this instance to Cloud</Trans>
          </Button>
        </Box>
      )}
    </ModalsController>
  );
};
