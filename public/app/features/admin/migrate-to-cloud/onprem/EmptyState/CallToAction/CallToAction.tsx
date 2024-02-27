import React from 'react';

import { Box, Button, ModalsController, Text } from '@grafana/ui';
import { Trans } from 'app/core/internationalization';

import { ConnectModal } from './ConnectModal';

export const CallToAction = () => {
  const onClickMigrate = () => {
    console.log('TODO migration!');
  };

  return (
    <ModalsController>
      {({ showModal, hideModal }) => (
        <Box display="flex" padding={5} gap={2} direction="column" alignItems="center" backgroundColor="secondary">
          <Text variant="h3" textAlignment="center">
            <Trans i18nKey="migrate-to-cloud.cta.header">Let us manage your Grafana stack</Trans>
          </Text>
          <Button
            onClick={() =>
              showModal(ConnectModal, {
                hideModal,
                onConfirm: onClickMigrate,
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
