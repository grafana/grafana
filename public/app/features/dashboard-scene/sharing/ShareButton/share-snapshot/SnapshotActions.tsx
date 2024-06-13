import React from 'react';

import { Button, ClipboardButton, Stack } from '@grafana/ui';
import { Trans } from 'app/core/internationalization';

interface Props {
  url: string;
  onDeleteClick: () => void;
  onNewSnapshotClick: () => void;
}
export const SnapshotActions = ({ url, onDeleteClick, onNewSnapshotClick }: Props) => {
  return (
    <Stack justifyContent="flex-start" gap={1} direction={{ xs: 'column', sm: 'row' }}>
      <ClipboardButton icon="link" variant="primary" fill="outline" getText={() => url}>
        <Trans i18nKey="snapshot.share.copy-link-button">Copy link</Trans>
      </ClipboardButton>
      <Button icon="trash-alt" variant="destructive" fill="outline" onClick={onDeleteClick}>
        <Trans i18nKey="snapshot.share.delete-button">Delete snapshot</Trans>
      </Button>
      <Button variant="secondary" fill="solid" onClick={onNewSnapshotClick}>
        <Trans i18nKey="snapshot.share.new-snapshot-button">New snapshot</Trans>
      </Button>
    </Stack>
  );
};
