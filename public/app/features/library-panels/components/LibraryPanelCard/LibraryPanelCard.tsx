import React, { useState } from 'react';
import { GrafanaTheme2, PanelPluginMeta } from '@grafana/data';
import { config } from '@grafana/runtime';

import { LibraryPanelDTO } from '../../types';
import { PanelTypeCard } from 'app/features/dashboard/components/VizTypePicker/PanelTypeCard';
import { DeleteLibraryPanelModal } from '../DeleteLibraryPanelModal/DeleteLibraryPanelModal';
import { Icon, useStyles2 } from '@grafana/ui';
import { css } from '@emotion/css';

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
  const styles = useStyles2(getStyles);
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
      >
        <span className={styles.metaContainer}>
          <Icon name={'folder'} />
          {libraryPanel.meta.folderName}
        </span>
      </PanelTypeCard>
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

function getStyles(theme: GrafanaTheme2) {
  return {
    metaContainer: css`
      display: flex;
      align-items: center;
      margin-right: ${theme.spacing(0.5)};
      margin-left: ${theme.spacing(1)};
      color: ${theme.colors.text.disabled};
      font-size: ${theme.typography.bodySmall.fontSize};
      padding: ${theme.spacing(0.5)};
      svg {
        margin-right: ${theme.spacing(0.25)};
        margin-bottom: 0;
      }
    `,
  };
}
