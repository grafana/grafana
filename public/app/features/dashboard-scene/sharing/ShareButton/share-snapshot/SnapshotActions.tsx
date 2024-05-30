import React from 'react';

import { Button, ClipboardButton, Spinner, Stack } from '@grafana/ui';
import { Trans } from 'app/core/internationalization';

interface Props {
  url: string;
  onDeleteClick: () => void;
  isLoading: boolean;
}
export const SnapshotActions = ({ url, onDeleteClick, isLoading }: Props) => {
  return (
    <Stack justifyContent="space-between" gap={2}>
      <Stack justifyContent="flex-start" gap={2}>
        <ClipboardButton icon="link" variant="primary" fill="outline" getText={() => url}>
          Copy link
        </ClipboardButton>
        <Button icon="trash-alt" variant="destructive" fill="outline" onClick={onDeleteClick}>
          <Trans i18nKey="share-modal.snapshot.delete-button">Delete snapshot</Trans>
        </Button>
      </Stack>
      {isLoading && <Spinner />}
    </Stack>
  );
};
