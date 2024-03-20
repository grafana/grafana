import React from 'react';

import { Box, Stack, Text } from '@grafana/ui';
import { Trans } from 'app/core/internationalization';

import { GrotNotFound } from '../../core/components/GrotNotFound/GrotNotFound';

export interface Props {}

export const EmptyState = ({}: Props) => {
  return (
    <Box paddingY={8}>
      <Stack direction="column" alignItems="center" gap={3}>
        <GrotNotFound width={300} />
        <Text variant="h5">
          <Trans i18nKey="command-palette.empty-state.title">No results found</Trans>
        </Text>
      </Stack>
    </Box>
  );
};

EmptyState.displayName = 'EmptyState';
