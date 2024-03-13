import React, { useState } from 'react';

import { Button, Stack, Text } from '@grafana/ui';
import { Trans } from 'app/core/internationalization';

import { useGetStatusQuery } from '../api';

import { DisconnectModal } from './DisconnectModal';
import { EmptyState } from './EmptyState/EmptyState';

export const Page = () => {
  const { data, isFetching } = useGetStatusQuery();
  const [isDisconnecting, setIsDisconnecting] = useState(false);

  if (!data?.enabled) {
    return <EmptyState />;
  }

  return (
    <>
      <Stack alignItems="center">
        {data.stackURL && <Text variant="h4">{data.stackURL}</Text>}

        <Button disabled={isFetching || isDisconnecting} variant="secondary" onClick={() => setIsDisconnecting(true)}>
          <Trans i18nKey="migrate-to-cloud.resources.disconnect">Disconnect</Trans>
        </Button>
      </Stack>

      <DisconnectModal isOpen={isDisconnecting} onDismiss={() => setIsDisconnecting(false)} />
    </>
  );
};
