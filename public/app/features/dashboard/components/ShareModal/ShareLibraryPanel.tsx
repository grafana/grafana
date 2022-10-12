import React, { useEffect } from 'react';

import { reportInteraction } from '@grafana/runtime/src';
import { Trans } from 'app/core/internationalization';
import { AddLibraryPanelContents } from 'app/features/library-panels/components/AddLibraryPanelModal/AddLibraryPanelModal';

import { ShareModalTabProps } from './types';

interface Props extends ShareModalTabProps {
  initialFolderId?: number;
}

export const ShareLibraryPanel = ({ panel, initialFolderId, onDismiss }: Props) => {
  useEffect(() => {
    reportInteraction('grafana_dashboards_library_panel_share_viewed');
  }, []);

  if (!panel) {
    return null;
  }

  return (
    <>
      <p className="share-modal-info-text">
        <Trans i18nKey="share-modal.library.info">Create library panel.</Trans>
      </p>
      <AddLibraryPanelContents panel={panel} initialFolderId={initialFolderId} onDismiss={onDismiss!} />
    </>
  );
};
