import React, { useEffect } from 'react';

import { PanelModel } from '@grafana/data';
import { reportInteraction } from '@grafana/runtime/src';
import { VizPanel } from '@grafana/scenes';
import { Trans } from 'app/core/internationalization';
import {
  AddLibraryPanelContents,
  AddLibraryPanelContents2,
} from 'app/features/library-panels/components/AddLibraryPanelModal/AddLibraryPanelModal';

import { DashboardModel } from '../../state';

import { ShareModalTabProps } from './types';

interface Props extends ShareModalTabProps {
  initialFolderUid?: string;
}

export const ShareLibraryPanel = ({ panel, initialFolderUid, onDismiss }: Props) => {
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
      <AddLibraryPanelContents panel={panel} initialFolderUid={initialFolderUid} onDismiss={onDismiss} />
    </>
  );
};

// --------- dashboard scene ----------

interface Props2 {
  dashboard: DashboardModel;
  panel?: PanelModel;
  onDismiss?(): void;
  initialFolderUid?: string;
  vizPanel?: VizPanel;
}

export const ShareLibraryPanel2 = ({ panel, vizPanel, initialFolderUid, onDismiss }: Props2) => {
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
      <AddLibraryPanelContents2
        panel={panel}
        initialFolderUid={initialFolderUid}
        onDismiss={onDismiss}
        vizPanel={vizPanel}
      />
    </>
  );
};
