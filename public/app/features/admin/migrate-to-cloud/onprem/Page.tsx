import { skipToken } from '@reduxjs/toolkit/query/react';
import React, { useState } from 'react';

import { Button, Stack, Text } from '@grafana/ui';
import { Trans } from 'app/core/internationalization';

import { useGetStatusQuery, useListResourcesQuery } from '../api';

import { DisconnectModal } from './DisconnectModal';
import { EmptyState } from './EmptyState/EmptyState';
import { ResourcesTable } from './ResourcesTable';

export const Page = () => {
  const { data: status, isFetching } = useGetStatusQuery();
  const { data: resources } = useListResourcesQuery(status?.enabled ? undefined : skipToken);
  const [isDisconnecting, setIsDisconnecting] = useState(false);

  if (!status?.enabled) {
    return <EmptyState />;
  }

  return (
    <>
      <Stack direction="column" alignItems="flex-start">
        {status.stackURL && <Text variant="h4">{status.stackURL}</Text>}

        <Button disabled={isFetching || isDisconnecting} variant="secondary" onClick={() => setIsDisconnecting(true)}>
          <Trans i18nKey="migrate-to-cloud.resources.disconnect">Disconnect</Trans>
        </Button>

        {resources && <ResourcesTable resources={resources} />}
      </Stack>

      <DisconnectModal isOpen={isDisconnecting} onDismiss={() => setIsDisconnecting(false)} />
    </>
  );
};
