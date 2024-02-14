import React from 'react';

import { Box, Stack, Text } from '@grafana/ui';
import { Trans } from 'app/core/internationalization';

export interface Props {}

export const EmptyState = ({}: Props) => {
  return (
    <Box paddingY={8}>
      <Stack direction="column" alignItems="center">
        <img src={'public/img/grot-not-found.svg'} width="200px" alt="grot" />
        <Text variant="h5">
          <Trans i18nKey="command-palette.empty-state.title">No results found</Trans>
        </Text>
      </Stack>
    </Box>
  );
};

EmptyState.displayName = 'EmptyState';
