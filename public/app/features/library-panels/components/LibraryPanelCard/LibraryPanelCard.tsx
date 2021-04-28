import React, { useState } from 'react';
import { PanelPluginMeta } from '@grafana/data';
import { config } from '@grafana/runtime';

import { LibraryPanelDTO } from '../../types';
import { PanelTypeCard } from 'app/features/dashboard/components/VizTypePicker/PanelTypeCard';
import { DeleteLibraryPanelModal } from '../DeleteLibraryPanelModal/DeleteLibraryPanelModal';

export interface LibraryPanelCardProps {
  libraryPanel: LibraryPanelDTO;
  onClick: (panel: LibraryPanelDTO) => void;
  onDelete?: (panel: LibraryPanelDTO) => void;
  showSecondaryActions?: boolean;
}

export const LibraryPanelCard: React.FC<LibraryPanelCardProps & { children?: JSX.Element | JSX.Element[] }> = ({
  libraryPanel,
  onClick,
  onDelete,
  showSecondaryActions,
}) => {
  const [showDeletionModal, setShowDeletionModal] = useState(false);

  const onDeletePanel = () => {
    onDelete?.(libraryPanel);
    setShowDeletionModal(false);
  };

  const panelPlugin = config.panels[libraryPanel.model.type] ?? ({} as PanelPluginMeta);

  return (
    <>
      <PanelTypeCard
        isCurrent={false}
        title={libraryPanel.name}
        description={libraryPanel.description}
        plugin={panelPlugin}
        onClick={() => onClick(libraryPanel)}
        onDelete={showSecondaryActions ? () => setShowDeletionModal(true) : undefined}
      />
      {showDeletionModal && (
        <DeleteLibraryPanelModal
          libraryPanel={libraryPanel}
          onConfirm={onDeletePanel}
          onDismiss={() => setShowDeletionModal(false)}
        />
      )}
    </>
  );
};
