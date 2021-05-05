import React, { useState } from 'react';
import { css } from '@emotion/css';
import { GrafanaTheme2, PanelPluginMeta } from '@grafana/data';
import { config } from '@grafana/runtime';
import { Icon, Link, useStyles2 } from '@grafana/ui';

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
      >
        <FolderLink libraryPanel={libraryPanel} />
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

interface FolderLinkProps {
  libraryPanel: LibraryPanelDTO;
}

function FolderLink({ libraryPanel }: FolderLinkProps): JSX.Element {
  const styles = useStyles2(getStyles);

  if (!libraryPanel.meta.folderUid) {
    return (
      <span className={styles.metaContainer}>
        <Icon name={'folder'} size="sm" />
        {libraryPanel.meta.folderName}
      </span>
    );
  }

  return (
    <Link href={`/dashboards/f/${libraryPanel.meta.folderUid}`}>
      <span className={styles.metaContainer}>
        <Icon name={'folder-upload'} size="sm" />
        {libraryPanel.meta.folderName}
      </span>
    </Link>
  );
}

function getStyles(theme: GrafanaTheme2) {
  return {
    metaContainer: css`
      display: flex;
      align-items: center;
      color: ${theme.colors.text.disabled};
      font-size: ${theme.typography.bodySmall.fontSize};
      padding-top: ${theme.spacing(0.5)};

      svg {
        margin-right: ${theme.spacing(0.5)};
        margin-bottom: 3px;
      }
    `,
  };
}
