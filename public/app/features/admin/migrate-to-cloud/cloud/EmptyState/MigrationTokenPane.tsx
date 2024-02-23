import React from 'react';

import { Box, Button, Text } from '@grafana/ui';
import { t, Trans } from 'app/core/internationalization';

import { InfoItem } from '../../shared/InfoItem';

export const MigrationTokenPane = () => {
  const onGenerateToken = () => {
    console.log('TODO: generate token!');
  };
  const tokenStatus = 'TODO';

  return (
    <Box display="flex" alignItems="flex-start" padding={2} gap={2} direction="column" backgroundColor="secondary">
      <InfoItem title={t('migrate-to-cloud.migration-token.title', 'Migration token')}>
        <Trans i18nKey="migrate-to-cloud.migration-token.body">
          Your self-managed Grafana instance will require a special authentication token to securely connect to this
          cloud stack.
        </Trans>
      </InfoItem>
      <Text color="secondary">
        <Trans i18nKey="migrate-to-cloud.migration-token.status">Current status: {{ tokenStatus }}</Trans>
      </Text>
      <Button onClick={onGenerateToken}>
        <Trans i18nKey="migrate-to-cloud.migration-token.generate-button">Generate a migration token</Trans>
      </Button>
    </Box>
  );
};
