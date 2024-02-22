import React from 'react';

import { Box, Button, Stack, Text } from '@grafana/ui';
import { Trans } from 'app/core/internationalization';

export const CallToAction = () => {
  const onClickMigrate = () => {
    console.log('TODO migration!');
  };

  return (
    <Box padding={5} backgroundColor="secondary">
      <Stack gap={2} direction="column" alignItems="center">
        <Text variant="h3" textAlignment="center">
          <Trans i18nKey="migrate-to-cloud.cta.header">Let us manage your Grafana stack</Trans>
        </Text>
        <Button onClick={onClickMigrate}>
          <Trans i18nKey="migrate-to-cloud.cta.button">Migrate this instance to Cloud</Trans>
        </Button>
      </Stack>
    </Box>
  );
};
