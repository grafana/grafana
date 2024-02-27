import React from 'react';

import { Button, ModalsController } from '@grafana/ui';
import { Trans } from 'app/core/internationalization';

import { useDisconnectStackMutation, useGetStatusQuery } from '../api';

import { DisconnectModal } from './DisconnectModal';
import { EmptyState } from './EmptyState/EmptyState';

export const Page = () => {
  const { data, isFetching } = useGetStatusQuery();
  const [disconnectStack, disconnectResponse] = useDisconnectStackMutation();
  if (!data || !data.enabled) {
    return <EmptyState />;
  }

  return (
    <ModalsController>
      {({ showModal, hideModal }) => (
        <Button
          disabled={isFetching || disconnectResponse.isLoading}
          variant="secondary"
          onClick={() =>
            showModal(DisconnectModal, {
              hideModal,
              onConfirm: disconnectStack,
            })
          }
        >
          <Trans i18nKey="migrate-to-cloud.resources.disconnect">Disconnect</Trans>
        </Button>
      )}
    </ModalsController>
  );
};
