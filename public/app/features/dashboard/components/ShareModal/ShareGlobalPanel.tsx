import React from 'react';
import { PanelModel } from 'app/features/dashboard/state';
import { AddLibraryPanelContents } from 'app/features/library-panels/components/AddLibraryPanelModal/AddLibraryPanelModal';

interface Props {
  onDismiss?: () => void;
  panel?: PanelModel;
  initialFolderId?: number;
}

export const ShareGlobalPanel = ({ panel, initialFolderId, onDismiss }: Props) => {
  if (!panel) {
    return null;
  }

  return (
    <div className="share-modal-body">
      <div className="share-modal-header">
        <div className="share-modal-content">
          <p className="share-modal-info-text">Add this panel to the panel library.</p>
          <AddLibraryPanelContents panel={panel} initialFolderId={initialFolderId} onDismiss={onDismiss!} />
        </div>
      </div>
    </div>
  );
};
